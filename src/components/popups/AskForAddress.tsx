import * as React from "react";

import { TokenIcon } from "@renex/react-components";
import { useTranslation } from "react-i18next";

import { _catchInteractionErr_ } from "../../lib/errors";
import { Token } from "../../state/generalTypes";
import { Popup } from "./Popup";

export const AskForAddress: React.StatelessComponent<{
    token: Token,
    message: string,
    onAddress(address: string): void;
    cancel(): void;
}> = ({ token, message, onAddress, cancel }) => {
    const { t } = useTranslation();
    const [address, updateAddress] = React.useState("");

    const submit = () => {
        onAddress(address);
    };

    const onChange = (event: React.FormEvent<HTMLInputElement>): void => {
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
                </div>
                <div className="popup--buttons">
                    <button className="button open--confirm" disabled={address === ""} onClick={submit}><span>{t("popup.confirm")}</span></button>
                </div>
            </div>
        </div>
    </Popup>;
};
