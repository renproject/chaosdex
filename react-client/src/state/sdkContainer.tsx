import GatewayJS from "@renproject/gateway-js";
import { sleep } from "@renproject/react-components";
import RenJS, { NetworkDetails, ShiftInObject, Signature, TxStatus, UTXO } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { Container } from "unstated";
import Web3 from "web3";
import { PromiEvent, TransactionReceipt } from "web3-core";
import { Args, ShiftInEvent, ShiftInStatus, ShiftOutStatus } from "@renproject/ren-js-common";

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
    RemoveLiquidityCommitment,
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

    public approveTokenTransfer = async (order: HistoryEvent) => {

        // TODO: Check that the sdkAddress is the same as the address in the
        // commitment - otherwise this step fails.

        const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID, network: networkDetails } = this.state;
        if (!web3 || !address) {
            throw new Error("Web3 address is not defined");
        }

        let amountBN: BigNumber;
        let amountReadable: string;
        let tokenInstance: ERC20Detailed;
        let receivingAddress: string;
        let tokenSymbol: string;

        const dex = getExchange(web3, networkID);

        if (order.commitment.type === CommitmentType.Trade) {
            const { srcToken, srcAmount } = order.orderInputs;
            const srcTokenDetails = Tokens.get(srcToken);
            if (!srcTokenDetails) {
                throw new Error(`Unable to retrieve details for ${srcToken}`);
            }
            amountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
            amountReadable = srcAmount;

            tokenInstance = getERC20(web3, networkDetails, syncGetTokenAddress(networkID, srcToken));
            tokenSymbol = srcToken.toUpperCase();

            receivingAddress = syncGetDEXAdapterAddress(networkID);
        } else if (order.commitment.type === CommitmentType.AddLiquidity) {
            const { dstToken, srcToken } = order.orderInputs;

            amountBN = new BigNumber(order.commitment.maxDAIAmount);
            amountReadable = amountBN.div(new BigNumber(10).exponentiatedBy(18)).decimalPlaces(2).toString();

            tokenInstance = getERC20(web3, networkDetails, syncGetTokenAddress(networkID, dstToken));
            tokenSymbol = dstToken.toUpperCase();

            receivingAddress = (await dex.methods.reserves(syncGetTokenAddress(networkID, srcToken)).call()) || NULL_BYTES;
        } else {
            throw new Error("Token approval not required");
        }

        const balance = new BigNumber(((await tokenInstance.methods.balanceOf(address).call()) || 0).toString());
        if (balance.lt(amountBN)) {
            throw new InfoError(`Insufficient ${tokenSymbol} balance - required: ${amountReadable} ${tokenSymbol}`);
        }

        // Check the allowance of the token.
        // If it's not sufficient, approve the required amount.
        // NOTE: Some tokens require the allowance to be 0 before being able to
        // approve a new amount.
        const allowance = new BigNumber(((await tokenInstance.methods.allowance(address, receivingAddress).call()) || 0).toString());
        if (allowance.lt(amountBN)) {
            // We don't have enough allowance so approve more
            const promiEvent = tokenInstance.methods.approve(
                receivingAddress,
                amountBN.toString()
            ).send({ from: address });
            await new Promise((resolve, reject) => promiEvent.on("transactionHash", async (transactionHash: string) => {
                resolve(transactionHash);
            }).catch((error: Error) => {
                if (error && error.message && String(error.message).match(/Invalid "from" address/)) {
                    error.message += ` (from address: ${address})`;
                }
                reject(error);
            }));
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

    public shiftOut = async (order: HistoryEvent, checkHistory = false) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!web3 || !renVM || !address) {
            throw new Error(`Invalid values required for swap`);
        }

        if (order.commitment.type === CommitmentType.AddLiquidity) {
            throw new Error(`Adding liquidity does not need to call shiftOut.`);
        }

        let amount;

        let to: string;

        const gw = new GatewayJS("testnet");

        if (checkHistory) {
            const orders = await gw.getGateways();
            const previousOrder = orders.get(order.nonce);
            if (previousOrder) {
                await gw.open(previousOrder).result();
                await this.persistentContainer.updateHistoryItem(order.id, {
                    status: ShiftOutStatus.ReturnedFromRenVM,
                });
                return;
            }
        }

        if (order.commitment.type === CommitmentType.Trade) {
            to = getAdapter(web3, networkID).address;
            await this.approveTokenTransfer(order);
            amount = order.commitment.srcAmount.toString();
        } else if (order.commitment.type === CommitmentType.RemoveLiquidity) {
            const reserveAddress = syncGetDEXReserveAddress(networkID, order.orderInputs.srcToken);
            const reserve = getReserve(web3, networkID, reserveAddress);
            const promiEvent2 = reserve.methods.approve(
                syncGetDEXAdapterAddress(networkID),
                order.commitment.liquidity,
            ).send({ from: address });
            await new Promise<string>((resolve, reject) => promiEvent2.on("transactionHash", resolve).catch(reject));
            to = getAdapter(web3, networkID).address;
        } else {
            return;
        }

        const burnToken = order.orderInputs.dstToken === Token.DAI ? order.orderInputs.srcToken : order.orderInputs.dstToken;
        // @ts-ignore
        await gw.open({
            sendToken: RenJS.Tokens[burnToken].Burn,
            sendTo: getAdapter(web3, networkID).address,
            contractFn: "trade",
            contractParams: this.zipPayloadShiftOut(order.commitment),
            txConfig: { from: address, gas: 550000 },
            nonce: order.nonce,
        }).result();

        await this.persistentContainer.updateHistoryItem(order.id, {
            status: ShiftOutStatus.ReturnedFromRenVM,
        });
    }

    public zipPayloadShiftOut = (commitment: OrderCommitment | RemoveLiquidityCommitment): Args => {
        if (commitment.type === CommitmentType.Trade) {
            return [
                { name: "srcToken", type: "address", value: commitment.srcToken },
                { name: "dstToken", type: "address", value: commitment.dstToken },
                { name: "minDestinationAmount", type: "uint256", value: commitment.minDestinationAmount },
                { name: "toAddress", type: "bytes", value: commitment.toAddress },
                { name: "refundBlockNumber", type: "uint256", value: commitment.refundBlockNumber },
                { name: "refundAddress", type: "bytes", value: commitment.refundAddress },
                { name: "amount", type: "uint256", value: commitment.srcAmount.toString() }, // _amount: BigNumber
                { name: "txHash", type: "bytes32", value: NULL_BYTES32 }, // _hash: string
                { name: "signatureBytes", type: "bytes", value: Buffer.from([]) }, // _sig: string
            ];
        } else {
            return [
                { name: "token", type: "address", value: commitment.token }, // _token: string
                { name: "liquidity", type: "uint256", value: commitment.liquidity },  // _liquidity: number
                { name: "nativeAddress", type: "bytes", value: commitment.nativeAddress }, // _tokenAddress: string
            ];
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Trading BTC to DAI //////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Trading BTC to DAI involves the following steps:
    // 1. Generate a gateway address
    // 2. Wait for a deposit to the address
    // 3. Submit the deposit to RenVM and retrieve back a signature
    // 4. Submit the signature to Ethereum, creating zBTC & swapping it for DAI

    public zipPayload = (commitment: AddLiquidityCommitment | OrderCommitment): Args => {
        if (commitment.type === CommitmentType.Trade) {
            return [
                { name: "srcToken", type: "address", value: commitment.srcToken },
                { name: "dstToken", type: "address", value: commitment.dstToken },
                { name: "minDestinationAmount", type: "uint256", value: commitment.minDestinationAmount },
                { name: "toAddress", type: "bytes", value: commitment.toAddress },
                { name: "refundBlockNumber", type: "uint256", value: commitment.refundBlockNumber },
                { name: "refundAddress", type: "bytes", value: commitment.refundAddress },
            ];
        } else if (commitment.type === CommitmentType.AddLiquidity) {
            return [
                { name: "liquidityProvider", type: "address", value: commitment.liquidityProvider },
                { name: "maxDAIAmount", type: "uint256", value: commitment.maxDAIAmount },
                { name: "token", type: "address", value: commitment.token },
                // { name: "amount", type: "uint256", value: commitment.amount },
                { name: "refundBlockNumber", type: "uint256", value: commitment.refundBlockNumber },
                { name: "refundAddress", type: "bytes", value: commitment.refundAddress },
            ];
        } else {
            throw new Error(`Invalid commitment ${commitment}`);
        }
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shiftIn = async (order: HistoryEvent, checkHistory = false) => {
        const { sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }

        const gw = new GatewayJS("testnet");

        if (checkHistory) {
            const orders = await gw.getGateways();
            const previousOrder = orders.get(order.nonce);
            if (previousOrder) {
                await gw.open(previousOrder).result();
                await this.persistentContainer.updateHistoryItem(order.id, {
                    status: ShiftInStatus.ConfirmedOnEthereum,
                });
                return;
            }
        }

        if (order.commitment.type === CommitmentType.Trade) {
            await gw.open({
                shiftIn: true,
                id: order.id,
                time: order.time,
                inTx: order.inTx,
                outTx: order.outTx,
                messageID: order.messageID,
                renVMStatus: order.renVMStatus,
                status: order.status as ShiftInStatus,
                shiftParams: {
                    sendToken: order.orderInputs.srcToken === Token.ZEC ? RenJS.Tokens.ZEC.Zec2Eth : order.orderInputs.srcToken === Token.BCH ? RenJS.Tokens.BCH.Bch2Eth : RenJS.Tokens.BTC.Btc2Eth,
                    sendTo: syncGetDEXAdapterAddress(networkID),
                    sendAmount: order.commitment.srcAmount,
                    contractFn: "trade",
                    contractParams: this.zipPayload(order.commitment),
                    nonce: order.nonce,
                },
            }).result();
            await this.persistentContainer.updateHistoryItem(order.id, {
                status: ShiftInStatus.ConfirmedOnEthereum,
            });
        } else if (order.commitment.type === CommitmentType.AddLiquidity) {
            await gw.open({
                shiftIn: true,
                id: order.id,
                time: order.time,
                inTx: order.inTx,
                outTx: order.outTx,
                messageID: order.messageID,
                renVMStatus: order.renVMStatus,
                status: order.status as ShiftInStatus,
                shiftParams: {
                    sendToken: order.orderInputs.srcToken === Token.ZEC ? RenJS.Tokens.ZEC.Zec2Eth : order.orderInputs.srcToken === Token.BCH ? RenJS.Tokens.BCH.Bch2Eth : RenJS.Tokens.BTC.Btc2Eth,
                    sendTo: syncGetDEXAdapterAddress(networkID),
                    sendAmount: order.commitment.amount,
                    contractFn: "addLiquidity",
                    contractParams: this.zipPayload(order.commitment),
                    nonce: order.nonce,
                },
            }).result();
            await this.persistentContainer.updateHistoryItem(order.id, {
                status: ShiftInStatus.ConfirmedOnEthereum,
            });
        } else {
            throw new Error("Trying to remove liquidity using ShiftIn");
        }
    }
}
