import * as React from "react";

import { InfoLabel, Loading, TokenIcon } from "@renproject/react-components";
import { TxStatus } from "@renproject/ren/dist/renVM/transaction";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { Token } from "../../../state/generalTypes";
import { Popup } from "../Popup";

export const DepositReceived: React.StatelessComponent<{
    token?: Token;
    messageID: string | null;
    renVMStatus: TxStatus | null;
    orderID: string;
    submitDeposit?: (orderID: string, resubmit?: boolean) => Promise<unknown>;
    hide?: () => void;
}> = ({ token, renVMStatus, messageID, orderID, submitDeposit, hide }) => {
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
                _catchInteractionErr_(error);
            }
        }
    }, [orderID, submitDeposit]);

    // useEffect replaces `componentDidMount` and `componentDidUpdate`.
    // To limit it to running once, we use the initialized hook.
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            if (messageID) {
                onClick().catch(console.error);
            }
        }
    }, [initialized, messageID, onClick]);

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
                <h2>Submit to RenVM</h2>
                {waiting ? <Loading /> : null}
                {error ? <span className="red">{`${error.message || error}`}</span> : null}
                {waiting ? <div className="address-input--message">
                    <>Submitting order to RenVM...<br />This can take a few minutes. <InfoLabel>Status: {renVMStatus || <Loading className="loading--small" />}{/* <button className="button--plain" onClick={onRetry}>(retry)</button>*/}</InfoLabel></>
                </div> : <div className="popup--buttons">
                        <button className="button open--confirm" onClick={onClick}>Submit to RenVM</button>
                    </div>
                }
            </div>
        </div>
    </Popup>;
};
