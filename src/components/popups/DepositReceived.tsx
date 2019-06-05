import * as React from "react";

import { Loading } from "@renex/react-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { Popup } from "./Popup";

export const DepositReceived: React.StatelessComponent<{
    messageID: string | null;
    submitDeposit?: () => Promise<void>;
}> = ({ messageID, submitDeposit }) => {
    const [submitted, setSubmitted] = React.useState(false);

    const onClick = async () => {
        setSubmitted(true);
        if (submitDeposit) {
            try {
                await submitDeposit();
            } catch (error) {
                setSubmitted(false);
                _catchInteractionErr_(error);
            }
        }
    };

    const waiting = (submitDeposit === undefined) || submitted;

    return <Popup>
        <div className="deposit-address">
            <div className="popup--body">
                {waiting ? <Loading /> : null}
                <h2>Deposit received</h2>
                {waiting ? <div className="address-input--message">
                    <>Submitting order to RenVM...</>
                    {messageID ? <details><summary>Message ID</summary>{messageID}</details> : <></>}
                </div> : <div className="popup--buttons">
                        <button className="button open--confirm" onClick={onClick}>Submit deposit</button>
                    </div>
                }
            </div>
        </div>
    </Popup>;
};
