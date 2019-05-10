import BigNumber from "bignumber.js";
import Web3 from "web3";

import { AbiItem } from "web3-utils";
import { MarketPair } from "../store/types/general";
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
    getReserveBalance(marketPairs: MarketPair[]): Promise<BigNumber[]>;
    submitCommitment(commitment: Commitment): Promise<ShiftDetails>;
    getCommitmentStatus(commitmentHash: string): Promise<ShiftDetails>;
}

const getWeb3 = () => new Web3(INFURA_URL);
const getExchange = (web3?: Web3) => new ((web3 || getWeb3()).eth.Contract)(RenExABI as AbiItem[], EXCHANGE);
const getERC20 = (tokenAddress: string, web3?: Web3) => new ((web3 || getWeb3()).eth.Contract)(ERC20ABI as AbiItem[], tokenAddress);

/**
 * getPrice returns the rate at which dstToken can be received per srcToken.
 * @param srcToken The source token being spent
 * @param dstToken The destination token being received
 */
const getReserveBalance = async (marketPairs: MarketPair[]): Promise<BigNumber[]> => {
    const exchange = getExchange();
    return marketPairs.map((_marketPair) => {
        return new BigNumber(0);
    });
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
