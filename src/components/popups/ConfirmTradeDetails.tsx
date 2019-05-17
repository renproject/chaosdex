import * as React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";
import { OrderData } from "../../state/containers/appContainer";
import { Popup } from "./Popup";

export const ConfirmTradeDetails: React.StatelessComponent<{
    orderInputs: OrderData;
    done(): void;
    cancel(): void;
}> = ({ orderInputs, done, cancel }) => {
    return <Popup cancel={cancel}>
        <div className="swap swap--popup open">
            <div className="popup--header">
                <h2>Confirm Trade</h2>
                <div role="button" className="popup--header--x" onClick={cancel} />
            </div>
            <div className="popup--body">
                Trade {orderInputs.sendVolume} {orderInputs.srcToken} for {orderInputs.receiveVolume} {orderInputs.dstToken}
                <div className="popup--buttons">
                    <button className="open--confirm" onClick={done}><span>Confirm</span></button>
                </div>
            </div>
        </div>;
    </Popup>;
};
