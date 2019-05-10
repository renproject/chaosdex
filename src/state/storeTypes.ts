import { Currency } from "@renex/react-components";

import { Token, TokenPrices, UITheme } from "../store/types/general";

export interface ApplicationData {
    tokenPrices: TokenPrices;
    popup: PopupData;
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
