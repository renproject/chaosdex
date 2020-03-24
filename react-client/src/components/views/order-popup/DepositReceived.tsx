import * as React from "react";

import { Loading, TokenIcon } from "@renproject/react-components";
import { TxStatus } from "@renproject/ren-js-common";

// tslint:disable-next-line: ordered-imports
import { _catchInteractionErr_, safeJSONStringify } from "../../../lib/errors";
import { Token } from "../../../state/generalTypes";
import { Popup } from "../Popup";

const renderTxStatus = (status: TxStatus | null) => {
    switch (status) {
        case null:
            return "Submitting";
        case TxStatus.TxStatusNil:
            return "Submitting";
        case TxStatus.TxStatusConfirming:
            return "Waiting for confirmations";
        case TxStatus.TxStatusPending:
            return "Executing";
        case TxStatus.TxStatusExecuting:
            return "Executing";
        case TxStatus.TxStatusDone:
            return "Done";
        case TxStatus.TxStatusReverted:
            return "Reverted";
    }
};

export const DepositReceived: React.StatelessComponent<{
    token?: Token;
    renTxHash: string | null;
    renVMStatus: TxStatus | null;
    orderID: string;
    submitDeposit?: (orderID: string, resubmit?: boolean) => Promise<unknown>;
    hide?: () => void;
}> = ({ token, renVMStatus, renTxHash, orderID, submitDeposit, hide }) => {
    const [submitted, setSubmitted] = React.useState(false);
    const [error, setError] = React.useState(null as Error | null);

    const onClick = React.useCallback(async () => {
        setError(null);
        setSubmitted(true);
        if (submitDeposit) {
            try {
                await submitDeposit(orderID);
            } catch (error) {
                setSubmitted(false);
                setError(error);
                _catchInteractionErr_(error, "Error in DepositReceived: submitDeposit");
            }
        }
    }, [orderID, submitDeposit]);

    // useEffect replaces `componentDidMount` and `componentDidUpdate`.
    // To limit it to running once, we use the initialized hook.
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            if (renTxHash) {
                onClick().catch(console.error);
            }
        }
    }, [initialized, renTxHash, onClick]);

    // const onRetry = async () => {
    //     setError(null);
    //     setSubmitted(true);
    //     if (submitDeposit) {
    //         try {
    //             await submitDeposit(orderID, true);
    //         } catch (error) {
    //             setSubmitted(false);
    //             setError(error);
    //             _catchInteractionErr_(error);
    //         }
    //     }
    // };

    const waiting = (submitDeposit === undefined) || submitted;

    return <Popup cancel={hide}>
        <div className="deposit-address">
            <div className="popup--body">
                {token ? <TokenIcon className="token-icon" token={token} /> : null}
                <h2>{waiting ? <>Submitting to RenVM</> : <>Submit to RenVM</>}</h2>
                {waiting ? <Loading className="loading--blue" /> : null}
                {error ? <span className="red">Unable to submit to RenVM: {error.message || safeJSONStringify(error)}</span> : null}
                {waiting ? <div className="address-input--message">
                    <>
                        <p>Submitting order to RenVM...<br />This can take a few minutes.</p>
                        <p>Status: {<span>{renderTxStatus(renVMStatus)}.</span> || <Loading className="loading--small" />}</p>
                    </>
                </div> : <div className="popup--buttons">
                        <button className="button open--confirm" onClick={onClick}>Submit to RenVM</button>
                    </div>
                }
            </div>
        </div>
    </Popup>;
};
