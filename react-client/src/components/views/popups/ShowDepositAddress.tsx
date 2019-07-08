import * as React from "react";

import { Loading, TokenIcon } from "@renex/react-components";
import QRCode from "qrcode.react";
import CopyToClipboard from "react-copy-to-clipboard";

import { Token } from "../../../state/generalTypes";
import { ReactComponent as Copy } from "../../../styles/images/copy.svg";
import { ReactComponent as QR } from "../../../styles/images/qr.svg";
import { Popup } from "./Popup";

interface Props {
    token: Token;
    depositAddress: string | null;
    amount: string;
    cancel(): void;
    generateAddress(): Promise<void>;
    waitForDeposit(): Promise<void>;
    done(): void;
}

export const ShowDepositAddress: React.StatelessComponent<Props> =
    ({ amount, token, depositAddress, cancel, generateAddress, waitForDeposit, done }) => {
        // Defaults for demo

        // tslint:disable-next-line: prefer-const
        let [understood, setUnderstood] = React.useState(false);
        const [copied, setCopied] = React.useState(false);
        const [showQR, setShowQR] = React.useState(false);

        const [showSpinner, setShowSpinner] = React.useState(false);

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

        const showDepositAddress = () => {
            setTimer(setTimeout(() => {
                setShowSpinner(true);
            }, 5000)
            );
            setUnderstood(true);
            understood = true;
            waitForDeposit().then(() => {
                done();
            }).catch(() => {
                setUnderstood(false);
                understood = false;
            });
        };

        const onClickAddress = () => {
            setCopied(true);
            if (timer) {
                clearTimeout(timer);
            }
            setTimer(setTimeout(() => {
                setCopied(false);
                if (!showSpinner) {
                    setShowSpinner(true);
                }
            }, 5000)
            );
        };

        const toggleQR = () => {
            setShowQR(!showQR);
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
                                    <QR className="qr" onClick={toggleQR} />
                                    <Copy />
                                </div>
                            </CopyToClipboard>
                            {showSpinner ? <div className="spinner">
                                <Loading />{" "}<span>Scanning for {token.toUpperCase()} deposits</span>
                            </div> : null}
                            {showQR ? <QRCode value={`bitcoin:${depositAddress}?amount=${amount}`} /> : null}
                        </> :
                        <>
                            {failed ? <div className="red">{`${failed.message || failed}`}</div> : ""}
                            <div className="popup--buttons">
                                <button className="button open--confirm" disabled={depositAddress === null || failed !== null} onClick={showDepositAddress}>{failed ? "Unable to generate address" : "Show deposit address"}</button>
                            </div>
                        </>
                    }
                </div>
            </div>
        </Popup>;
    };
