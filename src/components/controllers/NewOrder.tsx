import * as React from "react";

import { Loading } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";

import { getMarket } from "../../lib/market";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { NewOrderInputs } from "./NewOrderInputs";
import { OpeningOrder } from "./OpeningOrder";

const defaultState = { // Entries must be immutable
    submitting: false,
};

/**
 * NewOrder is a visual component for allowing users to open new orders
 */
class NewOrderClass extends React.Component<Props, typeof defaultState> {
    constructor(props: Props) {
        super(props);
        this.state = defaultState;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { t, containers: [appContainer] } = this.props;
        const { submitting } = this.state;
        const orderInput = appContainer.state.order;
        const market = getMarket(orderInput.sendToken, orderInput.receiveToken);

        const marketPrice = 0;

        const disabled = appContainer.state.address === null;

        return <>
            <div className="section order">
                <NewOrderInputs
                    marketPrice={marketPrice}
                />
                {
                    market ?
                        <button
                            onClick={this.openOrder}
                            disabled={disabled}
                            className="button submit-swap"
                        >
                            {submitting ? <Loading alt={true} /> :
                                disabled ? t("new_order.connect_to_trade") : t("new_order.trade")
                            }
                        </button> :
                        <button disabled={true} className="button submit-swap">
                            {t("new_order.unsupported_token_pair")}
                        </button>
                }
            </div>
            {/*<div className="order--error red">{orderInputs.inputError.error}</div>*/}
            {submitting ? <OpeningOrder cancel={this.cancel} done={this.cancel} /> : <></>}
        </>;
    }

    private readonly cancel = () => {
        this.setState({ submitting: false });
    }

    private readonly openOrder = async () => {
        this.setState({ submitting: true });
    }
}

interface Props extends ConnectedProps<[AppContainer]>, WithTranslation {
}

export const NewOrder = withTranslation()(connect<Props>([AppContainer])(NewOrderClass));
