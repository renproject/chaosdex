import * as React from "react";

import { InfoLabel, Loading } from "@renproject/react-components";

import { _catchInteractionErr_, safeJSONStringify } from "../../../lib/errors";
import { renderToken, Token } from "../../../state/generalTypes";
import {
    CommitmentType, ShiftInEvent, ShiftOutEvent, Tx,
} from "../../../state/persistentContainer";
import { network } from "../../../state/sdkContainer";
import { Popup } from "../Popup";

export const SubmitToEthereum: React.StatelessComponent<{
    token: Token,
    orderID: string,
    txHash: Tx | null,
    order: ShiftInEvent | ShiftOutEvent,
    submit: (orderID: string, retry?: boolean) => Promise<void>,
    hide?: () => void,
}> = ({ token, orderID, txHash, order, submit, hide }) => {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState(null as Error | null);
    const [failedTransaction, setFailedTransaction] = React.useState(null as string | null);

    const onSubmit = React.useCallback(async () => {
        setError(null);
        setFailedTransaction(null);
        setSubmitting(true);
        try {
            await submit(orderID, error !== null);
        } catch (error) {
            setSubmitting(false);
            let shownError = error;

            // Ignore user denying error in MetaMask.
            if (String(shownError.message || shownError).match(/User denied transaction signature/)) {
                return;
            }

            _catchInteractionErr_(shownError, "Error in SubmitToEthereum: submit");
            const match = String(shownError.message || shownError).match(/"transactionHash": "(0x[a-fA-F0-9]{64})"/);
            if (match && match.length >= 2) {
                setFailedTransaction(match[1]);
                shownError = new Error("Transaction reverted.");
            }
            setError(shownError);
        }
    }, [orderID, submit, error]);

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
                <h2>Submit {order && order.commitment && order.commitment.type === CommitmentType.Trade ? "swap " : ""}to Ethereum</h2>
                <div className="address-input--message">
                    Submit {order && order.commitment && order.commitment.type === CommitmentType.Trade ? <>swap to Ethereum to receive {renderToken(token).toUpperCase()}</> : <>to Ethereum</>}.{txHash ? <InfoLabel><span className="break-all">Tx Hash: {txHash.hash}</span></InfoLabel> : <></>}
                    <br />
                    <br />
                </div>
                {error ? <span className="red">
                    Error submitting to Ethereum: {error.message || safeJSONStringify(error)}
                    {failedTransaction ? <>
                        <br />
                        See the <a className="blue" href={`${network.contracts.etherscan}/tx/${network.contracts.chain}/${failedTransaction}/error`}>Transaction Status</a> for more details.
                        <br />
                        Some possible issues:
                        <ul className="submit--errors">
                            <li><span className="submit--error">nonce hash already spent</span>: your trade has already gone through in another transaction</li>
                            <li><span className="submit--error">amount is less than the minimum shiftOut amount</span>: the amount being shifted out is less than the tx fees</li>
                            <li><span className="submit--error">SafeERC20: low-level call failed</span>: you have insufficient balance</li>
                        </ul>
                    </> : null}
                </span> : null}
                <div className="popup--buttons">
                    <button className="button open--confirm" disabled={submitting} onClick={onSubmit}>{submitting ? <Loading alt={true} /> : "Submit"}</button>
                </div>
            </div>
        </div>
    </Popup>;
};
