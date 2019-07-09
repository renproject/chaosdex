import * as React from "react";

import { InfoLabel, Loading, TokenIcon } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../../lib/errors";
import { Token } from "../../../state/generalTypes";
import { Popup } from "../Popup";

export const DepositReceived: React.StatelessComponent<{
    token?: Token;
    messageID: string | null;
    submitDeposit?: () => Promise<void>;
    done: () => void;
}> = ({ token, messageID, submitDeposit, done }) => {
    const [submitted, setSubmitted] = React.useState(false);
    const [error, setError] = React.useState(null as Error | null);

    const onClick = async () => {
        setError(null);
        setSubmitted(true);
        if (submitDeposit) {
            try {
                await submitDeposit();
                done();
            } catch (error) {
                setSubmitted(false);
                setError(error);
                _catchInteractionErr_(error);
            }
        }
    };

    const waiting = (submitDeposit === undefined) || submitted;

    return <Popup>
        <div className="deposit-address">
            <div className="popup--body">
                {token ? <TokenIcon className="token-icon" token={token} /> : null}
                <h2>Submit to darknodes</h2>
                {waiting ? <Loading /> : null}
                {error ? <span className="red">{`${error.message || error}`}</span> : null}
                {waiting ? <div className="address-input--message">
                    <>Submitting order to RenVM...<br />This can take a few minutes. <InfoLabel>{messageID ? messageID : <Loading />}</InfoLabel></>
                </div> : <div className="popup--buttons">
                        <button className="button open--confirm" onClick={onClick}>Submit to darknodes</button>
                    </div>
                }
            </div>
        </div>
    </Popup>;
};
