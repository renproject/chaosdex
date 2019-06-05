import * as React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";
import { Token } from "../../state/generalTypes";
import { Popup } from "./Popup";

export const TokenAllowance: React.StatelessComponent<{
    token: Token,
    amount: string,
    submit: () => Promise<void>,
}> = ({ token, submit, amount }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const onSubmit = () => {
        setSubmitting(true);
        submit().catch((err) => {
            setSubmitting(false);
            _catchInteractionErr_(err);
        });
    };
    return <Popup>
        <div className="address-input">
            <div className="popup--body">
                <h2>Transfer Approval</h2>
                <div className="address-input--message">
                    Please approve the transfer of {amount} {token.toUpperCase()}.
                    <br />
                    <br />
                </div>
                <div className="popup--buttons">
                    <button className="button open--confirm" disabled={submitting} onClick={onSubmit}>Approve</button>
                </div>
            </div>
        </div>
    </Popup>;
};
