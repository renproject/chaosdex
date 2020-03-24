import GatewayJS from "@renproject/gateway";
import { EthType } from "@renproject/interfaces";
import { sleep } from "@renproject/react-components";
import RenJS from "@renproject/ren";
import { EthArgs, ShiftInStatus, ShiftOutStatus } from "@renproject/ren-js-common";
import { NetworkDetails } from "@renproject/utils";
import BigNumber from "bignumber.js";
import { Container } from "unstated";
import Web3 from "web3";

import {
    syncGetDEXAdapterAddress, syncGetDEXReserveAddress, syncGetTokenAddress,
} from "../lib/contractAddresses";
import { ERC20Detailed } from "../lib/contracts/ERC20Detailed";
import { NETWORK } from "../lib/environmentVariables";
// tslint:disable-next-line: ordered-imports
import { _catchBackgroundErr_, InfoError } from "../lib/errors";
import {
    getAdapter, getERC20, getExchange, getReserve, NULL_BYTES, NULL_BYTES32, Token, Tokens,
} from "./generalTypes";
import {
    AddLiquidityCommitment, CommitmentType, HistoryEvent, OrderCommitment, PersistentContainer,
    RemoveLiquidityCommitment,
} from "./persistentContainer";

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

            return {
                sendTo: tokenInstance.address,
                contractFn: "approve",
                contractParams: [
                    { type: "address" as EthType, name: "spender", value: receivingAddress },
                    { type: "uint256" as EthType, name: "amount", value: amountBN.toFixed() },
                ],
            };
            // // We don't have enough allowance so approve more
            // const promiEvent = tokenInstance.methods.approve(
            //     receivingAddress,
            //     amountBN.toString()
            // ).send({ from: address });
            // await new Promise((resolve, reject) => promiEvent.on("transactionHash", async (transactionHash: string) => {
            //     resolve(transactionHash);
            // }).catch((error: Error) => {
            //     if (error && error.message && String(error.message).match(/Invalid "from" address/)) {
            //         error.message += ` (from address: ${address})`;
            //     }
            //     reject(error);
            // }));
        }

        return undefined;
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

        const gw = new GatewayJS(NETWORK);

        if (checkHistory) {
            const orders = await gw.getGateways();
            const previousOrder = orders.get(order.nonce);
            if (previousOrder) {
                await gw.recoverShift(web3.currentProvider, previousOrder).result();
                await this.persistentContainer.updateHistoryItem(order.id, {
                    status: ShiftOutStatus.ReturnedFromRenVM,
                });
                return;
            }
        }

        let approveContractCall;

        if (order.commitment.type === CommitmentType.Trade) {
            to = getAdapter(web3, networkID).address;
            approveContractCall = await this.approveTokenTransfer(order);
            amount = order.commitment.srcAmount.toString();
        } else if (order.commitment.type === CommitmentType.RemoveLiquidity) {
            const reserveAddress = syncGetDEXReserveAddress(networkID, order.orderInputs.srcToken);
            const reserve = getReserve(web3, networkID, reserveAddress);
            approveContractCall = {
                sendTo: reserve.address,
                contractFn: "approve",
                contractParams: [
                    { type: "address" as EthType, name: "spender", value: syncGetDEXAdapterAddress(networkID) },
                    { type: "uint256" as EthType, name: "amount", value: order.commitment.liquidity.toFixed() },
                ],
            };
            // const promiEvent2 = reserve.methods.approve(
            //     syncGetDEXAdapterAddress(networkID),
            //     order.commitment.liquidity,
            // ).send({ from: address });
            // await new Promise<string>((resolve, reject) => promiEvent2.on("transactionHash", resolve).catch(reject));
            to = getAdapter(web3, networkID).address;
        } else {
            return;
        }

        const burnToken = order.orderInputs.dstToken === Token.DAI ? order.orderInputs.srcToken : order.orderInputs.dstToken;
        // @ts-ignore
        await gw.recoverShift(web3.currentProvider, {
            shiftIn: false,
            id: order.id,
            time: order.time,
            inTx: order.inTx,
            outTx: order.outTx,
            renTxHash: order.renTxHash,
            renVMStatus: order.renVMStatus,
            status: order.status as ShiftInStatus,
            shiftParams: {
                sendToken: RenJS.Tokens[burnToken].Burn,
                contractCalls: approveContractCall ? [approveContractCall, {
                    sendTo: getAdapter(web3, networkID).address,
                    contractFn: order.commitment.type === CommitmentType.Trade ? "trade" : "removeLiquidity",
                    contractParams: this.zipPayloadShiftOut(order.commitment),
                    txConfig: { from: address, gas: 550000 },
                }] : [{
                    sendTo: getAdapter(web3, networkID).address,
                    contractFn: order.commitment.type === CommitmentType.Trade ? "trade" : "removeLiquidity",
                    contractParams: this.zipPayloadShiftOut(order.commitment),
                    txConfig: { from: address, gas: 550000 },
                }],
                nonce: order.nonce,
            }
        }).result();

        await this.persistentContainer.updateHistoryItem(order.id, {
            status: ShiftOutStatus.ReturnedFromRenVM,
        });
    }

    public zipPayloadShiftOut = (commitment: OrderCommitment | RemoveLiquidityCommitment): EthArgs => {
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

    public zipPayload = (commitment: AddLiquidityCommitment | OrderCommitment): EthArgs => {
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
        const { sdkWeb3: web3, sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!web3 || !renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }

        const gw = new GatewayJS(NETWORK);

        if (checkHistory) {
            const orders = await gw.getGateways();
            const previousOrder = orders.get(order.nonce);
            if (previousOrder) {
                await gw.recoverShift(web3.currentProvider, previousOrder).result();
                await this.persistentContainer.updateHistoryItem(order.id, {
                    status: ShiftInStatus.ConfirmedOnEthereum,
                });
                return;
            }
        }

        if (order.commitment.type === CommitmentType.Trade) {
            await gw.recoverShift(web3.currentProvider, {
                shiftIn: true,
                id: order.id,
                time: order.time,
                inTx: order.inTx,
                outTx: order.outTx,
                renTxHash: order.renTxHash,
                renVMStatus: order.renVMStatus,
                renVMQuery: null,
                status: order.status as ShiftInStatus,
                returned: false,
                shiftParams: {
                    sendToken: order.orderInputs.srcToken === Token.ZEC ? RenJS.Tokens.ZEC.Zec2Eth : order.orderInputs.srcToken === Token.BCH ? RenJS.Tokens.BCH.Bch2Eth : RenJS.Tokens.BTC.Btc2Eth,
                    // @ts-ignore
                    suggestedAmount: order.commitment.srcAmount,
                    requiredAmount: undefined,
                    renTxHash: undefined,
                    contractCalls: [{
                        sendTo: syncGetDEXAdapterAddress(networkID),
                        contractFn: "trade",
                        contractParams: this.zipPayload(order.commitment),
                    }],
                    nonce: order.nonce || "",
                },
            }).result();
            await this.persistentContainer.updateHistoryItem(order.id, {
                status: ShiftInStatus.ConfirmedOnEthereum,
            });
        } else if (order.commitment.type === CommitmentType.AddLiquidity) {
            const approveContractCall = await this.approveTokenTransfer(order);
            await gw.open({
                shiftIn: true,
                id: order.id,
                time: order.time,
                inTx: order.inTx,
                outTx: order.outTx,
                renTxHash: order.renTxHash,
                renVMStatus: order.renVMStatus,
                status: order.status as ShiftInStatus,
                returned: false,
                shiftParams: {
                    sendToken: order.orderInputs.srcToken === Token.ZEC ? RenJS.Tokens.ZEC.Zec2Eth : order.orderInputs.srcToken === Token.BCH ? RenJS.Tokens.BCH.Bch2Eth : RenJS.Tokens.BTC.Btc2Eth,
                    suggestedAmount: order.commitment.amount,
                    renTxHash: undefined,
                    requiredAmount: undefined,
                    contractCalls: approveContractCall ? [approveContractCall, {
                        sendTo: syncGetDEXAdapterAddress(networkID),
                        contractFn: "addLiquidity",
                        contractParams: this.zipPayload(order.commitment),
                        txConfig: { gas: 550000 },
                    }] : [{
                        sendTo: syncGetDEXAdapterAddress(networkID),
                        contractFn: "addLiquidity",
                        contractParams: this.zipPayload(order.commitment),
                        txConfig: { gas: 550000 },
                    }],
                    nonce: order.nonce,
                },
                // tslint:disable-next-line: no-any
            } as any).result();
            await this.persistentContainer.updateHistoryItem(order.id, {
                status: ShiftInStatus.ConfirmedOnEthereum,
            });
        } else {
            throw new Error("Trying to remove liquidity using ShiftIn");
        }
    }
}
