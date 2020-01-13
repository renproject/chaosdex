import { sleep } from "@renproject/react-components";
import RenJS, { NetworkDetails, ShiftInObject, Signature, TxStatus, UTXO } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { Container } from "unstated";
import Web3 from "web3";
import { PromiEvent, TransactionReceipt } from "web3-core";
import { GatewayJS } from "@renproject/gateway-js";

import {
    syncGetDEXAdapterAddress, syncGetDEXAddress, syncGetDEXReserveAddress, syncGetTokenAddress,
} from "../lib/contractAddresses";
import { ERC20Detailed } from "../lib/contracts/ERC20Detailed";
import { NETWORK } from "../lib/environmentVariables";
import { _catchBackgroundErr_, InfoError } from "../lib/errors";
import {
    getAdapter, getERC20, getExchange, getReserve, NULL_BYTES, NULL_BYTES32, Token, Tokens,
} from "./generalTypes";
import {
    AddLiquidityCommitment, CommitmentType, HistoryEvent, OrderCommitment, PersistentContainer,
    ShiftInStatus, ShiftOutStatus,
} from "./persistentContainer";
import { OrderInputs } from "./uiContainer";

const BitcoinTx = (hash: string) => ({ hash, chain: RenJS.Chains.Bitcoin });
const ZCashTx = (hash: string) => ({ hash, chain: RenJS.Chains.Zcash });
const BitcoinCashTx = (hash: string) => ({ hash, chain: RenJS.Chains.BitcoinCash });
const EthereumTx = (hash: string) => ({ hash, chain: RenJS.Chains.Ethereum });

export let network: NetworkDetails = RenJS.NetworkDetails.NetworkTestnet;
switch (NETWORK) {
    case "development":
        network = RenJS.NetworkDetails.stringToNetwork("localnet"); break;
    case "devnet":
        network = RenJS.NetworkDetails.stringToNetwork("devnet"); break;
    case "testnet":
        network = RenJS.NetworkDetails.NetworkTestnet; break;
    case "chaosnet":
        network = RenJS.NetworkDetails.NetworkChaosnet; break;
}

