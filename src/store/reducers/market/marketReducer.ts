import { ActionType, getType } from "typesafe-actions";

import * as marketActions from "../../../store/actions/market/marketActions";

import { MarketPrice, MarketPriceData } from "../../types/general";

type MarketAction = ActionType<typeof marketActions>;

export const marketReducer = (state: MarketPriceData = new MarketPriceData(), action: MarketAction) => {
    switch (action.type) {
        case getType(marketActions.updatePrices):
            const { price, percentChange } = action.payload;
            const marketPrice: MarketPrice = { price, percentChange };
            return state.set("marketPrices", state.marketPrices.set(action.payload.pair, marketPrice));

        case getType(marketActions.pricesUpdating):
            return state.set("updating", action.payload);

        case getType(marketActions.storeTokenPrices):
            return state.set("tokenPrices", action.payload.tokenPrices);

        default:
            return state;
    }
};
