import * as React from "react";

import { TokenIcon } from "@renex/react-components";
import { useTranslation } from "react-i18next";

import { _catchInteractionErr_ } from "../../lib/errors";
import { Token, Tokens } from "../../state/generalTypes";
import { Popup } from "./Popup";

import { ReactComponent as MetaMask } from "../../styles/images/metamask.svg";
import { Chain } from "../../lib/shiftSDK/shiftSDK";

export const AskForAddress: React.StatelessComponent<{
    token: Token,
    message: string,
    defaultAddress: string,
    onAddress(address: string): void;
    cancel(): void;
}> = ({ token, message, defaultAddress, onAddress, cancel }) => {
    const { t } = useTranslation();
    const [address, updateAddress] = React.useState("");
    const [error, updateError] = React.useState(null as string | null);

    const tokenDetails = Tokens.get(token);

    const submit = () => {
        if (!error && tokenDetails && !tokenDetails.validator(address)) {
            updateError(`Invalid ${tokenDetails.chain.toUpperCase()} address`);
            return;
        }
        onAddress(address);
    };

    const useDefaultAddress = () => {
        updateAddress(defaultAddress);
    }

    const onChange = (event: React.FormEvent<HTMLInputElement>): void => {
        updateError(null);
        updateAddress((event.target as HTMLInputElement).value);
    };

    return <Popup cancel={cancel}>
        <div className="address-input">
            <div className="popup--body">
                <TokenIcon className="token-icon" token={token} />
                <h2>{token} {t("popup.address")}</h2>
                <div role="button" className="popup--header--x" onClick={cancel} />
                <div className="address-input--message">
                    {message}
                </div>
                <div className="form-group">
                    <input
                        type="text"
                        name="address"
                        className="form-control"
                        onChange={onChange}
                        value={address}
                        autoFocus={true}
                        required={true}
                        aria-required={true}
                    />
                    <label className="form-control-placeholder">{token} address</label>
                    {tokenDetails && tokenDetails.chain === Chain.Ethereum ? 
                        <button type="button" className="metamask-logo" onClick={useDefaultAddress}><MetaMask /></button> :
                        null
                    }
                </div>
                {error ? <span className="red"><br />{error}</span> : null}
                <div className="popup--buttons">
                    <button className="button open--confirm" disabled={address === ""} onClick={submit}><span>{error ? "Use anyway" : t("popup.confirm")}</span></button>
                </div>
            </div>
        </div>
    </Popup>;
};
