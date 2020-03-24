import { Currency } from "@renproject/react-components";
import RenJS from "@renproject/ren";
import { Chain } from "@renproject/ren-js-common";
import { NetworkDetails } from "@renproject/utils";
import { isMainnetAddress, isTestnetAddress } from "bchaddrjs";
import { Map } from "immutable";
import { validate } from "wallet-address-validator";
import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { syncGetDEXAdapterAddress, syncGetDEXAddress } from "../lib/contractAddresses";
import { DEX } from "../lib/contracts/DEX";
import { DEXAdapter } from "../lib/contracts/DEXAdapter";
import { DEXReserve } from "../lib/contracts/DEXReserve";
import { ERC20Detailed } from "../lib/contracts/ERC20Detailed";

export enum Token {
    DAI = "DAI",
    BTC = "BTC",
    ETH = "ETH",
    ZEC = "ZEC",
    BCH = "BCH",
}

export const renderToken = (token: Token): string => token === Token.DAI ? "SAI" : token;

const btcValidator = (address: string, isTestnet: boolean) => validate(address, "btc", isTestnet ? "testnet" : "prod");
const zecValidator = (address: string, isTestnet: boolean) => validate(address, "zec", isTestnet ? "testnet" : "prod");
const bchValidator = (address: string, isTestnet: boolean) => {
    try {
        return isTestnet ? isTestnetAddress(address) : isMainnetAddress(address);
    } catch (error) {
        return false;
    }
};
const ethValidator = (address: string, isTestnet: boolean) => validate(address, "eth", isTestnet ? "testnet" : "prod");

export const Tokens = Map<Token, TokenDetails>()
    .set(Token.DAI, { symbol: "SAI", name: "Sai", decimals: 18, priority: 100, chain: RenJS.Chains.Ethereum, validator: ethValidator })
    .set(Token.BTC, { symbol: Token.BTC, name: "Bitcoin", decimals: 8, priority: 200, chain: RenJS.Chains.Bitcoin, validator: btcValidator })
    // .set(Token.ETH, { symbol: Token.ETH, name: "Ethereum", decimals: 18, priority: 1024, chain: RenJS.Chains.Ethereum, validator: ethValidator })
    .set(Token.ZEC, { symbol: Token.ZEC, name: "Zcash", decimals: 8, priority: 201, chain: RenJS.Chains.Zcash, validator: zecValidator })
    .set(Token.BCH, { symbol: Token.BCH, name: "Bitcoin Cash", decimals: 8, priority: 202, chain: RenJS.Chains.BitcoinCash, validator: bchValidator })
    ;

export const isEthereumBased = (token: Token) => {
    const details = Tokens.get(token);
    if (!details) {
        return false;
    }
    return details.chain === RenJS.Chains.Ethereum;
};

export const isERC20 = (token: Token) => isEthereumBased(token) && token !== Token.ETH;

export interface TokenDetails {
    name: string;
    symbol: string;
    decimals: number;
    priority: number;
    chain: Chain.Ethereum | Chain.Bitcoin | Chain.Zcash | Chain.BitcoinCash;
    validator: (address: string, isTestnet: boolean) => boolean;
}

export type TokenPrices = Map<Token, Map<Currency, number>>;

// tslint:disable: non-literal-require
const network = process.env.REACT_APP_NETWORK || "testnet";
const DEXABI = require(`../contracts/${network}/DEX.json`).abi;
const DEXAdapterABI = require(`../contracts/${network}/DEXAdapter.json`).abi;
const DEXReserveABI = require(`../contracts/${network}/BTC_DAI_Reserve.json`).abi;

export const NULL_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const NULL_BYTES = "0x0000000000000000000000000000000000000000";

/// Initialize Web3 and contracts
export const getExchange = (web3: Web3, networkID: number): DEX =>
    new web3.eth.Contract(DEXABI as AbiItem[], syncGetDEXAddress(networkID));
export const getERC20 = (web3: Web3, networkDetails: NetworkDetails, tokenAddress: string): ERC20Detailed =>
    new (web3.eth.Contract)(networkDetails.contracts.addresses.erc.ERC20.abi, tokenAddress);
export const getAdapter = (web3: Web3, networkID: number): DEXAdapter =>
    new (web3.eth.Contract)(DEXAdapterABI as AbiItem[], syncGetDEXAdapterAddress(networkID));
export const getReserve = (web3: Web3, _networkID: number, tokenAddress: string): DEXReserve =>
    new (web3.eth.Contract)(DEXReserveABI as AbiItem[], tokenAddress); // syncGetDEXReserveAddress(networkID, token));
