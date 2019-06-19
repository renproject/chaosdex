import RenSDK, { Chain, ShiftedInResponse, ShiftedOutResponse, UTXO } from "@renproject/ren";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { Log, PromiEvent, TransactionReceipt } from "web3-core";
import { AbiItem, soliditySha3 } from "web3-utils";

import { isERC20, MarketPair, Token, Tokens } from "../state/generalTypes";
import {
    getTokenAddress, getTokenDecimals, syncGetRenExAdapterAddress, syncGetRenExAddress,
    syncGetTokenAddress,
} from "./contractAddresses";
import { ERC20Detailed } from "./contracts/ERC20Detailed";
import { RenEx } from "./contracts/RenEx";
import { RenExAdapter } from "./contracts/RenExAdapter";

const ERC20ABI = require("../contracts/ERC20.json").abi;
const RenExABI = require("../contracts/RenEx.json").abi;
const RenExAdapterABI = require("../contracts/RenExAdapter.json").abi;

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

const tokenToChain = (token: Token): Chain => {
    const tokenDetails = Tokens.get(token, undefined);
    if (!tokenDetails) {
        throw new Error(`Unable to retrieve details of token ${token}`);
    }
    return tokenDetails.chain;
};

/// Initialize Web3 and contracts
const getExchange = (web3: Web3, networkID: number): RenEx =>
    new web3.eth.Contract(RenExABI as AbiItem[], syncGetRenExAddress(networkID));
const getERC20 = (web3: Web3, tokenAddress: string): ERC20Detailed =>
    new (web3.eth.Contract)(ERC20ABI as AbiItem[], tokenAddress);
const getAdapter = (web3: Web3, networkID: number): RenExAdapter =>
    new (web3.eth.Contract)(RenExAdapterABI as AbiItem[], syncGetRenExAdapterAddress(networkID));
const syncGetAdapter = (web3: Web3, address: string): RenExAdapter =>
    new (web3.eth.Contract)(RenExAdapterABI as AbiItem[], address);

export class DexSDK {
    public connected: boolean = false;
    public web3: Web3;
    public networkID: number;
    public renSDK: RenSDK;

    constructor(web3: Web3, networkID: number) {
        this.web3 = web3;
        this.networkID = networkID;
        this.renSDK = new RenSDK(this.web3, syncGetRenExAdapterAddress(networkID));
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
                return new Map().set(left, leftBalance).set(right, rightBalance);
            })
        );
    }

    public hashCommitment = async (commitment: Commitment): Promise<string> => {
        return soliditySha3(
            { type: "address", value: commitment.srcToken }, // _src
            { type: "address", value: commitment.dstToken }, // _dst
            { type: "uint256", value: commitment.minDestinationAmount.toFixed() }, // _minDstAmt
            { type: "bytes", value: commitment.toAddress }, // ,
            { type: "uint256", value: commitment.refundBlockNumber.toString() }, // _refundBN
            { type: "bytes", value: commitment.refundAddress }, // _refundAddress
        );
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = async (token: Token, commitment: Commitment): Promise<string> => {
        const commitmentHash = await this.hashCommitment(commitment);
        return this.renSDK.generateAddress(tokenToChain(token), commitmentHash);
    }

    // Retrieves unspent deposits at the provided address
    public retrieveDeposits = async (token: Token, depositAddress: string, limit = 10, confirmations = 0): Promise<UTXO[]> => {
        return this.renSDK.retrieveDeposits(tokenToChain(token), depositAddress, limit, confirmations);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitDeposit = async (token: Token, transaction: UTXO, commitment: Commitment): Promise<string> => {
        return this.renSDK.shift(tokenToChain(token), transaction, await this.hashCommitment(commitment));
    }

    public submitSwap = (address: string, commitment: Commitment, adapterAddress: string, signatureIn?: ShiftedInResponse | ShiftedOutResponse | null): PromiEvent<Transaction> => { // Promise<string> => new Promise<string>(async (resolve, reject) => {
        let amount = commitment.srcAmount.toString();
        let txHash = NULL_BYTES32;
        let signatureBytes = NULL_BYTES32;

        if (signatureIn) {
            const signature: ShiftedInResponse = signatureIn as ShiftedInResponse;
            amount = `0x${signature.amount}`; // _amount: BigNumber
            txHash = `0x${signature.txHash}`; // _hash: string
            if (signature.v === "") {
                signature.v = "0";
            }
            const v = ((parseInt(signature.v, 10) + 27) || 27).toString(16);
            signatureBytes = `0x${signature.r}${signature.s}${v}`;
        }

        const params: [string, string, number, string, number, string, string, string, string] = [
            commitment.srcToken, // _src: string
            commitment.dstToken, // _dst: string
            commitment.minDestinationAmount.toNumber(), // _minDstAmt: BigNumber
            commitment.toAddress, // _to: string
            commitment.refundBlockNumber, // _refundBN: BigNumber
            commitment.refundAddress, // _refundAddress: string
            amount, // _amount: BigNumber
            txHash, // _hash: string
            signatureBytes, // _sig: string
        ];

        return (syncGetAdapter(this.web3, adapterAddress)).methods.trade(
            ...params,
        ).send({ from: address, gas: 350000 });
    }

    public submitBurn = async (commitment: Commitment, receivedAmountHex: string): Promise<string> => {
        return this.renSDK.burn(tokenToChain(commitment.orderInputs.dstToken), commitment.toAddress, receivedAmountHex);
    }

    public fetchEthereumTokenBalance = async (token: Token, address: string): Promise<BigNumber> => {
        let balance: string;
        if (token === Token.ETH) {
            balance = await this.web3.eth.getBalance(address);
        } else if (isERC20(token)) {
            const tokenAddress = await getTokenAddress(token);
            const tokenInstance = getERC20(this.web3, tokenAddress);
            balance = (await tokenInstance.methods.balanceOf(address).call()).toString();
        } else {
            throw new Error(`Invalid Ethereum token: ${token}`);
        }
        return new BigNumber(balance);
    }

    public getTokenAllowance = async (token: Token, address: string): Promise<BigNumber> => {
        const tokenAddress = await getTokenAddress(token);
        const tokenInstance = getERC20(this.web3, tokenAddress);

        const allowance = await tokenInstance.methods.allowance(address, (getAdapter(this.web3, this.networkID)).address).call();

        return new BigNumber(allowance.toString());
    }

    public setTokenAllowance = async (amount: BigNumber, token: Token, address: string): Promise<BigNumber> => {
        const allowanceBN = await this.getTokenAllowance(token, address);

        if (allowanceBN.gte(amount)) {
            return allowanceBN;
        }

        const tokenAddress = await getTokenAddress(token);
        const tokenInstance = getERC20(this.web3, tokenAddress);

        // We don't have enough allowance so approve more
        const promiEvent = tokenInstance.methods.approve(
            (getAdapter(this.web3, this.networkID)).address,
            amount.toString()
        ).send({ from: address });
        await new Promise((resolve, reject) => promiEvent.on("transactionHash", resolve));
        return amount;
    }

    // Retrieves the current progress of the shift
    public shiftStatus = async (commitmentHash: string): Promise<ShiftedInResponse | ShiftedOutResponse> => {
        return this.renSDK.shiftStatus(commitmentHash);
    }
}
