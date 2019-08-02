import { sleep } from "@renproject/react-components";
import RenVM, {
    Chain, NetworkTestnet, ShiftInObject, Signature, Tokens as ShiftActions,
} from "@renproject/ren";
import { TxStatus } from "@renproject/ren/dist/renVM/transaction";
import BigNumber from "bignumber.js";
import bs58 from "bs58";
import { Container } from "unstated";
import Web3 from "web3";
import { TransactionReceipt } from "web3-core";

import {
    syncGetDEXAdapterAddress, syncGetDEXAddress, syncGetTokenAddress,
} from "../lib/contractAddresses";
import { getAdapter, getERC20, NULL_BYTES32, Token, Tokens } from "./generalTypes";
import {
    Commitment, HistoryEvent, PersistentContainer, ShiftInStatus, ShiftOutStatus,
} from "./persistentContainer";

const BitcoinTx = (hash: string) => ({ hash, chain: Chain.Bitcoin });
// const ZCashTx = (hash: string) => ({ hash, chain: Chain.ZCash });
const EthereumTx = (hash: string) => ({ hash, chain: Chain.Ethereum });

const initialState = {
    sdkRenVM: null as null | RenVM,
    sdkAddress: null as string | null,
    sdkWeb3: null as Web3 | null,
    sdkNetworkID: 0,
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
    public persistentContainer: PersistentContainer;

    constructor(persistentContainer: PersistentContainer) {
        super();
        this.persistentContainer = persistentContainer;
    }

    public order = (orderID: string): HistoryEvent | undefined => this.persistentContainer.state.historyItems[orderID];

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        await this.setState({
            sdkWeb3: web3,
            sdkNetworkID: networkID,
            sdkRenVM: new RenVM(NetworkTestnet),
            sdkAddress: address
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Trading DAI to BTC //////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Trading DAI to BTC involves three steps:
    // 1. Approve transfer of the DAI token
    // 2. Swap DAI for zBTC and burn the zBTC
    // 3. Submit the burn to the darknodes

    public approveTokenTransfer = async (orderID: string) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID } = this.state;
        if (!web3 || !address) {
            throw new Error("Web3 address is not defined");
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        const { srcToken, srcAmount } = order.orderInputs;
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
    }

    public submitBurnToEthereum = async (orderID: string) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!web3 || !renVM || !address) {
            throw new Error(`Invalid values required for swap`);
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        let transactionHash = order.inTx ? order.inTx.hash : null;

        if (!transactionHash) {
            const amount = order.commitment.srcAmount.toString();
            const txHash = NULL_BYTES32;
            const signatureBytes = NULL_BYTES32;

            const promiEvent = getAdapter(web3, networkID).methods.trade(
                order.commitment.srcToken, // _src: string
                order.commitment.dstToken, // _dst: string
                order.commitment.minDestinationAmount, // _minDstAmt: BigNumber
                order.commitment.toAddress, // _to: string
                order.commitment.refundBlockNumber, // _refundBN: BigNumber
                order.commitment.refundAddress, // _refundAddress: string
                amount, // _amount: BigNumber
                txHash, // _hash: string
                signatureBytes, // _sig: string
            ).send({ from: address, gas: 350000 });

            promiEvent.catch((error: Error) => {
                throw error;
            });

            transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));
            await this.persistentContainer.updateHistoryItem(order.id, {
                inTx: EthereumTx(transactionHash),
                status: ShiftOutStatus.SubmittedToEthereum,
            });
        }

        // Wait for confirmation
        let receipt;
        while (!receipt) {
            receipt = await web3.eth.getTransactionReceipt(transactionHash);
            if (receipt) {
                break;
            }
            await sleep(3 * 1000);
        }

        await this.persistentContainer.updateHistoryItem(order.id, {
            status: ShiftOutStatus.ConfirmedOnEthereum,
        });
    }

    public submitBurnToRenVM = async (orderID: string, _resubmit = false) => {
        // if (resubmit) {
        //     await this.persistentContainer.updateHistoryItem(orderID, { status: ShiftOutStatus.ConfirmedOnEthereum, messageID: null });
        // }

        const { sdkWeb3: web3, sdkRenVM: renVM } = this.state;
        if (!web3 || !renVM) {
            throw new Error(`Invalid values required to submit deposit`);
        }

        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        if (!order.inTx) {
            throw new Error(`Invalid values required to submit deposit`);
        }

        const shiftOutObject = await renVM.shiftOut({
            web3Provider: web3.currentProvider as any,
            sendToken: order.orderInputs.dstToken === Token.ZEC ? ShiftActions.ZEC.Eth2Zec : ShiftActions.BTC.Eth2Btc,
            txHash: order.inTx.hash
        }).readFromEthereum();
        const response = await shiftOutObject.submitToRenVM()
            .on("messageID", (messageID: string) => {
                this.persistentContainer.updateHistoryItem(order.id, {
                    messageID,
                    status: ShiftOutStatus.SubmittedToRenVM,
                }).catch(console.error);
            })
            .on("status", (renVMStatus: TxStatus) => {
                this.persistentContainer.updateHistoryItem(order.id, {
                    renVMStatus,
                }).catch(console.error);
            });
        const receivedAmount = order.orderInputs.dstAmount; // new BigNumber(response.amount).dividedBy(new BigNumber(10).exponentiatedBy(8)).toString();
        await this.persistentContainer.updateHistoryItem(order.id, {
            receivedAmount,
            outTx: BitcoinTx(bs58.encode(Buffer.from((response as any).tx.args[1].value, "base64"))),
            status: ShiftOutStatus.ReturnedFromRenVM,
        }).catch(console.error);
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

    public shiftInObject = (orderID: string): ShiftInObject => {
        const { sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        console.log(ShiftActions);
        console.log(order.orderInputs.srcToken);

        const shiftObject = renVM.shiftIn({
            sendToken: order.orderInputs.srcToken === Token.ZEC ? ShiftActions.ZEC.Zec2Eth : ShiftActions.BTC.Btc2Eth,
            sendTo: syncGetDEXAdapterAddress(networkID),
            sendAmount: order.commitment.srcAmount,
            contractFn: "trade",
            contractParams: this.zipPayload(order.commitment),
            nonce: order.nonce,
            messageID: order.messageID || undefined,
        });
        return shiftObject;
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = (orderID: string): string | undefined => {
        return this
            .shiftInObject(orderID)
            .addr();
    }

    // Retrieves unspent deposits at the provided address
    public waitForDeposits = async (orderID: string, confirmations = 0) => {
        await this
            .shiftInObject(orderID)
            .waitForDeposit(confirmations);
        await this.persistentContainer
            .updateHistoryItem(orderID, { status: ShiftInStatus.Deposited });
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitMintToRenVM = async (orderID: string, _resubmit = false): Promise<Signature> => {
        // if (resubmit) {
        //     await this.persistentContainer.updateHistoryItem(orderID, { status: ShiftInStatus.Deposited, messageID: null });
        // }
        const onMessageID = (messageID: string) =>
            this.persistentContainer
                .updateHistoryItem(orderID, { messageID, status: ShiftInStatus.SubmittedToRenVM })
                .catch(console.error);
        const onStatus = (renVMStatus: TxStatus) => {
            this.persistentContainer.updateHistoryItem(orderID, {
                renVMStatus,
            }).catch(console.error);
        };
        const shiftInObject = this
            .shiftInObject(orderID)
            .waitForDeposit(0);
        await sleep(10 * 1000);
        const obj = await shiftInObject;
        const signature = await obj
            .submitToRenVM()
            .on("messageID", onMessageID)
            .on("status", onStatus);
        await this.persistentContainer.updateHistoryItem(orderID, { status: ShiftInStatus.ReturnedFromRenVM });
        return signature;
    }

    public submitMintToEthereum = async (orderID: string) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID } = this.state;
        if (!web3 || !address) {
            throw new Error(`Invalid values required for swap`);
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        return new Promise<void>(async (resolve, reject) => {
            const promiEvent = (await this.submitMintToRenVM(orderID)).submitToEthereum(web3.currentProvider as any);
            promiEvent.catch((error) => {
                reject(error);
            });
            const transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));
            await this.persistentContainer.updateHistoryItem(orderID, { status: ShiftInStatus.SubmittedToEthereum });
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
                        const dstTokenDetails = Tokens.get(order.orderInputs.dstToken);
                        const decimals = dstTokenDetails ? dstTokenDetails.decimals : 8;
                        const receivedAmountBN = new BigNumber(data[3]);
                        const rcv = receivedAmountBN.dividedBy(new BigNumber(10).exponentiatedBy(decimals));
                        resolve(rcv);
                        return;
                    }
                }
                reject(new Error("No burn events found in transaction."));
            }).catch(reject));

            await this.persistentContainer.updateHistoryItem(order.id, {
                receivedAmount: receivedAmount.toString(),
                outTx: EthereumTx(transactionHash),
                status: ShiftInStatus.ConfirmedOnEthereum,
            });

            resolve();
        });
    }
}
