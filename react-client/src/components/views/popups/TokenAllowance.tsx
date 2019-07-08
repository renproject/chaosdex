import * as React from "react";

import { Loading } from "@renex/react-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { Token } from "../../../state/generalTypes";
import { Commitment } from "../../../state/sdkContainer";
import { Popup } from "./Popup";

export const TokenAllowance: React.StatelessComponent<{
    token: Token,
    amount: string,
    commitment: Commitment | null,
    submit: () => Promise<void>,
}> = ({ token, submit, amount, commitment }) => {
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
                    <button className="button open--confirm" disabled={submitting || commitment === null} onClick={onSubmit}>{submitting ? <Loading alt={true} /> : "Approve"}</button>
                </div>
            </div>
        </div>
    </Popup>;
};
