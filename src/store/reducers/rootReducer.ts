import { combineReducers } from "redux";

import { alertReducer } from "./alert/alertReducer";
import { inputsReducer } from "./inputs/inputsReducer";
import { marketReducer } from "./market/marketReducer";
import { popupReducer } from "./popup/popupReducer";
import { traderReducer } from "./trader/traderReducer";

import { ApplicationData } from "../types/general";

export const rootReducer = combineReducers<ApplicationData>({
    alert: alertReducer,
    inputs: inputsReducer,
    marketPrices: marketReducer,
    popup: popupReducer,
    trader: traderReducer,
});
