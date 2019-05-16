import { kovan as kovanAddresses } from "@renex/contracts";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { MarketPair, Token } from "../state/generalTypes";
import { ERC20DetailedWeb3 } from "./contracts/erc20";
import { RenExWeb3 } from "./contracts/ren_ex";
import { getReadonlyWeb3, getWeb3 } from "./getWeb3";

const ERC20ABI = require("./contracts/erc20_abi.json");
const RenExABI = require("./contracts/ren_ex_abi.json");

interface Commitment {
    srcToken: string;
    dstToken: string;
    minDestinationAmount: BigNumber;
    toAddress: string;
    refundBlockNumber: number;
    refundAddress: string;
}

enum ShiftStatus {
    WaitingForDeposit,
    SubmittingToContract,
    Complete,
    Failed,
}

type ShiftDetails = {
    status: ShiftStatus.WaitingForDeposit;
    commitmentHash: string;
    depositAddress: string;
} | {
    status: ShiftStatus.SubmittingToContract;
    transactionHash: string;
} | {
    status: ShiftStatus.Complete;
} | {
    status: ShiftStatus.Failed;
};

export type ReserveBalances = Map<Token, BigNumber>;

/// Initialize Web3 and contracts

const getExchange = (web3: Web3): RenExWeb3 =>
    new (web3.eth.Contract)(RenExABI as AbiItem[], "0x0dF3510a4128c0cA11518465f670dB970E9302B7");
const getERC20 = (web3: Web3, tokenAddress: string): ERC20DetailedWeb3 =>
    new (web3.eth.Contract)(ERC20ABI as AbiItem[], tokenAddress);

/**
 * The ShiftSDK defines how to interact with the rest of this file
 *
 * @interface ShiftSDK
 */
export class DexSDK {
    public connected: boolean = false;
    public web3: Web3;

    constructor(web3?: Web3) {
        this.web3 = web3 || getReadonlyWeb3();
    }

    public connect = async () => {
        this.web3 = await getWeb3();
        this.connected = true;
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

    /**
     * hashCommitment
     *
     * @param {Commitment} commitment
     * @returns {CommitmentHash}
     */
    public submitCommitment = async (commitment: Commitment): Promise<ShiftDetails> => {
        return { status: ShiftStatus.Failed };
    }

    /**
     * getShiftStatus
     *
     * @param {CommitmentHash} commitmentHash
     * @returns {ShiftDetails}
     */
    public getCommitmentStatus = async (commitmentHash: string): Promise<ShiftDetails> => {
        return { status: ShiftStatus.Failed };
    }
}
