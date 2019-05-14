import * as React from "react";

import { SelectMarket } from "@renex/react-components";

import { getMarket } from "../lib/market";

import { _captureInteractionException_ } from "../lib/errors";
import { connect, ConnectedProps } from "../state/connect";
import { AppContainer } from "../state/containers";
import { Token, TokenDetails, Tokens } from "../state/generalTypes";

/**
 * SelectMarket allows the user to select a market from two token dropdowns
 */
class SelectMarketWrapperClass extends React.Component<Props, State> {

    private readonly appContainer: AppContainer;

    constructor(props: Props) {
        super(props);
        [this.appContainer] = this.props.containers;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { top, thisToken, otherToken } = this.props;
        const newTokens = new Map<Token, TokenDetails>(Tokens);
        return <SelectMarket
            top={top}
            thisToken={thisToken}
            otherToken={otherToken}
            allTokens={newTokens}
            onChange={this.handleChange}
            getMarket={getMarket}
        />;
    }

    // tslint:disable-next-line:no-any
    private readonly handleChange = (token: Token): void => {
        const { top } = this.props;
        if (top) {
            this.appContainer.updateSendToken(token).catch(_captureInteractionException_);
        } else {
            this.appContainer.updateReceiveToken(token).catch(_captureInteractionException_);
        }
    }
}

interface Props extends ConnectedProps {
    top: boolean;
    thisToken: Token;
    otherToken: Token;
}

interface State {
}

export const SelectMarketWrapper = connect<Props>([AppContainer])(SelectMarketWrapperClass);
