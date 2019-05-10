import * as React from "react";

import { SelectMarket } from "@renex/react-components";

import { history } from "../lib/history";
import { getMarket } from "../lib/market";

import { connect, ConnectedProps } from "../state/connect";
import { AppContainer } from "../state/containers/appContainer";
import { Token, TokenDetails, Tokens } from "../store/types/general";

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
        // Filter out the tokens which aren't available in SwapperD
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
        const orderInputs = this.appContainer.state.order;

        if (top) {
            history.replace(`/?send=${token}&receive=${orderInputs.receiveToken}`);
        } else {
            history.replace(`/?send=${orderInputs.sendToken}&receive=${token}`);
        }
        if (top) {
            this.appContainer.updateSendToken(token);
        } else {
            this.appContainer.updateReceiveToken(token);
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
