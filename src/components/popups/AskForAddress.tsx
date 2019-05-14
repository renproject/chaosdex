import * as React from "react";

import { _captureInteractionException_ } from "../../lib/errors";
import { AppContainer } from "../../state/containers";
import { Token } from "../../state/generalTypes";
import { PopupData } from "../../state/storeTypes";

const AskForAddress: React.StatelessComponent<{
    token: Token,
    message: string,
    onDone(address: string): void;
    onCancel(): void;
}> = ({ token, message, onDone, onCancel }) => {
    const [address, updateAddress] = React.useState("");

    const submit = () => {
        onDone(address);
    };

    const onChange = (event: React.FormEvent<HTMLInputElement>): void => {
        updateAddress((event.target as HTMLInputElement).value);
    }

    return <div className="popup swap swap--popup open">
        <div className="popup--header">
            <h2>Receive {token}</h2>
            <div role="button" className="popup--header--x" onClick={onCancel} />
        </div>
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
    </div>;
};

export const askForAddress = async (
    appContainer: AppContainer,
    token: Token,
    message: string,
) => new Promise((resolve, reject) => {
    const onCancel = () => {
        appContainer.clearPopup().catch(_captureInteractionException_);
        reject();
    };

    const onDone = (address: string) => {
        appContainer.clearPopup().catch(_captureInteractionException_);
        resolve(address);
    };

    const popup: PopupData = {
        popup: <AskForAddress onDone={onDone} onCancel={onCancel} token={token} message={message} />,
        dismissible: true,
        overlay: true,
        onCancel,
    };

    appContainer.setPopup(popup).catch(_captureInteractionException_);
});