const initialState = {
    sdkRenVM: null as null | RenJS,
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

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        await this.setState({
            sdkWeb3: web3,
            sdkNetworkID: networkID,
            sdkRenVM: new RenJS(network),
            sdkAddress: address,
        });
    }

    public liquidityBalance = async (srcToken: Token) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID } = this.state;
        if (!web3 || !address) {
            return;
        }
        // const exchange = getExchange(web3, networkID);
        const reserveAddress = syncGetDEXReserveAddress(networkID, srcToken);
        const reserve = getReserve(web3, networkID, reserveAddress);
        return new BigNumber((await reserve.methods.balanceOf(address).call() || "0").toString());
    }

    ////////////////////////////////////////////////////////////////////////////
    // Trading DAI to BTC //////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Trading DAI to BTC involves three steps:
    // 1. Approve transfer of the DAI token
    // 2. Swap DAI for zBTC and burn the zBTC
    // 3. Submit the burn to the darknodes

    // public approveTokenTransfer = async (orderID: string) => {

    //     // TODO: Check that the sdkAddress is the same as the address in the
    //     // commitment - otherwise this step fails.

    //     const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID, network: networkDetails } = this.state;
    //     if (!web3 || !address) {
    //         throw new Error("Web3 address is not defined");
    //     }
    //     const order = this.order(orderID);
    //     if (!order) {
    //         throw new Error("Order not set");
    //     }

    //     let amountBN: BigNumber;
    //     let amountReadable: string;
    //     let tokenInstance: ERC20Detailed;
    //     let receivingAddress: string;
    //     let tokenSymbol: string;

    //     const dex = getExchange(web3, networkID);

    //     if (order.commitment.type === CommitmentType.Trade) {
    //         const { srcToken, srcAmount } = order.orderInputs;
    //         const srcTokenDetails = Tokens.get(srcToken);
    //         if (!srcTokenDetails) {
    //             throw new Error(`Unable to retrieve details for ${srcToken}`);
    //         }
    //         amountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
    //         amountReadable = srcAmount;

    //         tokenInstance = getERC20(web3, networkDetails, syncGetTokenAddress(networkID, srcToken));
    //         tokenSymbol = srcToken.toUpperCase();

    //         receivingAddress = syncGetDEXAdapterAddress(networkID);
    //     } else if (order.commitment.type === CommitmentType.AddLiquidity) {
    //         const { dstToken, srcToken } = order.orderInputs;

    //         amountBN = new BigNumber(order.commitment.maxDAIAmount);
    //         amountReadable = amountBN.div(new BigNumber(10).exponentiatedBy(18)).decimalPlaces(2).toString();

    //         tokenInstance = getERC20(web3, networkDetails, syncGetTokenAddress(networkID, dstToken));
    //         tokenSymbol = dstToken.toUpperCase();

    //         receivingAddress = (await dex.methods.reserves(syncGetTokenAddress(networkID, srcToken)).call()) || NULL_BYTES;
    //     } else {
    //         throw new Error("Token approval not required");
    //     }

    //     const balance = new BigNumber(((await tokenInstance.methods.balanceOf(address).call()) || 0).toString());
    //     if (balance.lt(amountBN)) {
    //         throw new InfoError(`Insufficient ${tokenSymbol} balance - required: ${amountReadable} ${tokenSymbol}`);
    //     }

    //     // Check the allowance of the token.
    //     // If it's not sufficient, approve the required amount.
    //     // NOTE: Some tokens require the allowance to be 0 before being able to
    //     // approve a new amount.
    //     const allowance = new BigNumber(((await tokenInstance.methods.allowance(address, receivingAddress).call()) || 0).toString());
    //     if (allowance.lt(amountBN)) {
    //         // We don't have enough allowance so approve more
    //         const promiEvent = tokenInstance.methods.approve(
    //             receivingAddress,
    //             amountBN.toString()
    //         ).send({ from: address });
    //         await new Promise((resolve, reject) => promiEvent.on("transactionHash", async (transactionHash: string) => {
    //             resolve(transactionHash);
    //         }).catch((error: Error) => {
    //             if (error && error.message && String(error.message).match(/Invalid "from" address/)) {
    //                 error.message += ` (from address: ${address})`;
    //             }
    //             reject(error);
    //         }));
    //     }
    // }

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

    public shiftOut = async (order: HistoryEvent) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!web3 || !renVM || !address) {
            throw new Error(`Invalid values required for swap`);
        }

        // If there's a previous transaction and `retry` isn't set, reuse tx.
        let transactionHash = order.inTx ? order.inTx.hash : null;

        if (!transactionHash) {
            const txHash = NULL_BYTES32;
            const signatureBytes = NULL_BYTES32;
            let amount;
            // tslint:disable-next-line: no-any
            let promiEvent: PromiEvent<unknown>;

            if (order.commitment.type === CommitmentType.Trade) {
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
            } else if (order.commitment.type === CommitmentType.RemoveLiquidity) {
                const reserveAddress = syncGetDEXReserveAddress(networkID, order.orderInputs.srcToken);
                const reserve = getReserve(web3, networkID, reserveAddress);
                const promiEvent2 = reserve.methods.approve(
                    syncGetDEXAdapterAddress(networkID),
                    order.commitment.liquidity,
                ).send({ from: address });
                await new Promise<string>((resolve, reject) => promiEvent2.on("transactionHash", resolve).catch(reject));
                promiEvent = getAdapter(web3, networkID).methods.removeLiquidity(
                    order.commitment.token, // _token: string
                    order.commitment.liquidity,  // _liquidity: number
                    order.commitment.nativeAddress, // _tokenAddress: string
                ).send({ from: address, gas: 550000 });
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
            const burnToken = order.orderInputs.dstToken === Token.DAI ? order.orderInputs.srcToken : order.orderInputs.dstToken;
            await renVM.shiftOut({
                web3Provider: web3.currentProvider,
                sendToken: RenJS.Tokens[burnToken].Burn,
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
                { name: "minDestinationAmount", type: "uint256", value: commitment.minDestinationAmount },
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

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shiftIn = async (order: HistoryEvent) => {
        const { sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }

        const gw = new GatewayJS("http://localhost:3344");

        if (order.commitment.type === CommitmentType.Trade) {
            await gw.open({
                sendToken: order.orderInputs.srcToken === Token.ZEC ? RenJS.Tokens.ZEC.Zec2Eth : order.orderInputs.srcToken === Token.BCH ? RenJS.Tokens.BCH.Bch2Eth : RenJS.Tokens.BTC.Btc2Eth,
                sendTo: syncGetDEXAdapterAddress(networkID),
                sendAmount: order.commitment.srcAmount,
                contractFn: "trade",
                contractParams: this.zipPayload(order.commitment),
                nonce: order.nonce,
            });
            await this.persistentContainer.updateHistoryItem(order.id, {
                status: ShiftInStatus.ConfirmedOnEthereum,
            });
        } else if (order.commitment.type === CommitmentType.AddLiquidity) {
            await gw.open({
                sendToken: order.orderInputs.srcToken === Token.ZEC ? RenJS.Tokens.ZEC.Zec2Eth : order.orderInputs.srcToken === Token.BCH ? RenJS.Tokens.BCH.Bch2Eth : RenJS.Tokens.BTC.Btc2Eth,
                sendTo: syncGetDEXAdapterAddress(networkID),
                sendAmount: order.commitment.amount,
                contractFn: "addLiquidity",
                contractParams: this.zipPayload(order.commitment),
                nonce: order.nonce,
            });
            await this.persistentContainer.updateHistoryItem(order.id, {
                status: ShiftInStatus.ConfirmedOnEthereum,
            });
        } else {
            throw new Error("Trying to remove liquidity using ShiftIn");
        }
    }
}
