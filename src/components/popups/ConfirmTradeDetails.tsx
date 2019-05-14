import * as React from "react";

import { _captureInteractionException_ } from "../../lib/errors";
import { AppContainer } from "../../state/containers";
import { OrderData, PopupData } from "../../state/storeTypes";

/**
 * ConfirmTradeDetails is a popup component that prompts the user to approve
 * opening an order
 */
const ConfirmTradeDetails: React.StatelessComponent<{
    orderInputs: OrderData;
    onDone(): void;
    onCancel(): void;
}> = ({ orderInputs, onDone, onCancel }) => {
    return <div className="popup swap swap--popup open">
        <div className="popup--header">
            <h2>Confirm Trade</h2>
            <div role="button" className="popup--header--x" onClick={onCancel} />
        </div>
        Trade {orderInputs.sendVolume} {orderInputs.sendToken} for {orderInputs.receiveVolume} {orderInputs.receiveToken}
        <div className="popup--buttons">
            <button className="open--confirm" onClick={onDone}><span>Confirm</span></button>
        </div>
    </div>;
};

export const confirmTradeDetails = async (appContainer: AppContainer) => new Promise((resolve, reject) => {
    const onCancel = () => {
        appContainer.clearPopup().catch(_captureInteractionException_);
        reject();
    };

    const onDone = () => {
        appContainer.clearPopup().catch(_captureInteractionException_);
        resolve();
    }

    const popup: PopupData = {
        popup: <ConfirmTradeDetails onDone={onDone} onCancel={onCancel} orderInputs={appContainer.state.order} />,
        dismissible: true,
        overlay: true,
        onCancel,
    };

    appContainer.setPopup(popup).catch(_captureInteractionException_);
});
