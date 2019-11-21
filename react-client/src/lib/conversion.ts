import BigNumber from "bignumber.js";
import { Token, TokenPrices, Tokens } from "../state/generalTypes";

import { Currency } from "@renproject/react-components";

const toSmallestUnit = (amount: BigNumber, token: Token): BigNumber => {
    const details = Tokens.get(token);
    if (!details) {
        throw new Error(`Could not get token details for: ${token}`);
    }
    return amount.div(new BigNumber(10).exponentiatedBy(new BigNumber(details.decimals)));
};

export const toBitcoinValue = (amount: BigNumber, token: Token, tokenPrices: TokenPrices): BigNumber => {
    const asNaturalUnit = toSmallestUnit(amount, token);
    if (token === Token.BTC) {
        return asNaturalUnit;
    }

    const tokenPriceMap = tokenPrices.get(token);
    if (!tokenPriceMap) {
        return new BigNumber(0);
    }
    const toCurrency = Currency.BTC;
    const price = tokenPriceMap.get(toCurrency);
    if (!price) {
        throw new Error(`Could not get pricing information for ${toCurrency}`);
    }
    amount = asNaturalUnit.multipliedBy(price);

    if (!amount.isFinite()) {
        amount = new BigNumber(0);
    }
    return amount;
};
