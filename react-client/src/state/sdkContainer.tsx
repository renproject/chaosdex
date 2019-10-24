import { sleep } from "@renproject/react-components";
import RenVM, {
    Chain, NetworkDetails, NetworkDevnet, NetworkLocalnet, NetworkTestnet, Ox, ShiftInObject,
    Signature, Tokens as ShiftActions,
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
import { ERC20Detailed } from "../lib/contracts/ERC20Detailed";
import { NETWORK } from "../lib/environmentVariables";
import {
    getAdapter, getERC20, getExchange, getReserve, NULL_BYTES32, Token, Tokens,
} from "./generalTypes";
import {
    AddLiquidityCommitment, CommitmentType, HistoryEvent, OrderCommitment, PersistentContainer,
    ShiftInStatus, ShiftOutStatus,
} from "./persistentContainer";

const BitcoinTx = (hash: string) => ({ hash, chain: Chain.Bitcoin });
// const ZCashTx = (hash: string) => ({ hash, chain: Chain.ZCash });
const EthereumTx = (hash: string) => ({ hash, chain: Chain.Ethereum });

export let network: NetworkDetails = NetworkTestnet;
switch (NETWORK) {
    case "development":
        network = NetworkLocalnet; break;
    case "devnet":
        network = NetworkDevnet; break;
    case "testnet":
        network = NetworkTestnet; break;
}

const initialState = {
    sdkRenVM: null as null | RenVM,
    sdkAddress: null as string | null,
    sdkWeb3: null as Web3 | null,
    sdkNetworkID: 0,
    network,
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

    public order = (id: string): HistoryEvent | undefined => this.persistentContainer.state.historyItems[id];

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        await this.setState({
            sdkWeb3: web3,
            sdkNetworkID: networkID,
            sdkRenVM: new RenVM(network),
            sdkAddress: address,
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
        const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID, network } = this.state;
        if (!web3 || !address) {
            throw new Error("Web3 address is not defined");
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        let amountBN: BigNumber;
        let tokenInstance: ERC20Detailed;
        let reserveAddress: string;

        const dex = getExchange(web3, networkID);

        if (order.commitment.type === CommitmentType.Trade) {
            const { srcToken, srcAmount, dstToken } = order.orderInputs;
            const srcTokenDetails = Tokens.get(srcToken);
            if (!srcTokenDetails) {
                throw new Error(`Unable to retrieve details for ${srcToken}`);
            }
            amountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));

            tokenInstance = getERC20(web3, network, syncGetTokenAddress(networkID, srcToken));

            reserveAddress = await dex.methods.reserves(syncGetTokenAddress(networkID, dstToken)).call();
        } else if (order.commitment.type === CommitmentType.AddLiquidity) {
            const { dstToken, srcToken } = order.orderInputs;
            amountBN = new BigNumber(order.commitment.maxDAIAmount);
            tokenInstance = getERC20(web3, network, syncGetTokenAddress(networkID, dstToken));
            reserveAddress = await dex.methods.reserves(syncGetTokenAddress(networkID, srcToken)).call();
        } else {
            throw new Error("Token approval not required");
        }

        console.log(reserveAddress);

        // Check the allowance of the token.
        // If it's not sufficient, approve the required amount.
        // NOTE: Some tokens require the allowance to be 0 before being able to
        // approve a new amount.
        const allowance = new BigNumber((await tokenInstance.methods.allowance(address, reserveAddress).call()).toString());
        if (allowance.lt(amountBN)) {
            // We don't have enough allowance so approve more
            const promiEvent = tokenInstance.methods.approve(
                reserveAddress,
                amountBN.toString()
            ).send({ from: address });
            await new Promise((resolve, reject) => promiEvent.on("transactionHash", async (transactionHash: string) => {
                resolve(transactionHash);
            }).catch(reject));
        }
    }

    public getReceipt = async (web3: Web3, transactionHash: string) => {
        // Wait for confirmation
        let receipt;
        while (!receipt || !receipt.blockHash) {
            receipt = await web3.eth.getTransactionReceipt(transactionHash);
            if (receipt && receipt.blockHash) {
                break;
            }
            await sleep(3 * 1000);
        }

        // Status might be undefined - so check against `false` explicitly.
        if (receipt.status === false) {
            throw new Error(`Transaction was reverted. { "transactionHash": "${transactionHash}" }`);
        }

        return receipt;
    }

    public submitBurnToEthereum = async (orderID: string, retry = false) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!web3 || !renVM || !address) {
            throw new Error(`Invalid values required for swap`);
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        if (retry) {
            await this.approveTokenTransfer(orderID);
        }

        // If there's a previous transaction and `retry` isn't set, reuse tx.
        let transactionHash = order.inTx && !retry ? order.inTx.hash : null;

        if (!transactionHash) {
            const txHash = NULL_BYTES32;
            const signatureBytes = NULL_BYTES32;
            let amount;
            let promiEvent: any;

            if (order.commitment.type == CommitmentType.Trade) {
                amount = order.commitment.srcAmount.toString();
                promiEvent = getAdapter(web3, networkID).methods.trade(
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
            } else if (order.commitment.type == CommitmentType.RemoveLiquidity) {
                promiEvent = getAdapter(web3, networkID).methods.removeLiquidity(
                    order.commitment.token, // _token: string
                    order.commitment.liquidity,  // _liquidity: number
                    order.commitment.nativeAddress, // _tokenAddress: string
                ).send({ from: address, gas: 350000 });
            } else {
                return;
            }

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
        await this.getReceipt(web3, transactionHash);

        try {
            await renVM.shiftOut({
                web3Provider: web3.currentProvider,
                sendToken: order.orderInputs.dstToken === Token.ZEC ? ShiftActions.ZEC.Eth2Zec : ShiftActions.BTC.Eth2Btc,
                txHash: transactionHash,
            }).readFromEthereum();
        } catch (error) {
            if (String(error.message || error).match(/No reference ID found in logs/)) {
                await this.persistentContainer.updateHistoryItem(order.id, {
                    receivedAmount: "0",
                    outTx: EthereumTx(transactionHash),
                    status: ShiftOutStatus.RefundedOnEthereum,
                });
                return;
            }
            throw error;
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
            web3Provider: web3.currentProvider,
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

    public zipPayload = (commitment: AddLiquidityCommitment | OrderCommitment) => {
        if (commitment.type === CommitmentType.Trade) {
            return [
                { name: "srcToken", type: "address", value: commitment.srcToken },
                { name: "dstToken", type: "address", value: commitment.dstToken },
                { name: "minDestinationAmount", type: "uint256", value: commitment.minDestinationAmount.toFixed() },
                { name: "toAddress", type: "bytes", value: commitment.toAddress },
                { name: "refundBlockNumber", type: "uint256", value: commitment.refundBlockNumber },
                { name: "refundAddress", type: "bytes", value: commitment.refundAddress },
            ];
        } else {
            return [
                { name: "liquidityProvider", type: "address", value: commitment.liquidityProvider },
                { name: "maxDAIAmount", type: "uint256", value: commitment.maxDAIAmount },
                { name: "token", type: "address", value: commitment.token },
                // { name: "amount", type: "uint256", value: commitment.amount },
                { name: "refundBlockNumber", type: "uint256", value: commitment.refundBlockNumber },
                { name: "refundAddress", type: "bytes", value: commitment.refundAddress },
            ];
        }
    }

    public shiftInObject = (orderID: string): ShiftInObject => {
        const { sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        console.log(order);
        console.log(order.commitment);
        console.log(order.commitment.type);

        if (order.commitment.type === CommitmentType.Trade) {
            return renVM.shiftIn({
                sendToken: order.orderInputs.srcToken === Token.ZEC ? ShiftActions.ZEC.Zec2Eth : ShiftActions.BTC.Btc2Eth,
                sendTo: syncGetDEXAdapterAddress(networkID),
                sendAmount: order.commitment.srcAmount,
                contractFn: "trade",
                contractParams: this.zipPayload(order.commitment),
                nonce: order.nonce,
                messageID: order.messageID || undefined,
            });
        } else if (order.commitment.type === CommitmentType.AddLiquidity) {
            return renVM.shiftIn({
                sendToken: order.commitment.token === Token.ZEC ? ShiftActions.ZEC.Zec2Eth : ShiftActions.BTC.Btc2Eth,
                sendTo: syncGetDEXAdapterAddress(networkID),
                sendAmount: order.commitment.amount,
                contractFn: "addLiquidity",
                contractParams: this.zipPayload(order.commitment),
                nonce: order.nonce,
                messageID: order.messageID || undefined,
            });
        } else {
            throw new Error("Trying to remove liquidity using ShiftIn");
        }
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
        await this.persistentContainer.updateHistoryItem(orderID, {
            inTx: BitcoinTx(Ox(Buffer.from(signature.response.args.utxo.txHash, "base64"))),
            status: ShiftInStatus.ReturnedFromRenVM,
        });
        return signature;
    }

    public submitMintToEthereum = async (orderID: string, retry = false) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID } = this.state;
        if (!web3 || !address) {
            throw new Error(`Invalid values required for swap`);
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        let transactionHash = order.outTx && !retry ? order.outTx.hash : null;
        let receipt: TransactionReceipt;

        if (!transactionHash) {

            if (order.commitment.type === CommitmentType.AddLiquidity) {
                await this.approveTokenTransfer(orderID);
            }

            [receipt, transactionHash] = await new Promise<[TransactionReceipt, string]>(async (resolve, reject) => {
                const promiEvent = (await this.submitMintToRenVM(orderID)).submitToEthereum(web3.currentProvider);
                promiEvent.catch((error) => {
                    reject(error);
                });
                const txHash = await new Promise<string>((resolveTx, rejectTx) => promiEvent.on("transactionHash", resolveTx).catch(rejectTx));
                await this.persistentContainer.updateHistoryItem(orderID, {
                    status: ShiftInStatus.SubmittedToEthereum,
                    outTx: EthereumTx(txHash),
                });

                // tslint:disable-next-line: no-any
                (promiEvent as any).once("confirmation", (_confirmations: number, newReceipt: TransactionReceipt) => { resolve([newReceipt, txHash]); });
            });
        } else {
            receipt = await this.getReceipt(web3, transactionHash);
        }

        // Loop through logs to find exchange event from the DEX contract.
        // The event log always has the first topic as "0x8d10c7a1"
        // TODO: Calculate this instead of hard coding it.
        console.log(`Looking through ${receipt.logs.length} logs`);
        for (const log of receipt.logs) {
            console.log(log);
            // TODO: Replace hard-coded hash with call to web3.utils.sha3.
            if (
                log.address.toLowerCase() === syncGetDEXAddress(networkID).toLowerCase() &&
                log.topics[0] === "0x8d10c7a140b316d7362354a44023c657a9c436616f21481cac1cb594aa305458".toLowerCase()
            ) {
                const data = web3.eth.abi.decodeParameters(["address", "address", "uint256", "uint256"], log.data);
                const dstTokenDetails = Tokens.get(order.orderInputs.dstToken);
                const decimals = dstTokenDetails ? dstTokenDetails.decimals : 8;
                const receivedAmountBN = new BigNumber(data[3]);
                const receivedAmount = receivedAmountBN.dividedBy(new BigNumber(10).exponentiatedBy(decimals));
                await this.persistentContainer.updateHistoryItem(order.id, {
                    receivedAmount: receivedAmount.toString(),
                    outTx: EthereumTx(transactionHash),
                    status: ShiftInStatus.ConfirmedOnEthereum,
                });
                return;
            }
        }
        await this.persistentContainer.updateHistoryItem(order.id, {
            receivedAmount: "0",
            outTx: EthereumTx(transactionHash),
            status: ShiftInStatus.RefundedOnEthereum,
        });
        return;
    }
}
