import { Currency } from "@renex/react-components";
import { Map } from "immutable";
import { validate } from "wallet-address-validator";

import { Chain } from "../lib/shiftSDK/shiftSDK";

export enum Token {
    DAI = "DAI",
    BTC = "BTC",
    ETH = "ETH",
    REN = "REN",
    ZEC = "ZEC"
}

export enum MarketPair {
    DAI_BTC = "DAI/BTC",
    DAI_ZEC = "DAI/ZEC",
    REN_BTC = "REN/BTC",
    ETH_BTC = "ETH/BTC",
    ZEC_BTC = "ZEC/BTC",
}

const btcValidator = (address: string) => validate(address, "btc", "testnet");
const zecValidator = (address: string) => validate(address, "zec", "testnet");
const ethValidator = (address: string) => validate(address, "eth", "testnet");

export const Tokens = Map<Token, TokenDetails>()
    .set(Token.DAI, { symbol: Token.DAI, name: "Dai", decimals: 18, priority: 100, chain: Chain.Ethereum, validator: ethValidator })
    .set(Token.BTC, { symbol: Token.BTC, name: "Bitcoin", decimals: 8, priority: 200, chain: Chain.Bitcoin, validator: btcValidator })
    .set(Token.ETH, { symbol: Token.ETH, name: "Ethereum", decimals: 18, priority: 1024, chain: Chain.Ethereum, validator: ethValidator })
    .set(Token.REN, { symbol: Token.REN, name: "Ren", decimals: 18, priority: 1025, chain: Chain.Ethereum, validator: ethValidator })
    .set(Token.ZEC, { symbol: Token.ZEC, name: "Zcash", decimals: 8, priority: 201, chain: Chain.ZCash, validator: zecValidator })
    ;

export interface TokenDetails {
    name: string;
    symbol: Token;
    decimals: number;
    priority: number;
    chain: Chain;
    validator: (address: string) => boolean;
}

export enum UITheme {
    Light = "theme-light", // light theme's CSS class
    Dark = "theme-dark", // dark theme's CSS class
}

export type TokenPrices = Map<Token, Map<Currency, number>>;

// tslint:disable-next-line: ban-types
export type PopupID = Symbol;
