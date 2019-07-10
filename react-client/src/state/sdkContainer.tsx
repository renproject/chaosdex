import RenVM, {
    Chain, NetworkTestnet, ShiftInObject, Signature, strip0x, Tokens as ShiftActions, UTXO,
} from "@renproject/ren";
import BigNumber from "bignumber.js";
import bs58 from "bs58";
import { List, OrderedMap } from "immutable";
import { Container } from "unstated";
import Web3 from "web3";
import { TransactionReceipt } from "web3-core";

import {
    syncGetDEXAdapterAddress, syncGetDEXAddress, syncGetTokenAddress,
} from "../lib/contractAddresses";
import { _catchBackgroundErr_, _catchInteractionErr_ } from "../lib/errors";
import { getAdapter, getERC20, NULL_BYTES32, Tokens } from "./generalTypes";
import { OrderInputs } from "./uiContainer";

export interface Commitment {
    srcToken: string;
    dstToken: string;
    minDestinationAmount: BigNumber;
    srcAmount: BigNumber;
    toAddress: string;
    refundBlockNumber: number;
    refundAddress: string;

    orderInputs: OrderInputs;
}

export interface Tx {
    hash: string;
    chain: Chain;
}

const BitcoinTx = (hash: string) => ({ hash, chain: Chain.Bitcoin });
// const ZCashTx = (hash: string) => ({ hash, chain: Chain.ZCash });
const EthereumTx = (hash: string) => ({ hash, chain: Chain.Ethereum });

export interface HistoryEvent {
    time: number; // Seconds since Unix epoch
    // inTx: Tx;
    outTx: Tx;
    receivedAmount: string;
    orderInputs: OrderInputs;
    complete: boolean;
}

const initialState = {

    renVM: null as null | RenVM,

    address: null as string | null,
    connected: false,
    web3: null as Web3 | null,
    networkID: 0,
    adapterAddress: "",
    shiftInObject: undefined as ShiftInObject | undefined,
    deposit: undefined as ShiftInObject | undefined,
    darknodeSignature: undefined as Signature | undefined,

    pendingTXs: OrderedMap<string, number>(),

    commitment: null as Commitment | null,

    utxos: null as List<UTXO> | null,
    erc20Approved: false,
    inTx: null as Tx | null,
    outTx: null as Tx | null,
    messageID: null as string | null,
    receivedAmount: null as BigNumber | null,
    receivedAmountHex: null as string | null,

    depositAddress: null as string | null,
};

/**
 * The SDKContainer is responsible for talking to the RenVM SDK. It stores the
 * associated state and exposes functions to interact with the SDK.
 *
 * The main two interactions are shifting in (trading BTC to DAI), and shifting
 * out (trading DAI to BTC).
 */
