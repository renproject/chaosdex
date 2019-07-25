import * as React from "react";

import { InfoLabel, Loading } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { Token } from "../../../state/generalTypes";
import { Tx } from "../../../state/persistentContainer";
import { Popup } from "../Popup";

export const SubmitToEthereum: React.StatelessComponent<{
    token: Token,
    orderID: string,
    txHash: Tx | null,
    submit: (orderID: string) => Promise<void>,
    hide?: () => void,
}> = ({ token, orderID, txHash, submit, hide }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as Error | null);

    const onSubmit = React.useCallback(async () => {
        setError(null);
        setSubmitting(true);
        try {
            await submit(orderID);
        } catch (error) {
            console.error(error);
            setError(error);
            setSubmitting(false);
            _catchInteractionErr_(error);
        }
    }, [orderID, submit]);

    // useEffect replaces `componentDidMount` and `componentDidUpdate`.
    // To limit it to running once, we use the initialized hook.
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            if (txHash) {
                onSubmit().catch(console.error);
            }
        }
    }, [initialized, txHash, onSubmit]);

    return <Popup cancel={hide}>
        <div className="address-input">
            <div className="popup--body">
                <h2>Submit swap to Ethereum</h2>
                <div className="address-input--message">
                    Submit swap to Ethereum to receive {token.toUpperCase()}.{txHash ? <InfoLabel><span className="break-all">Tx Hash: {txHash.hash}</span></InfoLabel> : <></>}
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
