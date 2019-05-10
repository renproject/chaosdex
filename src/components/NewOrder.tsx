import * as React from "react";

import { Loading } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";

import { _captureBackgroundException_, _captureInteractionException_ } from "../lib/errors";
import { connect, ConnectedProps } from "../state/connect";
import { AppContainer } from "../state/containers/appContainer";
import { OptionsContainer } from "../state/containers/optionsContainer";
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
        const { t, disabled } = this.props;
        const { submitting } = this.state;

        const market = MarketPair.DAI_BTC;

        const marketPrice = 0;

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
                            disabled={disabled}
                            className="button submit-swap"
                        >
                            {submitting ? <Loading alt={true} /> : <>{t("new_order.trade")}</>}
                        </button> :
                        <button disabled={true} className="button submit-swap">
                            Token pair not supported
                    </button>
                }
            </div>
            {/*<div className="order--error red">{orderInputs.inputError.error}</div>*/}
        </>;
    }

    private readonly openOrder = async () => {
        console.log("openOrder: unimplemented");
    }

    private readonly handleChange = async (value: string | null) => {
        console.log("handelChange: unimplemented");
    }
}

interface Props extends ConnectedProps, WithTranslation {
    disabled: boolean;
}

interface State {
    submitting: boolean;
}

export const NewOrder = withTranslation()(connect<Props>([AppContainer, OptionsContainer])(NewOrderClass));
