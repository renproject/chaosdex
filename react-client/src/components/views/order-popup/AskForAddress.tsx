import * as React from "react";

import { Loading, TokenIcon } from "@renproject/react-components";
import RenJS from "@renproject/ren";

import { IS_TESTNET } from "../../../lib/environmentVariables";
import { _catchInteractionErr_, safeJSONStringify } from "../../../lib/errors";
import { renderToken, Token, Tokens } from "../../../state/generalTypes";
import { ReactComponent as MetaMask } from "../../../styles/images/metamask.svg";
import { Popup } from "../Popup";

export const AskForAddress: React.StatelessComponent<{
    token: Token,
    message: React.ReactNode,
    defaultAddress: string,
    onAddress(address: string): Promise<void>;
    cancel(): void;
}> = ({ token, message, defaultAddress, onAddress, cancel }) => {
    // tslint:disable-next-line: prefer-const
    let [address, updateAddress] = React.useState("");
    const [error, updateError] = React.useState(null as string | null);
    const [submitting, updateSubmitting] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement | null>() as React.MutableRefObject<HTMLInputElement | null>;
    const [checkingSkip, setCheckingSkip] = React.useState(true);

    const tokenDetails = Tokens.get(token);

    const submit = async (event?: React.FormEvent<HTMLFormElement>) => {
        if (event) { event.preventDefault(); }
        if (!error && tokenDetails && !tokenDetails.validator(address, IS_TESTNET)) {
            updateError(`Invalid ${tokenDetails.chain.toUpperCase()} address`);
            return;
        }
        try {
            updateSubmitting(true);
            await onAddress(address);
        } catch (error) {
            updateError(String(error.message || safeJSONStringify(error)));
            updateSubmitting(false);
        }
    };

    const useDefaultAddress = () => {
        address = defaultAddress;
        updateAddress(defaultAddress);
        const current = inputRef.current;
        if (current) {
            current.focus();
        }
    };

    const onChange = (event: React.FormEvent<HTMLInputElement>): void => {
        updateError(null);
        updateAddress((event.target as HTMLInputElement).value);
    };

    React.useEffect(() => {
        (async () => {
            try {
                if (tokenDetails && tokenDetails.chain === RenJS.Chains.Ethereum) {
                    address = defaultAddress;
                    updateAddress(defaultAddress);
                    await submit();
                }
            } catch (err) {
                _catchInteractionErr_(err, "Error in AskForAddress > submit");
            }
            setCheckingSkip(false);
        })().catch((err => _catchInteractionErr_(err, "Error in AskForAddress > useEffect")));
    }, [tokenDetails]);

    return <Popup cancel={cancel}>
        <div className="address-input">
            {checkingSkip ? <Loading className="centered" alt={true} /> : <></>}
            <div style={{ opacity: checkingSkip ? 0 : 1 }} className="popup--body">
                <TokenIcon className="token-icon" token={token} />
                <h2>{renderToken(token)} address</h2>
                <div className="address-input--message">
                    {message}
                </div>
                <form onSubmit={submit}>
                    <div className="form-group">
                        <input
                            type="text"
                            className="form-control"
                            onChange={onChange}
                            value={address}
                            autoFocus={true}
                            required={true}
                            aria-required={true}
                            ref={inputRef}
                        />
                        <label className="form-control-placeholder">{renderToken(token)} address</label>
                        {tokenDetails && tokenDetails.chain === RenJS.Chains.Ethereum ?
                            <button type="button" className="metamask-logo" onClick={useDefaultAddress}><MetaMask /></button> :
                            null
                        }
                    </div>
                    {error ? <span className="red"><br />{error}</span> : null}
                    <div className="popup--buttons">
                        <button className="button open--confirm" disabled={address === "" || submitting || error !== null} type="submit"><span>{"Confirm"}</span></button>
                    </div>
                </form>
            </div>
        </div>
    </Popup>;
};
