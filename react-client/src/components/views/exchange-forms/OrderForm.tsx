import * as React from "react";

import { Loading } from "@renproject/react-components";

import { _catchBackgroundErr_ } from "../../../lib/errors";
import { getMarket } from "../../../lib/market";
import { connect, ConnectedProps } from "../../../state/connect";
import { CommitmentType } from "../../../state/persistentContainer";
import { UIContainer } from "../../../state/uiContainer";
import { OrderFormInputs } from "./OrderFormInputs";

interface Props {
    handleLogin: () => void;
}

/**
 * NewOrder is a visual component for allowing users to open new orders
 */
export const OrderForm = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ handleLogin, containers: [uiContainer] }) => {

        const openOrder = React.useCallback(async () => {
            await uiContainer.updateCommitmentType(CommitmentType.Trade);
            uiContainer.setSubmitting(true).catch(error => _catchBackgroundErr_(error, "Error in OrderForm: setSubmitting"));
        }, [uiContainer]);

        const { orderInputs, address, submitting } = uiContainer.state;

        const orderInput = orderInputs;
        const market = getMarket(orderInput.srcToken, orderInput.dstToken);

        const marketPrice = 0;

        const loggedIn = address !== null;
        const sufficientBalance = uiContainer.sufficientBalance();
        const validVolume = uiContainer.validVolume();
        const disabled = !loggedIn || !sufficientBalance || !validVolume;

        let button;
        if (!market) {
            button = <button disabled={true} className="button submit-swap">
                Token pair not supported
            </button>;
        } else if (!loggedIn) {
            button = <button
                onClick={handleLogin}
                className="button button--white submit-swap connect-button"
            >
                Connect to trade
            </button>;
        } else {
            button = <button
                disabled={disabled}
                onClick={openOrder}
                className="button submit-swap"
            >
                {submitting ? <Loading alt={true} /> :
                    !loggedIn ? "Connect to trade" :
                        !sufficientBalance ? "Insufficient balance" :
                            !validVolume ? "Volume too low" :
                                "Trade"
                }
            </button>;
        }

        return <div className="section order">
            <OrderFormInputs marketPrice={marketPrice} />
            <div className="submit-swap-buttons">{button}</div>
        </div>;
    }
);
