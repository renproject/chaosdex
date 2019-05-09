import { ActionType, getType } from "typesafe-actions";

import * as accountActions from "../../../store/actions/trader/accountActions";
import * as termsActions from "../../../store/actions/trader/termsActions";

import { TraderData } from "../../types/general";

type AccountAction = ActionType<typeof accountActions>;
type TermsAction = ActionType<typeof termsActions>;

// tslint:disable-next-line: cyclomatic-complexity
export const traderReducer = (state: TraderData = new TraderData(), action: AccountAction | TermsAction) => {
    switch (action.type) {
        case getType(accountActions.storeURL):
            return state.set("url", action.payload);

        case getType(accountActions.storeQuoteCurrency):
            return state.set("quoteCurrency", action.payload.quoteCurrency);

        // Terms
        case getType(termsActions.agreeToTerms):
            return state.set("agreedToTerms", action.payload.agreedToTerms);

        default:
            return state;
    }
};
