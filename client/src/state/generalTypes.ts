import { Currency } from "@renex/react-components";
import { Chain } from "@renproject/ren";
import { Map } from "immutable";
import { validate } from "wallet-address-validator";
import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { syncGetDEXAdapterAddress, syncGetDEXAddress } from "../lib/contractAddresses";
import { DEX } from "../lib/contracts/DEX";
import { DEXAdapter } from "../lib/contracts/DEXAdapter";
import { ERC20Detailed } from "../lib/contracts/ERC20Detailed";

export enum Token {
    DAI = "DAI",
    BTC = "BTC",
    ETH = "ETH",
    // REN = "REN",
    ZEC = "ZEC"
}

export enum MarketPair {
    DAI_BTC = "DAI/BTC",
    // DAI_ZEC = "DAI/ZEC",
    // REN_BTC = "REN/BTC",
    // ETH_BTC = "ETH/BTC",
    // ZEC_BTC = "ZEC/BTC",
}

const btcValidator = (address: string) => validate(address, "btc", "testnet");
const zecValidator = (address: string) => validate(address, "zec", "testnet");
const ethValidator = (address: string) => validate(address, "eth", "testnet");

export const Tokens = Map<Token, TokenDetails>()
    .set(Token.DAI, { symbol: Token.DAI, name: "Dai", decimals: 18, priority: 100, chain: Chain.Ethereum, validator: ethValidator })
    .set(Token.BTC, { symbol: Token.BTC, name: "Bitcoin", decimals: 8, priority: 200, chain: Chain.Bitcoin, validator: btcValidator })
    .set(Token.ETH, { symbol: Token.ETH, name: "Ethereum", decimals: 18, priority: 1024, chain: Chain.Ethereum, validator: ethValidator })
    // .set(Token.REN, { symbol: Token.REN, name: "Ren", decimals: 18, priority: 1025, chain: Chain.Ethereum, validator: ethValidator })
    .set(Token.ZEC, { symbol: Token.ZEC, name: "Zcash", decimals: 8, priority: 201, chain: Chain.Zcash, validator: zecValidator })
    ;

export const isEthereumBased = (token: Token) => {
    const details = Tokens.get(token);
    if (!details) {
        return false;
    }
    return details.chain === Chain.Ethereum;
};

export const isERC20 = (token: Token) => isEthereumBased(token) && token !== Token.ETH;

export interface TokenDetails {
    name: string;
    symbol: Token;
    decimals: number;
    priority: number;
    chain: Chain;
    validator: (address: string) => boolean;
}

export type TokenPrices = Map<Token, Map<Currency, number>>;

// tslint:disable: non-literal-require
const ERC20ABI = require(`../contracts/testnet/ERC20.json`).abi;
const DEXABI = require(`../contracts/testnet/DEX.json`).abi;
const DEXAdapterABI = require(`../contracts/testnet/DEXAdapter.json`).abi;

export const NULL_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

/// Initialize Web3 and contracts
export const getExchange = (web3: Web3, networkID: number): DEX =>
    new web3.eth.Contract(DEXABI as AbiItem[], syncGetDEXAddress(networkID));
export const getERC20 = (web3: Web3, tokenAddress: string): ERC20Detailed =>
    new (web3.eth.Contract)(ERC20ABI as AbiItem[], tokenAddress);
export const getAdapter = (web3: Web3, networkID: number): DEXAdapter =>
    new (web3.eth.Contract)(DEXAdapterABI as AbiItem[], syncGetDEXAdapterAddress(networkID));
