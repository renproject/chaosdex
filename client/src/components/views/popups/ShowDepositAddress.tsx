import * as React from "react";

import { Loading, TokenIcon } from "@renex/react-components";
import CopyToClipboard from "react-copy-to-clipboard";

import { Token } from "../../../state/generalTypes";
import { ReactComponent as Copy } from "../../../styles/images/copy.svg";
import { Popup } from "./Popup";

export const ShowDepositAddress: React.StatelessComponent<{
    token: Token,
    depositAddress: string | null,
    amount: string,
    cancel(): void;
    generateAddress(): Promise<void>;
    waitForDeposit(): Promise<void>;
    done(): void;
}> = ({ amount, token, depositAddress, cancel, generateAddress, waitForDeposit, done }) => {
    // Defaults for demo
    const [understood, setUnderstood] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    // tslint:disable-next-line: prefer-const
    let [showSpinner, setShowSpinner] = React.useState(false);

    const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);
    const [failed, setFailed] = React.useState(null as Error | null);

    // useEffect replaces `componentDidMount` and `componentDidUpdate`.
    // To limit it to running once, we use the initialized hook.
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
        if (!initialized) {
            generateAddress().catch((error) => {
                setFailed(error);
            });
            setInitialized(true);
        }
    }, [initialized, generateAddress]);

    const onClick = () => {
        setUnderstood(true);
    };

    const onClickAddress = () => {
        setCopied(true);
        if (timer) {
            clearTimeout(timer);
        }
        setTimer(setTimeout(() => {
            setCopied(false);
            if (!showSpinner) {
                showSpinner = true;
                setShowSpinner(true);
                waitForDeposit().then(() => {
                    done();
                }).catch(() => {
                    showSpinner = false;
                    setShowSpinner(false);
                });
            }
        }, 5000)
        );
    };

    return <Popup cancel={cancel}>
        <div className="deposit-address">
            <div className="popup--body">
                <TokenIcon className="token-icon" token={token} />
                <h2>Deposit {amount} {token.toUpperCase()}</h2>
                <div role="button" className="popup--header--x" onClick={cancel} />
                <div className="address-input--message">
                    Only send {token.toUpperCase()} to your deposit address.<br />
                    Sending any other assets will result in permanent loss!
                </div>
                {understood ?
                    <>
                        <div className="address-input--label">
                            Send {token.toUpperCase()} to:
                        </div>
                        <CopyToClipboard
                            text={depositAddress || ""}
                            onCopy={onClickAddress}
                        >
                            <div role="button" className={`address-input--copy ${copied ? "address-input--copied" : ""}`}>
                                <input
                                    type="text"
                                    name="address"
                                    disabled={true}
                                    value={depositAddress || ""}
                                    autoFocus={true}
                                    required={true}
                                    aria-required={true}
                                />
                                <label className="copied-text">Copied</label>
                                <Copy />
                            </div>
                        </CopyToClipboard>
                        {showSpinner ? <div className="spinner">
                            <Loading />{" "}<span>Scanning for {token.toUpperCase()} deposits</span>
                        </div> : null
                        }
                    </> :
                    <>
                        {failed ? <div className="red">{`${failed.message || failed}`}</div> : ""}
                        <div className="popup--buttons">
                            <button className="button open--confirm" disabled={depositAddress === null || failed !== null} onClick={onClick}>{failed ? "Unable to generate address" : "Show deposit address"}</button>
                        </div>
                    </>
                }
            </div>
        </div>
    </Popup>;
};
