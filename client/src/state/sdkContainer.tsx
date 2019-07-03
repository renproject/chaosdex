import RenSDK, {
    Chain, NetworkTestnet, ShiftObject, Signature, strip0x, Tokens as ShiftActions, UTXO,
} from "@renproject/ren";
import BigNumber from "bignumber.js";
import bs58 from "bs58";
import { List, OrderedMap } from "immutable";
import { Container } from "unstated";
import Web3 from "web3";
import { TransactionReceipt } from "web3-core";

import { syncGetDEXAdapterAddress, syncGetTokenAddress } from "../lib/contractAddresses";
import { _catchBackgroundErr_, _catchInteractionErr_ } from "../lib/errors";
import { getAdapter, getERC20, isEthereumBased, NULL_BYTES32, Token, Tokens } from "./generalTypes";
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

    renSDK: null as null | RenSDK,

    address: null as string | null,
    connected: false,
    web3: null as Web3 | null,
    networkID: 0,
    adapterAddress: "",
    shiftObject: undefined as ShiftObject | undefined,
    deposit: undefined as ShiftObject | undefined,
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

export class SDKContainer extends Container<typeof initialState> {
    public state = initialState;

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        const adapterAddress = syncGetDEXAdapterAddress(networkID);
        const renSDK = new RenSDK(NetworkTestnet);
        await this.setState({ web3, networkID, renSDK, address, adapterAddress });
    }

    // Opening order ///////////////////////////////////////////////////////////

    public checkBurnStatus = async () => {
        const { web3, renSDK, inTx, commitment } = this.state;
        if (!web3 || !renSDK || !inTx || !commitment) {
            throw new Error(`Invalid values required to submit deposit`);
        }
        const response = await renSDK.burnDetails({ web3, sendToken: ShiftActions[commitment.orderInputs.dstToken].Eth2Btc, txHash: inTx.hash })
            .on("messageID", (messageID: string) => this.setState({ messageID }));
        const receivedAmount = new BigNumber(response.amount).dividedBy(new BigNumber(10).exponentiatedBy(8));
        await this.setState({ receivedAmount, outTx: BitcoinTx(bs58.encode(Buffer.from(strip0x(response.to), "hex"))) });
    }

    public submitBurn = async () => {
        const { address, web3, renSDK, commitment, networkID } = this.state;
        if (!web3 || !renSDK || !address || !commitment) {
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

        const receivedAmount = await new Promise<BigNumber>((resolve, reject) => promiEvent.once("confirmation", async (confirmations: number, receipt: TransactionReceipt) => {
            // Loop through logs to find burn log
            for (const log of receipt.logs) {
                if (
                    log.address.toLowerCase() === (syncGetTokenAddress(networkID, commitment.orderInputs.dstToken)).toLowerCase() &&
                    log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef".toLowerCase() &&
                    log.topics[1] === `0x000000000000000000000000${strip0x(syncGetDEXAdapterAddress(networkID))}`.toLowerCase() &&
                    log.topics[2] === "0x0000000000000000000000000000000000000000000000000000000000000000".toLowerCase()
                ) {
                    const dstTokenDetails = Tokens.get(commitment.orderInputs.dstToken);
                    const decimals = dstTokenDetails ? dstTokenDetails.decimals : 8;
                    const receivedAmountHex = parseInt(log.data, 16).toString(16);
                    const rcv = new BigNumber(log.data, 16).dividedBy(new BigNumber(10).exponentiatedBy(decimals));
                    this.setState({ receivedAmountHex }).catch(_catchInteractionErr_);
                    resolve(rcv);
                }
            }
            reject();
        }).catch(reject));

        await this.setState({ receivedAmount, inTx: EthereumTx(transactionHash) });
    }

    public submitSwap = async () => {
        const { address, web3, commitment, darknodeSignature, networkID } = this.state;
        if (!web3 || !address || !commitment || !darknodeSignature) {
            throw new Error(`Invalid values required for swap`);
        }

        const promiEvent = darknodeSignature.signAndSubmit(web3, syncGetDEXAdapterAddress(networkID));
        const transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));

        if (isEthereumBased(commitment.orderInputs.dstToken)) {
            await this.setState({ pendingTXs: this.state.pendingTXs.set(transactionHash, 0) });
        }

        const receivedAmount = await new Promise<BigNumber>((resolve, reject) => promiEvent.once("confirmation", async (confirmations: number, receipt: TransactionReceipt) => {
            if (isEthereumBased(commitment.orderInputs.dstToken)) {
                this.setState({ pendingTXs: this.state.pendingTXs.remove(transactionHash) }).catch(_catchInteractionErr_);

                // Loop through logs to find burn log
                for (const log of receipt.logs) {
                    if (
                        log.address.toLowerCase() === (syncGetTokenAddress(networkID, commitment.orderInputs.dstToken)).toLowerCase() &&
                        log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef".toLowerCase() &&
                        // log.topics[1] === `0x000000000000000000000000${strip0x(reserve_address)}`.toLowerCase() &&
                        log.topics[2] === `0x000000000000000000000000${strip0x(commitment.toAddress)}`.toLowerCase()
                    ) {
                        const dstTokenDetails = Tokens.get(commitment.orderInputs.dstToken);
                        const decimals = dstTokenDetails ? dstTokenDetails.decimals : 8;
                        const rcv = new BigNumber(log.data, 16).dividedBy(new BigNumber(10).exponentiatedBy(decimals));
                        resolve(rcv);
                    }
                }
                reject();
            } else {
                // Loop through logs to find burn log
                for (const log of receipt.logs) {
                    if (
                        log.address.toLowerCase() === (syncGetTokenAddress(networkID, commitment.orderInputs.dstToken)).toLowerCase() &&
                        log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef".toLowerCase() &&
                        log.topics[1] === `0x000000000000000000000000${strip0x(syncGetDEXAdapterAddress(networkID))}`.toLowerCase() &&
                        log.topics[2] === "0x0000000000000000000000000000000000000000000000000000000000000000".toLowerCase()
                    ) {
                        const dstTokenDetails = Tokens.get(commitment.orderInputs.dstToken);
                        const decimals = dstTokenDetails ? dstTokenDetails.decimals : 8;
                        const receivedAmountHex = parseInt(log.data, 16).toString(16);
                        const rcv = new BigNumber(log.data, 16).dividedBy(new BigNumber(10).exponentiatedBy(decimals));
                        this.setState({ receivedAmountHex }).catch(_catchInteractionErr_);
                        resolve(rcv);
                    }
                }
                reject();
            }
        }).catch(reject));

        if (isEthereumBased(commitment.orderInputs.dstToken)) {
            await this.setState({ receivedAmount, outTx: EthereumTx(transactionHash) });
        } else {
            await this.setState({ receivedAmount, inTx: EthereumTx(transactionHash) });
        }
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

    public setCommitment = async (commitment: Commitment) => {
        await this.setState({ commitment });
    }

    public setAllowance = async () => {
        const { commitment, address } = this.state;
        if (!commitment || !address) {
            this.setState({ erc20Approved: false }).catch(_catchBackgroundErr_);
            throw new Error("Commitment or address is not defined");
        }
        const { orderInputs: { srcToken, srcAmount } } = commitment;
        const srcTokenDetails = Tokens.get(srcToken);
        if (!srcTokenDetails) {
            this.setState({ erc20Approved: false }).catch(_catchBackgroundErr_);
            return;
        }
        const srcAmountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
        const allowance = await this.setTokenAllowance(srcAmountBN, srcToken, address);
        this.setState({ erc20Approved: allowance.gte(srcAmountBN) }).catch(_catchBackgroundErr_);
    }

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
        const { commitment, renSDK, adapterAddress } = this.state;
        if (!renSDK) {
            throw new Error("RenSDK not initialized");
        }
        if (!commitment) {
            throw new Error("Commitment not stored yet");
        }

        const token = commitment.orderInputs.srcToken;

        const shiftObject = renSDK.shift({
            sendToken: ShiftActions[token].Btc2Eth,
            sendTo: adapterAddress,
            sendAmount: commitment.srcAmount.toNumber(),
            contractFn: "trade",
            contractParams: this.zipPayload(commitment),
        });
        const depositAddress = shiftObject.addr();
        await this.setState({ shiftObject, depositAddress });
    }

    // Retrieves unspent deposits at the provided address
    public waitForDeposits = async (limit = 10, confirmations = 0) => {
        const { shiftObject } = this.state;
        if (!shiftObject) {
            throw new Error("Must have generated address first");
        }
        const deposit = await shiftObject.wait(confirmations);
        await this.setState({ deposit });
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitDeposit = async (): Promise<void> => {
        const { deposit } = this.state;
        if (!deposit) {
            throw new Error("Must have retrieved deposits first");
        }
        const onMessageID = (messageID: string) => this.setState({ messageID });
        const darknodeSignature = await deposit.submit().on("messageID", onMessageID);
        await this.setState({ darknodeSignature });
    }

    public getTokenAllowance = async (token: Token, address: string): Promise<BigNumber> => {
        const { web3, networkID } = this.state;
        if (!web3) {
            throw new Error("Web3 not initialized yet.");
        }
        const tokenAddress = syncGetTokenAddress(networkID, token);
        const tokenInstance = getERC20(web3, tokenAddress);

        const allowance = await tokenInstance.methods.allowance(address, (getAdapter(web3, networkID)).address).call();

        return new BigNumber(allowance.toString());
    }

    public setTokenAllowance = async (amount: BigNumber, token: Token, address: string): Promise<BigNumber> => {
        const { web3, networkID } = this.state;
        if (!web3) {
            throw new Error("Web3 not initialized yet.");
        }

        const allowanceBN = await this.getTokenAllowance(token, address);

        if (allowanceBN.gte(amount)) {
            return allowanceBN;
        }

        const tokenAddress = syncGetTokenAddress(networkID, token);
        const tokenInstance = getERC20(web3, tokenAddress);

        // We don't have enough allowance so approve more
        const promiEvent = tokenInstance.methods.approve(
            (getAdapter(web3, networkID)).address,
            amount.toString()
        ).send({ from: address });
        await new Promise((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));
        return amount;
    }

    // if(isERC20(this.state.commitment.orderInputs.srcToken)) {
    //     this.getAllowance().catch(_catchBackgroundErr_);
    // }

    // private readonly getAllowance = async () => {
    //     const { dexSDK, commitment, address } = this.state;
    //     if (!dexSDK || !commitment || !address) {
    //         this.setState({ erc20Approved: false }).catch(_catchBackgroundErr_);
    //         return;
    //     }
    //     const { orderInputs: { srcToken, srcAmount } } = commitment;
    //     const srcTokenDetails = Tokens.get(srcToken);
    //     if (!srcTokenDetails) {
    //         this.setState({ erc20Approved: false }).catch(_catchBackgroundErr_);
    //         return;
    //     }
    //     const srcAmountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
    //     const allowance = await dexSDK.getTokenAllowance(srcToken, address);
    //     this.setState({ erc20Approved: allowance.gte(srcAmountBN) }).catch(_catchBackgroundErr_);
    // }

}
