import { kovan as kovanAddresses } from "@renex/contracts";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { MarketPair, Token, Tokens } from "../state/generalTypes";
import { ERC20DetailedWeb3 } from "./contracts/erc20";
import { RenExWeb3 } from "./contracts/ren_ex";
import { getReadonlyWeb3, getWeb3 } from "./getWeb3";
import { Chain, ShiftSDK, UTXO } from "./shiftSDK/shiftSDK";

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

const RENEX_ADDRESS = "0x0dF3510a4128c0cA11518465f670dB970E9302B7";
const RENEX_ADAPTER_ADDRESS = "0x8cFbF788757e767392e707ACA1Ec18cE26e570fc";

/// Initialize Web3 and contracts

const getExchange = (web3: Web3): RenExWeb3 =>
    new (web3.eth.Contract)(RenExABI as AbiItem[], RENEX_ADDRESS);
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

    public hashCommitment = (commitment: Commitment): string => {
        return "";
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = (token: Token, commitment: Commitment): string => {
        const tokenDetails = Tokens.get(token, undefined)
        if (!tokenDetails) {
            throw new Error(`Unable to retrieve details of token ${token}`);
        }
        return this.shiftSDK.generateAddress(tokenDetails.chain, this.hashCommitment(commitment));
    }

    // Retrieves unspent deposits at the provided address
    public retrieveDeposits = async (chain: Chain, depositAddress: string, limit = 10, confirmations = 0): Promise<UTXO[]> => {
        return this.shiftSDK.retrieveDeposits(chain, depositAddress, limit, confirmations);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public shift = async (chain: Chain, transaction: UTXO, commitment: Commitment): Promise<void> => {
        return this.shiftSDK.shift(chain, transaction, this.hashCommitment(commitment));
    }

    // Retrieves the current progress of the shift
    public shiftStatus = async (commitmentHash: string): Promise<string> => {
        return this.shiftSDK.shiftStatus(commitmentHash);
    }
}
