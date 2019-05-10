import BigNumber from "bignumber.js";

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
    getReserveBalance(tokens: string[]): BigNumber[];
    submitCommitment(commitment: Commitment): ShiftDetails;
    getCommitmentStatus(commitmentHash: string): ShiftDetails;
}

/**
 * getPrice returns the rate at which dstToken can be received per srcToken.
 * @param srcToken The source token being spent
 * @param dstToken The destination token being received
 */
const getReserveBalance = (tokens: string[]): BigNumber[] => {
    return tokens.map(() => new BigNumber(0));
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
