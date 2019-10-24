import * as React from "react";

import { SelectMarket } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { getMarket } from "../../lib/market";
import { connect, ConnectedProps } from "../../state/connect";
import { Token, TokenDetails, Tokens } from "../../state/generalTypes";
import { UIContainer } from "../../state/uiContainer";

// tslint:disable: react-unused-props-and-state
interface Props {
    top: boolean;
    thisToken: Token;
    otherToken: Token;
    locked?: boolean;
}

/**
 * SelectMarket allows the user to select a market from two token dropdowns
 */
export const SelectMarketWrapper = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer], top, thisToken, otherToken, locked }) => {
        const handleChange = (token: Token): void => {
            if (top) {
                uiContainer.updateSrcToken(token).catch(_catchInteractionErr_);
            } else {
                uiContainer.updateDstToken(token).catch(_catchInteractionErr_);
            }
        };

        const newTokens = new Map<Token, TokenDetails>(Tokens);
        const lockedToken = new Map<Token, TokenDetails>().set(thisToken, newTokens.get(thisToken)!);
        return <SelectMarket
            top={top}
            thisToken={thisToken}
            otherToken={otherToken}
            allTokens={locked ? lockedToken : newTokens}
            onMarketChange={handleChange}
            getMarket={getMarket}
            white={true}
        />;
    }
);
