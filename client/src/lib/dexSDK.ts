import RenSDK, {
    Chain, NetworkDevnet, Shift, ShiftedInResponse, ShiftedOutResponse, Submit,
    Tokens as ShiftActions, Wait,
} from "@renproject/ren";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { Log, TransactionReceipt } from "web3-core";
import { AbiItem } from "web3-utils";

import { isERC20, MarketPair, Token, Tokens } from "../state/generalTypes";
import {
    getRenExAdapterAddress, getTokenAddress, getTokenDecimals, syncGetRenExAdapterAddress,
    syncGetRenExAddress, syncGetTokenAddress,
} from "./contractAddresses";
import { ERC20Detailed } from "./contracts/ERC20Detailed";
import { RenEx } from "./contracts/RenEx";
import { RenExAdapter } from "./contracts/RenExAdapter";
import { NETWORK } from "./environmentVariables";

// tslint:disable: non-literal-require
const ERC20ABI = require(`../contracts/devnet/ERC20.json`).abi;
const RenExABI = require(`../contracts/devnet/RenEx.json`).abi;
const RenExAdapterABI = require(`../contracts/devnet/RenExAdapter.json`).abi;

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

export class DexSDK {
    public connected: boolean = false;
    public web3: Web3;
    public networkID: number;
    public renSDK: RenSDK;
    public adapterAddress: string;

    private shiftStep1: Shift | undefined;
    private shiftStep2: Wait | undefined;
    private shiftStep3: Submit | undefined;

    constructor(web3: Web3, networkID: number) {
        this.web3 = web3;
        this.networkID = networkID;
        this.adapterAddress = syncGetRenExAdapterAddress(networkID);
        this.renSDK = new RenSDK(NetworkDevnet);
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
                console.log(`${_marketPair}: ${leftBalance.toFixed()} and ${rightBalance.toFixed()}`);
                return new Map().set(left, leftBalance).set(right, rightBalance);
            })
        );
    }

    public zipPayload = (commitment: Commitment) => [
        { name: "srcToken", type: "address", value: commitment.srcToken },
        { name: "dstToken", type: "address", value: commitment.dstToken },
        { name: "minDestinationAmount", type: "uint256", value: commitment.minDestinationAmount.toFixed() },
        { name: "toAddress", type: "bytes", value: commitment.toAddress },
        { name: "refundBlockNumber", type: "uint256", value: commitment.refundBlockNumber },
        { name: "refundAddress", type: "bytes", value: commitment.refundAddress },
    ]

    public randomNonce = () => {
        // Browser only

        // Generate 32 bytes
        const buffer = new Uint8Array(32);
        window.crypto.getRandomValues(buffer);

        // Join into hex string
        return "0x" + Array.prototype.map.call(new Uint8Array(buffer), x => ("00" + x.toString(16)).slice(-2)).join("");
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = async (token: Token, commitment: Commitment): Promise<string> => {
        this.shiftStep1 = this.renSDK.shift({
            sendToken: ShiftActions[token].Btc2Eth,
            sendTo: this.adapterAddress,
            sendAmount: commitment.srcAmount.toNumber(),
            contractFn: "trade",
            contractParams: this.zipPayload(commitment),
            nonce: this.randomNonce(),
        });
        return this.shiftStep1.addr();
    }

    // Retrieves unspent deposits at the provided address
    public waitForDeposit = async (limit = 10, confirmations = 0) => {
        if (!this.shiftStep1) {
            throw new Error("Must have generated address first");
        }
        this.shiftStep2 = await this.shiftStep1.wait(confirmations);
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitDeposit = async (): Promise<void> => {
        if (!this.shiftStep2) {
            throw new Error("Must have retrieved deposits first");
        }
        this.shiftStep3 = await this.shiftStep2.submit();
    }

    public submitSwap = (address: string, commitment: Commitment, adapterAddress: string, signatureIn?: ShiftedInResponse | ShiftedOutResponse | null) => {
        if (!this.shiftStep3) {
            throw new Error("Must have submitted deposit first");
        }
        return this.shiftStep3.signAndSubmit(this.web3, address);
    }

    // public submitBurn = async (commitment: Commitment, receivedAmountHex: string): Promise<string> => {
    //     return this.renSDK.burn(tokenToChain(commitment.orderInputs.dstToken), commitment.toAddress, receivedAmountHex);
    // }

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
}
