import BigNumber from "bignumber.js";
import Web3 from "web3";

import { AbiItem } from "web3-utils";
import { MarketPair, Token } from "../store/types/general";
import { EXCHANGE, INFURA_URL } from "./environmentVariables";

import { ERC20DetailedWeb3 } from "./contracts/erc20";
import * as ERC20ABI from "./contracts/erc20_abi.json";
import { RenExWeb3 } from "./contracts/ren_ex";
import * as RenExABI from "./contracts/ren_ex_abi.json";


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

/**
 * The ShiftSDK defines how to interact with the rest of this file
 *
 * @interface ShiftSDK
 */
interface ShiftSDK {
    getReserveBalance(marketPairs: MarketPair[]): Promise<Array<Map<Token, BigNumber>>>;
    submitCommitment(commitment: Commitment): Promise<ShiftDetails>;
    getCommitmentStatus(commitmentHash: string): Promise<ShiftDetails>;
}

/// Initialize Web3 and contracts

const getWeb3 = () => new Web3(INFURA_URL);
const getExchange = (web3?: Web3): RenExWeb3 =>
    new ((web3 || getWeb3()).eth.Contract)(RenExABI as AbiItem[], EXCHANGE);
const getERC20 = (tokenAddress: string, web3?: Web3): ERC20DetailedWeb3 =>
    new ((web3 || getWeb3()).eth.Contract)(ERC20ABI as AbiItem[], tokenAddress);

/**
 * getPrice returns the rate at which dstToken can be received per srcToken.
 * @param srcToken The source token being spent
 * @param dstToken The destination token being received
 */
const getReserveBalance = async (marketPairs: MarketPair[]): Promise<Array<Map<Token, BigNumber>>> => {
    const web3 = getWeb3();
    const exchange = getExchange(web3);
    return Promise.all(
        marketPairs.map(async (_marketPair) => {
            const [left, right] = _marketPair.split("/") as [Token, Token];
            const leftAddress = left;
            const rightAddress = right;
            const reserve = await exchange.methods.reserve(leftAddress, rightAddress).call();
            const leftToken = getERC20(leftAddress, web3);
            const leftBalance = new BigNumber((await leftToken.methods.balanceOf(reserve).call()).toString());
            const rightToken = getERC20(rightAddress, web3);
            const rightBalance = new BigNumber((await rightToken.methods.balanceOf(reserve).call()).toString());
            return new Map([[left, leftBalance], [right, rightBalance]]);
        })
    );
};

/**
 * hashCommitment
 *
 * @param {Commitment} commitment
 * @returns {CommitmentHash}
 */
const submitCommitment = async (commitment: Commitment): Promise<ShiftDetails> => {
    return { status: ShiftStatus.Failed };
};

/**
 * getShiftStatus
 *
 * @param {CommitmentHash} commitmentHash
 * @returns {ShiftDetails}
 */
const getCommitmentStatus = async (commitmentHash: string): Promise<ShiftDetails> => {
    return { status: ShiftStatus.Failed };
};

const sdk: ShiftSDK = {
    getReserveBalance,
    submitCommitment,
    getCommitmentStatus,
};

module.exports = sdk;
