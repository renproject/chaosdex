import BigNumber from "bignumber.js";

import { Currency } from "@renex/react-components";
import { Map, OrderedMap } from "immutable";

import { _captureBackgroundException_, _captureInteractionException_ } from "../../lib/errors";
import { Record } from "../../lib/record";

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

export interface MarketDetails {
    symbol: MarketPair;
    quote: Token;
    base: Token;
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

interface Serializable<T> {
    serialize(): string;
    deserialize(str: string): T;
}

export interface ApplicationData {
    trader: TraderData;
    marketPrices: MarketPriceData;
    inputs: OrderInputsData;
    alert: AlertData;
    popup: PopupData;
}
export class OrderInputsData extends Record({
    sendToken: Token.ETH,
    receiveToken: Token.DAI,

    sendVolume: null as string | null,
    receiveVolume: "0",
    price: "0",

    allOrNothing: false,
    immediateOrCancel: false,

    inputError: null as InputError,
}) {
}

export type InputError = null | {
    error: string;
    category: "input" | "submit";
};

export enum UITheme {
    Light = "theme-light", // light theme's CSS class
    Dark = "theme-dark", // dark theme's CSS class
}
export class TraderData extends Record({
    address: null as string | null,

    // UI
    advanced: false,
    theme: UITheme.Light,
    advancedTheme: UITheme.Dark,

    // address: null as string | null,
    url: null as string | null,
    quoteCurrency: Currency.USD,
    agreedToTerms: false,
}) implements Serializable<TraderData> {
    public serialize(): string {
        return JSON.stringify({
            // address: this.address,
            agreedToTerms: this.agreedToTerms,

            advanced: this.advanced,
            theme: this.theme,
            advancedTheme: this.advancedTheme,
            quoteCurrency: this.quoteCurrency,
        });
    }

    public deserialize(str: string): TraderData {
        // tslint:disable-next-line:no-this-assignment
        let next = this;
        try {
            const data = JSON.parse(str);
            if (typeof data.agreedToTerms === "boolean") {
                next = next.set("agreedToTerms", data.agreedToTerms as boolean);
            }
            if (typeof data.advanced === "boolean") {
                next = next.set("advanced", data.advanced as boolean);
            }
            if (typeof data.theme === "string") {
                next = next.set("theme", data.theme as UITheme);
            }
            if (typeof data.advancedTheme === "string") {
                next = next.set("advancedTheme", data.advancedTheme as UITheme);
            }
            if (typeof data.quoteCurrency === "string") {
                next = next.set("quoteCurrency", data.quoteCurrency as Currency);
            }
        } catch (error) {
            _captureBackgroundException_(error, {
                description: "cannot deserialize local storage",
            });
        }
        return next;
    }
}

export interface MarketPrice {
    price: number;
    percentChange: number;
}

export const UnknownMarketPrice: MarketPrice = {
    price: 0,
    percentChange: 0,
};

export type TokenPrices = Map<Token, Map<Currency, number>>;

export class MarketPriceData extends Record({
    updating: false,
    marketPrices: OrderedMap<MarketPair, MarketPrice>(),
    tokenPrices: null as TokenPrices | null,
}) { }

export enum AlertType {
    Error = "error",
    Warning = "warning",
    Success = "success"
}

export enum LabelLevel {
    Info = "info",
    Warning = "warning"
}

export class Alert extends Record({
    alertType: AlertType.Warning,
    message: "", // TODO: Allow for links
}) { }

export class AlertData extends Record({
    pendingAlerts: Map<string, () => Promise<void>>(),
    alert: new Alert(),
}) { }

// export interface PopupDetails {
//     popup: React.ReactNode | null;
//     dismissible: boolean;
//     onCancel(): void;
// }

// export class PopupData extends Record({
//     stack: OrderedMap<Symbol, PopupDetails>(),
// }) { }

export class PopupData extends Record({
    dismissible: true,
    onCancel: (() => null) as () => void,
    popup: null as JSX.Element | null,
    overlay: false,
}) { }
