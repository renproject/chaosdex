import { kovan as kovanAddresses } from "@renex/contracts";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { PromiEvent } from "web3-core";
import { AbiItem } from "web3-utils";

import { MarketPair, Token, Tokens } from "../state/generalTypes";
import { tokenAddresses } from "./contractAddresses";
import { ERC20DetailedWeb3 } from "./contracts/erc20";
import { RenExWeb3 } from "./contracts/ren_ex";
import { RenExAdapterWeb3, Transaction } from "./contracts/ren_ex_adapter";
import { NETWORK } from "./environmentVariables";
import { getReadonlyWeb3, getWeb3 } from "./getWeb3";
import { Signature } from "./shiftSDK/darknode/darknodeGroup";
import { NULL_BYTES32 } from "./shiftSDK/eth/eth";
import { Chain, ShiftSDK, UTXO } from "./shiftSDK/shiftSDK";

const ERC20ABI = require("./contracts/erc20_abi.json");
const RenExABI = require("./contracts/ren_ex_abi.json");
const RenExAdapterABI = require("./contracts/ren_ex_adapter_abi.json");

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

// enum ShiftStatus {
//     WaitingForDeposit,
//     SubmittingToContract,
//     Complete,
//     Failed,
// }

// type ShiftDetails = {
//     status: ShiftStatus.WaitingForDeposit;
//     commitmentHash: string;
//     depositAddress: string;
// } | {
//     status: ShiftStatus.SubmittingToContract;
//     transactionHash: string;
// } | {
//     status: ShiftStatus.Complete;
// } | {
//     status: ShiftStatus.Failed;
// };

export type ReserveBalances = Map<Token, BigNumber>;

const RENEX_ADDRESS = "0x0dF3510a4128c0cA11518465f670dB970E9302B7";
const RENEX_ADAPTER_ADDRESS = "0x8cFbF788757e767392e707ACA1Ec18cE26e570fc";

const tokenToChain = (token: Token): Chain => {
    const tokenDetails = Tokens.get(token, undefined);
    if (!tokenDetails) {
        throw new Error(`Unable to retrieve details of token ${token}`);
    }
    return tokenDetails.chain;
};

/// Initialize Web3 and contracts

const getExchange = (web3: Web3): RenExWeb3 =>
    new (web3.eth.Contract)(RenExABI as AbiItem[], RENEX_ADDRESS);
const getERC20 = (web3: Web3, tokenAddress: string): ERC20DetailedWeb3 =>
    new (web3.eth.Contract)(ERC20ABI as AbiItem[], tokenAddress);
const getAdapter = (web3: Web3): RenExAdapterWeb3 =>
    new (web3.eth.Contract)(RenExAdapterABI as AbiItem[], RENEX_ADAPTER_ADDRESS);

/**
 * The ShiftSDK defines how to interact with the rest of this file
 *
 * @interface ShiftSDK
 */
export class DexSDK {
    public connected: boolean = false;
    public web3: Web3;
    public shiftSDK: ShiftSDK;

    constructor(web3?: Web3) {
        this.web3 = web3 || getReadonlyWeb3();
        this.shiftSDK = new ShiftSDK(this.web3, RENEX_ADAPTER_ADDRESS);
    }

    public connect = async () => {
        this.web3 = await getWeb3();
        this.connected = true;
        this.shiftSDK = new ShiftSDK(this.web3, RENEX_ADAPTER_ADDRESS);
    }

    /**
     * getPrice returns the rate at which dstToken can be received per srcToken.
     * @param srcToken The source token being spent
     * @param dstToken The destination token being received
     */
    public getReserveBalance = async (marketPairs: MarketPair[]): Promise<ReserveBalances[]> => {
        const exchange = getExchange(this.web3);

        const balance = async (token: Token, address: string): Promise<BigNumber> => {
            if (token === Token.ETH) {
                return new BigNumber((await this.web3.eth.getBalance(address)).toString());
            }
            const tokenAddress = kovanAddresses.addresses.tokens[token].address;
            const tokenInstance = getERC20(this.web3, tokenAddress);
            const decimals = kovanAddresses.addresses.tokens[token].decimals;
            const rawBalance = new BigNumber((await tokenInstance.methods.balanceOf(address).call()).toString());
            return rawBalance.dividedBy(new BigNumber(10).exponentiatedBy(decimals));
        };

        return /*await*/ Promise.all(
            marketPairs.map(async (_marketPair) => {
                const [left, right] = _marketPair.split("/") as [Token, Token];
                const leftAddress = kovanAddresses.addresses.tokens[left].address;
                const rightAddress = kovanAddresses.addresses.tokens[right].address;
                const reserve = await exchange.methods.reserve(leftAddress, rightAddress).call();
                const leftBalance = await balance(left, reserve);
                const rightBalance = await balance(right, reserve);
                return new Map().set(left, leftBalance).set(right, rightBalance);
            })
        );
    }

