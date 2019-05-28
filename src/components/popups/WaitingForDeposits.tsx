import * as React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";
import { Token } from "../../state/generalTypes";
import { Popup } from "./Popup";

export const WaitingForDeposits: React.StatelessComponent<{
    token: Token;
    depositAddress: string;
    depositFound: boolean;
    done(): void;
    cancel(): void;
}> = ({ token, depositAddress, depositFound, done, cancel }) => {
    return <Popup cancel={cancel}>
        <div className="swap swap--popup open">
            <div className="popup--header">
                <h2>Waiting for deposits...</h2>
                <div role="button" className="popup--header--x" onClick={cancel} />
            </div>
            <div className="popup--body">
                <div className="popup--buttons">
                    <button className="open--confirm" onClick={done}><span>Confirm</span></button>
                </div>
            </div>
        </div>;
    </Popup>;
};
