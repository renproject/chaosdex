import * as React from "react";

import { Loading, TokenIcon } from "@renex/react-components";
import CopyToClipboard from "react-copy-to-clipboard";

import { _catchInteractionErr_ } from "../../lib/errors";
import { Token } from "../../state/generalTypes";
import { ReactComponent as Copy } from "../../styles/images/copy.svg";
import { Popup } from "./Popup";

export const ShowDepositAddress: React.StatelessComponent<{
    token: Token,
    depositAddress: string | null,
    cancel(): void;
}> = ({ token, depositAddress, cancel }) => {
    // Defaults for demo
    const [understood, setUnderstood] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [showSpinner, setShowSpinner] = React.useState(false);
    const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);

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
                setShowSpinner(true);
            }
        }, 5000)
        );
    };

    return <Popup cancel={cancel}>
        <div className="deposit-address">
            <div className="popup--body">
                <TokenIcon className="token-icon" token={token} />
                <h2>Deposit {token.toUpperCase()}</h2>
                <div role="button" className="popup--header--x" onClick={cancel} />
                <div className="address-input--message">
                    Only send {token.toUpperCase()} to this address.<br />
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
                            <Loading />{" "}<span>Scanning for {token.toUpperCase()} deposit</span>
                        </div> : null
                        }
                    </> :
                    <>
                        <div className="popup--buttons">
                            <button className="button open--confirm" disabled={depositAddress === null} onClick={onClick}>I understand</button>
                        </div>
                    </>
                }
            </div>
        </div>
    </Popup>;
};