export class SDKContainer extends Container<typeof initialState> {
    public state = initialState;

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        const adapterAddress = syncGetDEXAdapterAddress(networkID);
        const renVM = new RenVM(NetworkTestnet);
        await this.setState({ web3, networkID, renVM, address, adapterAddress });
    }

    public setCommitment = async (commitment: Commitment) => {
        await this.setState({ commitment });
    }

    public resetTrade = async () => {
        await this.setState({
            commitment: null,
            utxos: null,
            erc20Approved: false,
            inTx: null,
            outTx: null,
            receivedAmount: null,
            receivedAmountHex: null,
            depositAddress: null,
        });
    }

    public getHistoryEvent = async () => {
        const { outTx, commitment, receivedAmount } = this.state;
        if (!commitment || !outTx || !receivedAmount) {
            throw new Error(`Invalid values passed to getHistoryEvent`);
        }
        const historyItem: HistoryEvent = {
            // inTx,
            outTx,
            receivedAmount: receivedAmount.toFixed(),
            orderInputs: commitment.orderInputs,
            time: Date.now() / 1000,
            complete: false,
        };
        return historyItem;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Trading DAI to BTC //////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Trading DAI to BTC involves three steps:
    // 1. Approve transfer of the DAI token
    // 2. Swap DAI for zBTC and burn the zBTC
    // 3. Submit the burn to the darknodes

    public approveTokenTransfer = async () => {
        const { commitment, address, web3, networkID } = this.state;
        if (!web3 || !commitment || !address) {
            throw new Error("Web3, commitment or address is not defined");
        }
        const { orderInputs: { srcToken, srcAmount } } = commitment;
        const srcTokenDetails = Tokens.get(srcToken);
        if (!srcTokenDetails) {
            throw new Error(`Unable to retrieve details for ${srcToken}`);
        }
        const srcAmountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));

        const tokenInstance = getERC20(web3, syncGetTokenAddress(networkID, srcToken));

        // Check the allowance of the token.
        // If it's not sufficient, approve the required amount.
        // NOTE: Some tokens require the allowance to be 0 before being able to
        // approve a new amount.
        const allowance = new BigNumber((await tokenInstance.methods.allowance(address, (getAdapter(web3, networkID)).address).call()).toString());
        if (allowance.lt(srcAmountBN)) {
            // We don't have enough allowance so approve more
            const promiEvent = tokenInstance.methods.approve(
                (getAdapter(web3, networkID)).address,
                srcAmountBN.toString()
            ).send({ from: address });
            await new Promise((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));
        }

        this.setState({ erc20Approved: true }).catch(_catchBackgroundErr_);
    }

    public submitBurnToEthereum = async () => {
        const { address, web3, renVM, commitment, networkID } = this.state;
        if (!web3 || !renVM || !address || !commitment) {
            throw new Error(`Invalid values required for swap`);
        }

        const amount = commitment.srcAmount.toString();
        const txHash = NULL_BYTES32;
        const signatureBytes = NULL_BYTES32;

        const promiEvent = getAdapter(web3, networkID).methods.trade(
            commitment.srcToken, // _src: string
            commitment.dstToken, // _dst: string
            commitment.minDestinationAmount.toNumber(), // _minDstAmt: BigNumber
            commitment.toAddress, // _to: string
            commitment.refundBlockNumber, // _refundBN: BigNumber
            commitment.refundAddress, // _refundAddress: string
            amount, // _amount: BigNumber
            txHash, // _hash: string
            signatureBytes, // _sig: string
        ).send({ from: address, gas: 350000 });

        const transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));

        await this.setState({ inTx: EthereumTx(transactionHash) });
    }

    public submitBurnToRenVM = async () => {
        const { web3, renVM, inTx, commitment } = this.state;
        if (!web3 || !renVM || !inTx || !commitment) {
            throw new Error(`Invalid values required to submit deposit`);
        }
        const shiftOutObject = await renVM.shiftOut({
            web3Provider: web3.currentProvider,
            sendToken: ShiftActions[commitment.orderInputs.dstToken].Eth2Btc,
            txHash: inTx.hash
        });
        const response = await shiftOutObject.submitToRenVM()
            .on("messageID", (messageID: string) => this.setState({ messageID }));
        const receivedAmount = new BigNumber(response.amount).dividedBy(new BigNumber(10).exponentiatedBy(8));
        await this.setState({ receivedAmount, outTx: BitcoinTx(bs58.encode(Buffer.from(strip0x(response.to), "hex"))) });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Trading BTC to DAI //////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Trading BTC to DAI involves the following steps:
    // 1. Generate a gateway address
    // 2. Wait for a deposit to the address
    // 3. Submit the deposit to RenVM and retrieve back a signature
    // 4. Submit the signature to Ethereum, creating zBTC & swapping it for DAI

    public zipPayload = (commitment: Commitment) => [
        { name: "srcToken", type: "address", value: commitment.srcToken },
        { name: "dstToken", type: "address", value: commitment.dstToken },
        { name: "minDestinationAmount", type: "uint256", value: commitment.minDestinationAmount.toFixed() },
        { name: "toAddress", type: "bytes", value: commitment.toAddress },
        { name: "refundBlockNumber", type: "uint256", value: commitment.refundBlockNumber },
        { name: "refundAddress", type: "bytes", value: commitment.refundAddress },
    ]

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = async (): Promise<void> => {
        const { commitment, renVM, adapterAddress } = this.state;
        if (!commitment || !renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }

        const shiftObject = renVM.shiftIn({
            sendToken: ShiftActions[commitment.orderInputs.srcToken].Btc2Eth,
            sendTo: adapterAddress,
            sendAmount: commitment.srcAmount.toNumber(),
            contractFn: "trade",
            contractParams: this.zipPayload(commitment),
        });
        const depositAddress = shiftObject.addr();
        await this.setState({ shiftInObject: shiftObject, depositAddress });
    }

    // Retrieves unspent deposits at the provided address
    public waitForDeposits = async (confirmations = 0) => {
        const { shiftInObject: shiftObject } = this.state;
        if (!shiftObject) {
            throw new Error("Must have generated address first");
        }
        const deposit = await shiftObject.waitForDeposit(confirmations);
        await this.setState({ deposit });
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitMintToRenVM = async (): Promise<void> => {
        const { deposit } = this.state;
        if (!deposit) {
            throw new Error("Must have retrieved deposits first");
        }
        const onMessageID = (messageID: string) => this.setState({ messageID });
        const darknodeSignature = await deposit.submitToRenVM().on("messageID", onMessageID);
        await this.setState({ darknodeSignature });
    }

    public submitMintToEthereum = async () => {
        const { address, web3, commitment, darknodeSignature, networkID } = this.state;
        if (!web3 || !address || !commitment || !darknodeSignature) {
            throw new Error(`Invalid values required for swap`);
        }

        const promiEvent = darknodeSignature.submitToEthereum(web3.currentProvider);
        const transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));
        // tslint:disable-next-line: no-any
        const receivedAmount = await new Promise<BigNumber>((resolve, reject) => (promiEvent as any).once("confirmation", async (_confirmations: number, receipt: TransactionReceipt) => {

            // Loop through logs to find exchange event from the DEX contract.
            // The event log always has the first topic as "0x8d10c7a1"
            // TODO: Calculate this instead of hard coding it.
            for (const log of receipt.logs) {
                if (
                    log.address.toLowerCase() === syncGetDEXAddress(networkID).toLowerCase() &&
                    log.topics[0] === "0x8d10c7a140b316d7362354a44023c657a9c436616f21481cac1cb594aa305458".toLowerCase()
                ) {
                    const data = web3.eth.abi.decodeParameters(["address", "address", "uint256", "uint256"], log.data);
                    const dstTokenDetails = Tokens.get(commitment.orderInputs.dstToken);
                    const decimals = dstTokenDetails ? dstTokenDetails.decimals : 8;
                    const receivedAmountBN = new BigNumber(data[3]);
                    const rcv = receivedAmountBN.dividedBy(new BigNumber(10).exponentiatedBy(decimals));
                    this.setState({ receivedAmountHex: receivedAmountBN.toString(16) }).catch(_catchInteractionErr_);
                    resolve(rcv);
                    return;
                }
            }
            reject(new Error("No burn events found in transaction."));
        }).catch(reject));

        await this.setState({ receivedAmount, outTx: EthereumTx(transactionHash) });
    }
}
