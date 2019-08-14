import * as React from "react";

import { InfoLabel, LabelLevel, Loading } from "@renproject/react-components";

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
    const [failedTransaction, setFailedTransaction] = React.useState(null as string | null);

    const onSubmit = React.useCallback(async () => {
        setError(null);
        setFailedTransaction(null);
        setSubmitting(true);
        try {
            await submit(orderID);
        } catch (error) {
            _catchInteractionErr_(error);
            const match = String(error.message || error).match(/"transactionHash": "(0x[a-fA-F0-9]{64})"/);
            setSubmitting(false);
            if (match && match.length >= 2) {
                setFailedTransaction(match[1]);
                error = new Error("Transaction reverted.");
            }
            setError(error);
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

    return <Popup cancel={!submitting || txHash ? hide : undefined}>
        <div className="address-input">
            <div className="popup--body">
                <h2>Submit swap to Ethereum</h2>
                <div className="address-input--message">
                    Submit swap to Ethereum to receive {token.toUpperCase()}.{txHash ? <InfoLabel><span className="break-all">Tx Hash: {txHash.hash}</span></InfoLabel> : <></>}
                    <br />
                    <br />
                </div>
                {error ? <span className="red">
                    Error submitting to Ethereum <InfoLabel level={LabelLevel.Warning}>{`${error.message || error}`}</InfoLabel>
                    {failedTransaction ? <>
                        <br />
                        See the "Error" tab of the <a className="blue" href={`https://dashboard.tenderly.dev/tx/kovan/${failedTransaction}`}>Transaction Stack Trace</a>.
                        <br />
                        If you see <span className="monospace">"nonce already submitted"</span> your trade may have already gone through.
                    </> : null}
                </span> : null}
                <div className="popup--buttons">
                    <button className="button open--confirm" disabled={submitting} onClick={onSubmit}>{submitting ? <Loading alt={true} /> : "Submit"}</button>
                </div>
            </div>
        </div>
    </Popup>;
};
