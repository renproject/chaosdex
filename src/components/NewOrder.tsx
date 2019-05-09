import * as React from "react";

import BigNumber from "bignumber.js";

import { Loading } from "@renex/react-components";
import { connect, ConnectedReturnType } from "react-redux"; // Custom typings

import { bindActionCreators, Dispatch } from "redux";
import { _captureBackgroundException_, _captureInteractionException_ } from "../lib/errors";
import { setAndUpdateValues } from "../store/actions/inputs/newOrderActions";
import { ApplicationData, MarketPair, UnknownMarketPrice } from "../store/types/general";
import { NewOrderInputs } from "./NewOrderInputs";

/**
 * NewOrder is a visual component for allowing users to open new orders
 */
class NewOrderClass extends React.Component<Props, State> {

    public constructor(props: Props) {
        super(props);
        this.state = {
            submitting: false,
        };
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { disabled, store: { orderInputs, marketPrices } } = this.props;
        const { submitting } = this.state;

        const market = MarketPair.BTC_DAI;

        const marketPrice = market ? marketPrices.get(market, UnknownMarketPrice).price : 0;

        return <>
            <div className="section order">
                <NewOrderInputs
                    marketPrice={marketPrice}
                    handleChange={this.handleChange}
                />
                {
                    market ?
                        <button
                            onClick={this.openOrder}
                            disabled={submitting || (orderInputs.inputError !== null && orderInputs.inputError.category === "input") || disabled}
                            className="button submit-swap"
                        >
                            {submitting ? <Loading alt={true} /> : <>Trade</>}
                        </button> :
                        <button disabled={true} className="button submit-swap">
                            Token pair not supported
                    </button>
                }
            </div>
            {orderInputs.inputError ? <div className="order--error red">{orderInputs.inputError.error}</div> : null}
        </>;
    }

    private readonly openOrder = async () => {
        console.log("openOrder: unimplemented");
    }

    private readonly handleChange = async (value: string | null) => {
        console.log("handelChange: unimplemented");
    }
}

const mapStateToProps = (state: ApplicationData) => ({
    store: {
        marketPrices: state.marketPrices.marketPrices,
        orderInputs: state.inputs,
        quoteCurrency: state.trader.quoteCurrency,
    },
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        setAndUpdateValues,
    }, dispatch)
});

interface Props extends ReturnType<typeof mapStateToProps>, ConnectedReturnType<typeof mapDispatchToProps> {
    disabled: boolean;
}

interface State {
    submitting: boolean;
}

export const NewOrder = connect(mapStateToProps, mapDispatchToProps)(NewOrderClass);