    public hashCommitment = async (commitment: Commitment): Promise<string> => {
        return /*await*/ getAdapter(this.web3).methods.commitment(
            commitment.srcToken,
            commitment.dstToken,
            commitment.minDestinationAmount.toNumber(),
            commitment.toAddress,
            commitment.refundBlockNumber,
            commitment.refundAddress,
        ).call();
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = async (token: Token, commitment: Commitment): Promise<string> => {
        const commitmentHash = await this.hashCommitment(commitment);
        return this.shiftSDK.generateAddress(tokenToChain(token), commitmentHash);
    }

    // Retrieves unspent deposits at the provided address
    public retrieveDeposits = async (token: Token, depositAddress: string, limit = 10, confirmations = 0): Promise<UTXO[]> => {
        return this.shiftSDK.retrieveDeposits(tokenToChain(token), depositAddress, limit, confirmations);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitDeposit = async (token: Token, transaction: UTXO, commitment: Commitment): Promise<string> => {
        return this.shiftSDK.shift(tokenToChain(token), transaction, await this.hashCommitment(commitment));
    }

    public submitSwap = (address: string, commitment: Commitment, signature?: Signature | null): PromiEvent<Transaction> => { // Promise<string> => new Promise<string>(async (resolve, reject) => {
        let amount = commitment.srcAmount.toString();
        let txHash = NULL_BYTES32;
        let signatureBytes = NULL_BYTES32;

        if (signature) {
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

        console.groupCollapsed("Swap details");
        console.log(`Commitment`);
        console.table(commitment);
        console.log(`Call parameters`);
        console.table(params);
        console.groupEnd();

        return getAdapter(this.web3).methods.trade(
            ...params,
        ).send({ from: address });
    }

    public fetchEthereumTokenBalance = async (token: Token, address: string): Promise<BigNumber> => {
        let balance: string;
        if (token === Token.ETH) {
            balance = await this.web3.eth.getBalance(address);
        } else if ([Token.REN, Token.DAI].includes(token)) {
            const tokenAddress = tokenAddresses(token, NETWORK || "");
            const tokenInstance = getERC20(this.web3, tokenAddress);
            balance = (await tokenInstance.methods.balanceOf(address).call()).toString();
        } else {
            throw new Error(`Invalid Ethereum token: ${token}`);
        }
        return new BigNumber(balance);
    }

    public setTokenAllowance = async (amount: BigNumber, token: Token, address: string): Promise<BigNumber> => {
        const tokenAddress = tokenAddresses(token, NETWORK || "");
        const tokenInstance = getERC20(this.web3, tokenAddress);

        const allowance = await tokenInstance.methods.allowance(address, getAdapter(this.web3).address).call();
        const allowanceBN = new BigNumber(allowance.toString());
        if (allowanceBN.gte(amount)) {
            return allowanceBN;
        }

        // We don't have enough allowance so approve more
        const promiEvent = tokenInstance.methods.approve(
            getAdapter(this.web3).address,
            amount.toString()
        ).send({ from: address });
        let transactionHash: string | undefined;
        transactionHash = await new Promise((resolve, reject) => promiEvent.on("transactionHash", resolve));
        console.log(`Approving ${amount.toString()} ${token} Tx hash: ${transactionHash}`);
        return amount;
    }

    // Retrieves the current progress of the shift
    public shiftStatus = async (commitmentHash: string): Promise<Signature> => {
        return this.shiftSDK.shiftStatus(commitmentHash);
    }
}
