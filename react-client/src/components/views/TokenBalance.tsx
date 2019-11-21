import * as React from "react";

import { Currency } from "@renproject/react-components";
import { BigNumber } from "bignumber.js";

import { Token, TokenPrices } from "../../state/generalTypes";

export const TokenBalance: React.SFC<TokenAmountConversionOptions> = (props) => {
    const { group, token, convertTo, tokenPrices, digits, toReadable, decimals } = props;

    let amount = new BigNumber(props.amount);

    if (toReadable) {
        amount = amount.div(new BigNumber(10).pow(decimals || 0));
    }

    if (!amount.isFinite()) {
        amount = new BigNumber(0);
    }

    if (!convertTo) {
        return <>{amount.decimalPlaces(digits || 6).toFixed()}</>;
    }

    if (!tokenPrices) {
        return <>--</>;
    }

    const tokenPriceMap = tokenPrices.get(token);
    if (!tokenPriceMap) {
        return <>-</>;
    }

    const price = tokenPriceMap.get(convertTo);
    if (!price) {
        return <i>ERR</i>;
    }

    let defaultDigits;
    switch (convertTo) {
        case Currency.CNY:
        case Currency.JPY:
        case Currency.KRW:
            defaultDigits = 0; break;
        case Currency.BTC:
        case Currency.ETH:
            defaultDigits = 3; break;
        default:
            defaultDigits = 2;
    }
    defaultDigits = digits === undefined ? defaultDigits : digits;

    amount = amount.multipliedBy(price);

    if (!amount.isFinite()) {
        amount = new BigNumber(0);
    }

    if (group) {
        const moneyFormat: BigNumber.Format = {
            decimalSeparator: ".",
            groupSeparator: ",",
            groupSize: 3,
        };
        return <>{amount.toFormat(defaultDigits, moneyFormat)}</>;
    }

    return <>{amount.toFixed(defaultDigits)}</>;
};

export interface TokenAmountConversionOptions {
    token: Token;
    amount: string | BigNumber;
    convertTo?: Currency;
    digits?: number;

    toReadable?: boolean;
    decimals?: number;
    group?: boolean;

    tokenPrices?: TokenPrices;
}
