import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { keccak256 } from "web3-utils";

import { createBTCTestnetAddress } from "./blockchain/btc";
import { intToBuffer, strip0x } from "./blockchain/common";
import { createZECTestnetAddress } from "./blockchain/zec";

export type Commitment = number | string | Buffer | Array<string | number | Buffer>;
const commitmentToBuffer = (commitment: Commitment): Buffer => {
    if (typeof commitment === "string") {
        return Buffer.from(strip0x(commitment), "hex");
    } else if (typeof commitment === "number") {
        return intToBuffer(commitment);
    } else if (Buffer.isBuffer(commitment)) {
        return commitment;
    } else if (Array.isArray(commitment)) {
        // TODO: Use RLP encoding
        return Buffer.concat(commitment.map(commitmentToBuffer));
    }
    throw new Error("Unable to serialize commitment for hashing. Supported formats: hex string, buffer or array of primitives.");
};
const hashCommitment = (commitment: Commitment) =>
    keccak256(commitmentToBuffer(commitment).toString("hex"));

export enum Chain {
    Bitcoin = "bitcoin",
    Ethereum = "ethereum",
    ZCash = "zcash",
}

export class SDK {
    private readonly web3: Web3;
    private readonly adapter: Contract;

    // Takes the address of the adapter smart contract
    constructor(web3: Web3, adapterAddress: string) {
        this.web3 = web3;
        this.adapter = new web3.eth.Contract([], adapterAddress);
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = (chain: Chain, commitment: Commitment): string => {
        switch (chain) {
            case Chain.Bitcoin:
                return createBTCTestnetAddress(this.adapter.address, hashCommitment(commitment));
            case Chain.ZCash:
                return createZECTestnetAddress(this.adapter.address, hashCommitment(commitment));
            default:
                throw new Error(`Unable to generate deposit address for chain ${chain}`);
        }
    }

    // Retrieves unspent deposits at the provided address
    public retrieveDeposits = async (chain: Chain, address: string): Promise<string[]> => {
        console.debug(this.web3);
        return [];
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shift = async (chain: Chain, transactionHash: string, commitment: Commitment): Promise<void> => {
        return;
    }

    // Retrieves the current progress of the shift
    public shiftStatus = async (commitmentHash: string): Promise<string> => {
        return "";
    }
}
