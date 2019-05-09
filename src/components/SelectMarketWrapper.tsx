import * as React from "react";

import { SelectMarket } from "@renex/react-components";
import { connect, ConnectedReturnType } from "react-redux"; // Custom typings
import { bindActionCreators, Dispatch } from "redux";

import { history } from "../lib/history";
import { getMarket } from "../lib/market";
import { setAndUpdateValues } from "../store/actions/inputs/newOrderActions";
import { ApplicationData, Token, TokenDetails, Tokens } from "../store/types/general";

/**
 * SelectMarket allows the user to select a market from two token dropdowns
 */
class SelectMarketWrapperClass extends React.Component<Props, State> {

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { top, thisToken, otherToken } = this.props;
        // Filter out the tokens which aren't available in SwapperD
        const allTokens = Array.from(Tokens.keys());
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
        const { orderInputs, top } = this.props;

        if (top) {
            history.replace(`/?send=${token}&receive=${orderInputs.receiveToken}`);
        } else {
            history.replace(`/?send=${orderInputs.sendToken}&receive=${token}`);
        }
        this.props.actions.setAndUpdateValues(
            orderInputs,
            top ? "sendToken" : "receiveToken",
            token,
            { blur: true },
        );
    }
}

const mapStateToProps = (state: ApplicationData) => ({
    orderInputs: state.inputs,
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        setAndUpdateValues,
    }, dispatch)
});

interface Props extends ReturnType<typeof mapStateToProps>, ConnectedReturnType<typeof mapDispatchToProps> {
    top: boolean;
    thisToken: Token;
    otherToken: Token;
}

interface State {
}

export const SelectMarketWrapper = connect(mapStateToProps, mapDispatchToProps)(SelectMarketWrapperClass);
