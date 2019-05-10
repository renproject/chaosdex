import BigNumber from "bignumber.js";
import Web3 from "web3";

import { AbiItem } from "web3-utils";
import { MarketPair } from "../store/types/general";
import { EXCHANGE, INFURA_URL } from "./environmentVariables";

import * as ERC20ABI from "./ERC20ABI.json";
import * as exchangeABI from "./exchangeABI.json";

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
    getReserveBalance(marketPairs: MarketPair[]): BigNumber[];
    submitCommitment(commitment: Commitment): ShiftDetails;
    getCommitmentStatus(commitmentHash: string): ShiftDetails;
}

const getWeb3 = () => new Web3(INFURA_URL);
const getExchange = (web3?: Web3) => new ((web3 || getWeb3()).eth.Contract)(exchangeABI as AbiItem[], EXCHANGE);
const getERC20 = (tokenAddress: string, web3?: Web3) => new ((web3 || getWeb3()).eth.Contract)(ERC20ABI as AbiItem[], tokenAddress);

/**
 * getPrice returns the rate at which dstToken can be received per srcToken.
 * @param srcToken The source token being spent
 * @param dstToken The destination token being received
 */
const getReserveBalance = (marketPairs: MarketPair[]): BigNumber[] => {
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
const submitCommitment = (commitment: Commitment): ShiftDetails => {
    return { status: ShiftStatus.Failed };
};

/**
 * getShiftStatus
 *
 * @param {CommitmentHash} commitmentHash
 * @returns {ShiftDetails}
 */
const getCommitmentStatus = (commitmentHash: string): ShiftDetails => {
    return { status: ShiftStatus.Failed };
};

const sdk: ShiftSDK = {
    getReserveBalance,
    submitCommitment,
    getCommitmentStatus,
};

module.exports = sdk;
