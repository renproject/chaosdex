import RenSDK, {
    NetworkTestnet, ShiftedInResponse, ShiftedOutResponse, ShiftInObject, Signature,
    Tokens as ShiftActions,
} from "@renproject/ren";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { Log, PromiEvent, TransactionReceipt } from "web3-core";
import { AbiItem } from "web3-utils";

import { isERC20, MarketPair, Token } from "../state/generalTypes";
import {
    getTokenAddress, getTokenDecimals, syncGetDEXAdapterAddress, syncGetDEXAddress,
    syncGetTokenAddress,
} from "./contractAddresses";
import { DEX } from "./contracts/DEX";
import { DEXAdapter } from "./contracts/DEXAdapter";
import { ERC20Detailed } from "./contracts/ERC20Detailed";

// tslint:disable: non-literal-require
const ERC20ABI = require(`../contracts/testnet/ERC20.json`).abi;
const DEXABI = require(`../contracts/testnet/DEX.json`).abi;
const DEXAdapterABI = require(`../contracts/testnet/DEXAdapter.json`).abi;

const NULL_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

interface Transaction { receipt: TransactionReceipt; tx: string; logs: Log[]; }

export interface OrderInputs {
    srcToken: Token;
    dstToken: Token;
    srcAmount: string;
    dstAmount: string;
}

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

export type ReserveBalances = Map<Token, BigNumber>;

/// Initialize Web3 and contracts
const getExchange = (web3: Web3, networkID: number): DEX =>
    new web3.eth.Contract(DEXABI as AbiItem[], syncGetDEXAddress(networkID));
const getERC20 = (web3: Web3, tokenAddress: string): ERC20Detailed =>
    new (web3.eth.Contract)(ERC20ABI as AbiItem[], tokenAddress);
const getAdapter = (web3: Web3, networkID: number): DEXAdapter =>
    new (web3.eth.Contract)(DEXAdapterABI as AbiItem[], syncGetDEXAdapterAddress(networkID));

export class DexSDK {
    public connected: boolean = false;
    public web3: Web3;
    public networkID: number;
    public renSDK: RenSDK;
    public adapterAddress: string;

    private shiftStep1: ShiftInObject | undefined;
    private shiftStep2: ShiftInObject | undefined;
    private shiftStep3: Signature | undefined;

    constructor(web3: Web3, networkID: number) {
        this.web3 = web3;
        this.networkID = networkID;
        this.adapterAddress = syncGetDEXAdapterAddress(networkID);
        this.renSDK = new RenSDK(NetworkTestnet);
    }

