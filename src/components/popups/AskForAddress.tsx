import * as React from "react";

import { _captureInteractionException_ } from "../../lib/errors";
import { Token } from "../../state/generalTypes";
import { Popup } from "./Popup";

export const AskForAddress: React.StatelessComponent<{
    token: Token,
    message: string,
    onAddress(address: string): void;
    cancel(): void;
}> = ({ token, message, onAddress, cancel }) => {
    const [address, updateAddress] = React.useState("");

    const submit = () => {
        onAddress(address);
    };

    const onChange = (event: React.FormEvent<HTMLInputElement>): void => {
        updateAddress((event.target as HTMLInputElement).value);
    };

    return <Popup cancel={cancel}>
        <div className="swap swap--popup open">
            <div className="popup--header">
                <h2>Receive {token}</h2>
                <div role="button" className="popup--header--x" onClick={cancel} />
            </div>
            <div className="popup--body">
                {message}
                <input
                    type="text"
                    placeholder={`${token} address`}
                    onChange={onChange}
                    value={address}
                    autoFocus={true}
                />
                <div className="popup--buttons">
                    <button className="open--confirm" onClick={submit}><span>Confirm</span></button>
                </div>
            </div>
        </div>
    </Popup>;
};
