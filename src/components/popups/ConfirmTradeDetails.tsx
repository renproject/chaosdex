import * as React from "react";

import { _captureInteractionException_ } from "../../lib/errors";
import { OrderData } from "../../state/containers/appContainer";

/**
 * ConfirmTradeDetails is a popup component that prompts the user to approve
 * opening an order
 */
export const ConfirmTradeDetails: React.StatelessComponent<{
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
