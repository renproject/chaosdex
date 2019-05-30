import * as React from "react";

import { Loading } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";

import { _catchBackgroundErr_ } from "../../lib/errors";
import { getMarket } from "../../lib/market";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { HistoryEvent } from "../../state/containers/appContainer";
import { NewOrderInputs } from "./NewOrderInputs";
import { OpeningOrder } from "./OpeningOrder";

/**
 * NewOrder is a visual component for allowing users to open new orders
 */
class NewOrderClass extends React.Component<Props> {

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { t, containers: [appContainer] } = this.props;
        const orderInput = appContainer.state.orderInputs;
        const market = getMarket(orderInput.srcToken, orderInput.dstToken);

        const marketPrice = 0;

        const disabled = appContainer.state.address === null;

        return <>
            <div className="section order">
                <NewOrderInputs
                    marketPrice={marketPrice}
                />
                <div className="submit-swap-buttons">
                    {
                        market ?
                            <button
                                onClick={disabled ? appContainer.connect : this.openOrder}
                                className={`button submit-swap ${disabled ? "disabled" : ""}`}
                            >
                                {appContainer.state.submitting ? <Loading alt={true} /> :
                                    disabled ? t("new_order.connect_to_trade") : t("new_order.trade")
                                }
                            </button> :
                            <button disabled={true} className="button submit-swap">
                                {t("new_order.unsupported_token_pair")}
                            </button>
                    }
                </div>
            </div>
            {/*<div className="order--error red">{orderInputs.inputError.error}</div>*/}
            {appContainer.state.submitting ? <OpeningOrder cancel={this.cancel} done={this.cancel} swapSubmitted={this.props.swapSubmitted} /> : <></>}
        </>;
    }

    private readonly cancel = () => {
        this.props.containers[0].setSubmitting(false).catch(_catchBackgroundErr_);
    }

    private readonly openOrder = async () => {
        this.props.containers[0].setSubmitting(true).catch(_catchBackgroundErr_);
    }
}

interface Props extends ConnectedProps<[AppContainer]>, WithTranslation {
    swapSubmitted: (h: HistoryEvent) => void;
}

export const NewOrder = withTranslation()(connect<Props>([AppContainer])(NewOrderClass));
