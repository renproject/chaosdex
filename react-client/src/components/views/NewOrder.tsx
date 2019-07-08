import * as React from "react";

import { Loading } from "@renex/react-components";

import { _catchBackgroundErr_ } from "../../lib/errors";
import { getMarket } from "../../lib/market";
import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";
import { NewOrderInputs } from "./NewOrderInputs";

/**
 * NewOrder is a visual component for allowing users to open new orders
 */
export const NewOrder = connect<ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer] }) => {

        const openOrder = async () => {
            uiContainer.setSubmitting(true).catch(_catchBackgroundErr_);
        };

        const orderInput = uiContainer.state.orderInputs;
        const market = getMarket(orderInput.srcToken, orderInput.dstToken);

        const marketPrice = 0;

        const loggedIn = uiContainer.state.address !== null;
        const sufficientBalance = uiContainer.sufficientBalance();
        const validVolume = uiContainer.validVolume();
        const disabled = !loggedIn || !sufficientBalance || !validVolume;

        return <>
            <div className="section order">
                <NewOrderInputs
                    marketPrice={marketPrice}
                />
                <div className="submit-swap-buttons">
                    {
                        market ?
                            <button
                                disabled={disabled}
                                onClick={openOrder}
                                className={`button submit-swap ${disabled ? "disabled" : ""}`}
                            >
                                {uiContainer.state.submitting ? <Loading alt={true} /> :
                                    !loggedIn ? "Connect to trade" :
                                        !sufficientBalance ? "Insufficient balance" :
                                            !validVolume ? "Volume too low" :
                                                "Trade"
                                }
                            </button> :
                            <button disabled={true} className="button submit-swap">
                                Token pair not supported
                            </button>
                    }
                </div>
            </div>
        </>;
    }
);
