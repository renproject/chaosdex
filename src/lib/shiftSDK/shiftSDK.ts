import Web3 from "web3";
import { Contract } from "web3-eth-contract";

import { BitcoinUTXO, createBTCTestnetAddress, getBTCTestnetUTXOs } from "./blockchain/btc";
import { createZECTestnetAddress, getZECTestnetUTXOs, ZcashUTXO } from "./blockchain/zec";
import { lightnodes, ShifterGroup, Signature } from "./darknode/darknodeGroup";

// export type Commitment = number | string | Buffer | Array<string | number | Buffer>;
// const commitmentToBuffer = (commitment: Commitment): Buffer => {
//     if (typeof commitment === "string") {
//         return Buffer.from(strip0x(commitment), "hex");
//     } else if (typeof commitment === "number") {
//         return intToBuffer(commitment);
//     } else if (Buffer.isBuffer(commitment)) {
//         return commitment;
//     } else if (Array.isArray(commitment)) {
//         // TODO: Use RLP encoding
//         return Buffer.concat(commitment.map(commitmentToBuffer));
//     }
//     throw new Error("Unable to serialize commitment for hashing. Supported formats: hex string, buffer or array of primitives.");
// };
// const hashCommitment = (commitment: Commitment) =>
//     keccak256(commitmentToBuffer(commitment).toString("hex"));

export type UTXO = { chain: Chain.Bitcoin, utxo: BitcoinUTXO } | { chain: Chain.ZCash, utxo: ZcashUTXO };

export enum Chain {
    Bitcoin = "btc",
    Ethereum = "eth",
    ZCash = "zec",
}

export class ShiftSDK {
    // private readonly web3: Web3;
    private readonly adapter: Contract;
    private readonly darknodeGroup: ShifterGroup;

    // Takes the address of the adapter smart contract
    constructor(web3: Web3, adapterAddress: string) {
        // this.web3 = web3;
        this.adapter = new web3.eth.Contract([], adapterAddress);
        this.darknodeGroup = new ShifterGroup(lightnodes);
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = (chain: Chain, commitmentHash: string): string => {
        switch (chain) {
            case Chain.Bitcoin:
                return createBTCTestnetAddress(this.adapter.address, commitmentHash);
            case Chain.ZCash:
                return createZECTestnetAddress(this.adapter.address, commitmentHash);
            default:
                throw new Error(`Unable to generate deposit address for chain ${chain}`);
        }
    }

    // Retrieves unspent deposits at the provided address
    public retrieveDeposits = async (chain: Chain, depositAddress: string, limit = 10, confirmations = 0): Promise<UTXO[]> => {
        switch (chain) {
            case Chain.Bitcoin:
                return (await getBTCTestnetUTXOs(depositAddress, limit, confirmations)).map(utxo => ({ chain: Chain.Bitcoin, utxo }));
            case Chain.ZCash:
                return (await getZECTestnetUTXOs(depositAddress, limit, confirmations)).map(utxo => ({ chain: Chain.ZCash, utxo }));
            default:
                throw new Error(`Unable to retrieve deposits for chain ${chain}`);
        }
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shift = async (chain: Chain, transaction: UTXO, commitmentHash: string): Promise<string> => {
        const responses = await this.darknodeGroup.submitDeposits(chain, this.adapter.address, commitmentHash);
        const first = responses.first(undefined);
        if (first === undefined) {
            throw new Error(`No response from lightnodes`);
        }
        return first.messageID;
    }

    // Retrieves the current progress of the shift
    public shiftStatus = async (messageID: string): Promise<Signature> => {
        return /*await*/ this.darknodeGroup.checkForResponse(messageID);
    }
}