    /**
     * getPrice returns the rate at which dstToken can be received per srcToken.
     * @param srcToken The source token being spent
     * @param dstToken The destination token being received
     */
    public getReserveBalance = async (marketPairs: MarketPair[]): Promise<ReserveBalances[]> => {
        const web3 = this.web3;
        const exchange = getExchange(web3, this.networkID);

        const balance = async (token: Token, reserve: string): Promise<BigNumber> => {
            if (token === Token.ETH) {
                return new BigNumber((await web3.eth.getBalance(reserve)).toString());
            }
            const tokenAddress = syncGetTokenAddress(this.networkID, token);
            const tokenInstance = getERC20(web3, tokenAddress);
            const decimals = getTokenDecimals(token);
            const rawBalance = new BigNumber((await tokenInstance.methods.balanceOf(reserve).call()).toString());
            return rawBalance.dividedBy(new BigNumber(10).exponentiatedBy(decimals));
        };

        return Promise.all(
            marketPairs.map(async (_marketPair) => {
                const [left, right] = _marketPair.split("/") as [Token, Token];
                const leftAddress = syncGetTokenAddress(this.networkID, left);
                const rightAddress = syncGetTokenAddress(this.networkID, right);
                const reserve = await exchange.methods.reserve(leftAddress, rightAddress).call();
                const leftBalance = await balance(left, reserve);
                const rightBalance = await balance(right, reserve);
                console.log(`${_marketPair}: ${leftBalance.toFixed()} and ${rightBalance.toFixed()}`);
                return new Map().set(left, leftBalance).set(right, rightBalance);
            })
        );
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
    public generateAddress = async (token: Token, commitment: Commitment): Promise<string> => {
        this.shiftStep1 = this.renSDK.shiftIn({
            sendToken: ShiftActions[token].Btc2Eth,
            sendTo: this.adapterAddress,
            sendAmount: commitment.srcAmount.toNumber(),
            contractFn: "trade",
            contractParams: this.zipPayload(commitment),
        });
        return this.shiftStep1.addr();
    }

    // Retrieves unspent deposits at the provided address
    public waitForDeposit = async (limit = 10, confirmations = 0) => {
        if (!this.shiftStep1) {
            throw new Error("Must have generated address first");
        }
        this.shiftStep2 = await this.shiftStep1.waitForDeposit(confirmations);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitDeposit = async (onMessageID: (messageID: string) => void): Promise<void> => {
        if (!this.shiftStep2) {
            throw new Error("Must have retrieved deposits first");
        }
        this.shiftStep3 = await this.shiftStep2.submitToRenVM().on("messageID", onMessageID);
    }

    public createShiftOutObject = (token: Token, txHash: string) => {
        return this.renSDK.shiftOut({ web3Provider: this.web3.currentProvider, sendToken: ShiftActions[token].Eth2Btc, txHash });
    }

    public submitSwap = (address: string, commitment: Commitment, adapterAddress: string, signatureIn?: ShiftedInResponse | ShiftedOutResponse | null) => {
        if (!this.shiftStep3) {
            throw new Error("Must have submitted deposit first");
        }
        return this.shiftStep3.submitToEthereum(this.web3.currentProvider, address);
    }

    public submitBurn = (address: string, commitment: Commitment): PromiEvent<Transaction> => { // Promise<string> => new Promise<string>(async (resolve, reject) => {
        const amount = commitment.srcAmount.toString();
        const txHash = NULL_BYTES32;
        const signatureBytes = NULL_BYTES32;

        return getAdapter(this.web3, this.networkID).methods.trade(
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
    }

    public fetchEthereumTokenBalance = async (token: Token, address: string): Promise<BigNumber> => {
        let balance: string;
        if (token === Token.ETH) {
            balance = await this.web3.eth.getBalance(address);
        } else if (isERC20(token)) {
            const tokenAddress = syncGetTokenAddress(this.networkID, token);
            const tokenInstance = getERC20(this.web3, tokenAddress);
            balance = (await tokenInstance.methods.balanceOf(address).call()).toString();
        } else {
            throw new Error(`Invalid Ethereum token: ${token}`);
        }
        return new BigNumber(balance);
    }

    public getTokenAllowance = async (token: Token, address: string): Promise<BigNumber> => {
        const tokenAddress = syncGetTokenAddress(this.networkID, token);
        const tokenInstance = getERC20(this.web3, tokenAddress);

        const allowance = await tokenInstance.methods.allowance(address, (getAdapter(this.web3, this.networkID)).address).call();

        return new BigNumber(allowance.toString());
    }

    public setTokenAllowance = async (amount: BigNumber, token: Token, address: string): Promise<BigNumber> => {
        const allowanceBN = await this.getTokenAllowance(token, address);

        if (allowanceBN.gte(amount)) {
            return allowanceBN;
        }

        const tokenAddress = syncGetTokenAddress(this.networkID, token);
        const tokenInstance = getERC20(this.web3, tokenAddress);

        // We don't have enough allowance so approve more
        const promiEvent = tokenInstance.methods.approve(
            (getAdapter(this.web3, this.networkID)).address,
            amount.toString()
        ).send({ from: address });
        await new Promise((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));
        return amount;
    }
}
