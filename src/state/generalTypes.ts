import { Currency } from "@renex/react-components";
import { Map } from "immutable";

export enum Token {
    DAI = "DAI",
    BTC = "BTC",
    ETH = "ETH",
    REN = "REN",
    ZEC = "ZEC"
}

export enum MarketPair {
    DAI_BTC = "DAI/BTC",
    REN_BTC = "REN/BTC",
    ETH_BTC = "ETH/BTC",
    ZEC_BTC = "ZEC/BTC",
}

export const Tokens = Map<Token, TokenDetails>()
    .set(Token.DAI, { symbol: Token.DAI, name: "Dai", decimals: 18, priority: 100 })
    .set(Token.BTC, { symbol: Token.BTC, name: "Bitcoin", decimals: 8, priority: 200 })
    .set(Token.ETH, { symbol: Token.ETH, name: "Ethereum", decimals: 18, priority: 1024 })
    .set(Token.REN, { symbol: Token.REN, name: "Ren", decimals: 18, priority: 1025 })
    .set(Token.ZEC, { symbol: Token.ZEC, name: "Zcash", decimals: 8, priority: 201 })
    ;

export interface TokenDetails {
    name: string;
    symbol: Token;
    decimals: number;
    priority: number;
}

export enum UITheme {
    Light = "theme-light", // light theme's CSS class
    Dark = "theme-dark", // dark theme's CSS class
}

export type TokenPrices = Map<Token, Map<Currency, number>>;

// tslint:disable-next-line: ban-types
export type PopupID = Symbol;
