import { Dispatch } from "redux";
import { createStandardAction } from "typesafe-actions";

import { _captureBackgroundException_ } from "../../../lib/errors";
import { getTokenPricesInCurrencies } from "../../../lib/market";
import { MarketPair, TokenPrices } from "../../types/general";

/**
 * Updates the market price for a specific token
 */
export const updatePrices = createStandardAction("UPDATE_PRICES")<{
    price: number;
    percentChange: number;
    pair: MarketPair;
}>();

export const pricesUpdating = createStandardAction("PRICES_UPDATING")<boolean>();

export const storeTokenPrices = createStandardAction("STORE_TOKEN_PRICES")<{ tokenPrices: TokenPrices }>();

export const updateTokenPrices = () => async (dispatch: Dispatch) => {
    dispatch(pricesUpdating(true));
    try {
        const tokenPrices = await getTokenPricesInCurrencies();
        dispatch(pricesUpdating(false));
        dispatch(storeTokenPrices({ tokenPrices }));
    } catch (error) {
        dispatch(pricesUpdating(false));
        _captureBackgroundException_(error);
    }
};
