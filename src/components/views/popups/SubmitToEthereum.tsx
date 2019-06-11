import * as React from "react";

import { Loading } from "@renex/react-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { Token } from "../../../state/generalTypes";
import { Popup } from "./Popup";

export const SubmitToEthereum: React.StatelessComponent<{
    token: Token,
    submit: () => Promise<void>,
}> = ({ token, submit }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as Error | null);

    const onSubmit = async () => {
        setError(null);
        setSubmitting(true);
        try {
            await submit();
        } catch (error) {
            setError(error);
            setSubmitting(false);
            _catchInteractionErr_(error);
        }
    };
    return <Popup>
        <div className="address-input">
            <div className="popup--body">
                <h2>Submit swap to Ethereum</h2>
                <div className="address-input--message">
                    Submit swap to Ethereum to receive {token.toUpperCase()}.
                    <br />
                    <br />
                </div>
                {error ? <span className="red">{`${error.message || error}`}</span> : null}
                <div className="popup--buttons">
                    <button className="button open--confirm" disabled={submitting} onClick={onSubmit}>{submitting ? <Loading alt={true} /> : "Submit"}</button>
                </div>
            </div>
        </div>
    </Popup>;
};
