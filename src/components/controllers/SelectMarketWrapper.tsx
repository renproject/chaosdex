import * as React from "react";

import { SelectMarket } from "@renex/react-components";

import { getMarket } from "../../lib/market";

import { _captureInteractionException_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { Token, TokenDetails, Tokens } from "../../state/generalTypes";

/**
 * SelectMarket allows the user to select a market from two token dropdowns
 */
const SelectMarketWrapperClass: React.StatelessComponent<Props> = ({ containers: [appContainer], top, thisToken, otherToken }) => {
    const handleChange = (token: Token): void => {
        if (top) {
            appContainer.updateSendToken(token).catch(_captureInteractionException_);
        } else {
            appContainer.updateReceiveToken(token).catch(_captureInteractionException_);
        }
    };

    const newTokens = new Map<Token, TokenDetails>(Tokens);
    return <SelectMarket
        top={top}
        thisToken={thisToken}
        otherToken={otherToken}
        allTokens={newTokens}
        onChange={handleChange}
        getMarket={getMarket}
    />;
};

// tslint:disable: react-unused-props-and-state
interface Props extends ConnectedProps<[AppContainer]> {
    top: boolean;
    thisToken: Token;
    otherToken: Token;
}

export const SelectMarketWrapper = connect<Props>([AppContainer])(SelectMarketWrapperClass);
