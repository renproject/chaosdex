import * as React from "react";

import { Blocky } from "@renproject/react-components";

import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";

interface Props {
    handleLogin: () => {};
    handleLogout: () => {};
}

export const AccountDropdown = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer], handleLogin, handleLogout }) => {
        const divRef = React.useRef<HTMLDivElement>(null);
        const [shown, setShown] = React.useState(false);
        const [copied, setCopied] = React.useState(false);

        const { address } = uiContainer.state;

        const copyToClipboard = (e: React.MouseEvent<HTMLElement>): void => {
            const el = e.currentTarget.childNodes[0] as Element;
            const addressToCopy = el.getAttribute("data-addr");
            if (addressToCopy) {
                const dummy = document.createElement("input");
                document.body.appendChild(dummy);
                dummy.setAttribute("value", addressToCopy);
                dummy.select();
                document.execCommand("copy");
                document.body.removeChild(dummy);
            }
            setCopied(true);
        };

        const clickAway = (event: MouseEvent) => {
            if ((divRef.current && !divRef.current.contains(event.target as Node | null))) {
                setShown(false);
            }
            document.removeEventListener("mousedown", clickAway);
            // @ts-ignore
        };

        const toggle = () => {
            const newShown = !shown;
            setShown(newShown);

            if (newShown) {
                document.addEventListener("mousedown", clickAway);
            } else {
                document.removeEventListener("mousedown", clickAway);
            }
        };

        return <div
            className="header--group header--group--account"
            ref={divRef}
        >
            <div className="header--account header--selected header--selected" role="menuitem" onClick={toggle}>
                {address && <Blocky address={address} />}
                <div
                    role="button"
                    className={`header--account--right ${address ?
                        "header--account--connected" :
                        "header--account--disconnected"}`}
                >
                    <div className="header--account--type">
                        {address ?
                            <>{address.substring(0, 8)}...{address.slice(-5)}</> :
                            <>Not connected</>
                        }
                    </div>
                </div>

                {shown ?
                    <div className="header--dropdown--spacing header--dropdown--options header--dropdown--accounts">
                        <ul className={`header--dropdown ${!address ? "header--dropdown--login" : ""}`}>
                            {address ? <>
                                <li role="button" onClick={copyToClipboard} className="header--dropdown--option">
                                    <span data-addr={address}>
                                        {copied ?
                                            <span>Copied</span>
                                            :
                                            <span>Copy to clipboard</span>
                                        }
                                    </span>
                                </li>
                                <li
                                    role="button"
                                    onClick={handleLogout}
                                    className="header--dropdown--option"
                                >
                                    Log out
                                </li>
                            </> :
                                <li
                                    role="button"
                                    onClick={handleLogin}
                                    className="header--dropdown--option header--dropdown--highlight"
                                >
                                    Log in
                                </li>
                            }
                        </ul>
                    </div> : <></>
                }
            </div>
        </div>;
    }
);
