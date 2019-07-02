import * as React from "react";

import { SelectMarket } from "@renex/react-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { getMarket } from "../../lib/market";
import { connect, ConnectedProps } from "../../state/connect";
import { Token, TokenDetails, Tokens } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";

/**
 * SelectMarket allows the user to select a market from two token dropdowns
 */
const SelectMarketWrapperClass: React.StatelessComponent<Props> = ({ containers: [appContainer], top, thisToken, otherToken }) => {
    const handleChange = (token: Token): void => {
        if (top) {
            appContainer.updateSrcToken(token).catch(_catchInteractionErr_);
        } else {
            appContainer.updateDstToken(token).catch(_catchInteractionErr_);
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
interface Props extends ConnectedProps<[SDKContainer]> {
    top: boolean;
    thisToken: Token;
    otherToken: Token;
}

export const SelectMarketWrapper = connect<Props>([SDKContainer])(SelectMarketWrapperClass);
