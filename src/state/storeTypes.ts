import { Currency } from "@renex/react-components";
import { Map } from "immutable";

import { ReserveBalances } from "../lib/shiftSDK";
import { MarketPair, Token, TokenPrices, UITheme } from "./generalTypes";

export interface ApplicationData {
    tokenPrices: TokenPrices;
    balanceReserves: Map<MarketPair, ReserveBalances>;
    popup: PopupData;
    order: OrderData;
}

export interface OrderData {
    sendToken: Token;
    receiveToken: Token;
    sendVolume: string;
    receiveVolume: string;
}

export interface OptionsData {
    preferredCurrency: Currency;
    theme: UITheme;
}

export interface PopupData {
    dismissible: boolean;
    onCancel: () => void;
    popup: JSX.Element | null;
    overlay: boolean;
}
