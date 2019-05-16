import * as React from "react";

import { Blocky } from "@renex/react-components";
import { WithTranslation, withTranslation } from "react-i18next";

import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";

const defaultState = { // Entries must be immutable
    shown: false,
    copied: false,
};

class AccountDropdownClass extends React.Component<Props, typeof defaultState> {
    private ref: HTMLDivElement | null = null;

    constructor(props: Props) {
        super(props);
        this.state = defaultState;
    }

    public render = () => {
        const { t, containers: [appContainer] } = this.props;
        const { address } = appContainer.state;
        const { copied, shown } = this.state;

        return <div
            className="header--group header--group--account"
            ref={this.setRef}
        >
            <div className="header--account header--selected header--selected" role="menuitem" onClick={this.toggle}>
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
                            <>{t("header.not_connected")}</>
                        }
                    </div>
                </div>

                {shown ?
                    <div className="header--dropdown--spacing header--dropdown--options header--dropdown--accounts">
                        <ul className={`header--dropdown ${!address ? "header--dropdown--login" : ""}`}>
                            {address ? <>
                                <li role="button" onClick={this.copyToClipboard} className="header--dropdown--option">
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
                                    onClick={this.handleLogout}
                                    className="header--dropdown--option"
                                >
                                    {t("header.log_out")}
                                </li>
                            </> :
                                <li
                                    role="button"
                                    onClick={this.handleLogin}
                                    className="header--dropdown--option header--dropdown--highlight"
                                >
                                    {t("header.log_in")}
                                </li>
                            }
                        </ul>
                    </div> : <></>
                }
            </div>
        </div>;
    }

    private readonly handleLogin = async (): Promise<void> => {
        const { containers: [appContainer] } = this.props;
        await appContainer.connect();
    }

    private readonly handleLogout = async (): Promise<void> => {
        location.reload(); // eslint-disable-line no-restricted-globals
    }

    private readonly copyToClipboard = (e: React.MouseEvent<HTMLElement>): void => {
        const el = e.currentTarget.childNodes[0] as Element;
        const address = el.getAttribute("data-addr");
        if (address) {
            const dummy = document.createElement("input");
            document.body.appendChild(dummy);
            dummy.setAttribute("value", address);
            dummy.select();
            document.execCommand("copy");
            document.body.removeChild(dummy);
        }
        this.setState({ copied: true });
    }

    private readonly setRef = (ref: HTMLDivElement) => {
        this.ref = ref;
    }

    private readonly clickAway = (event: MouseEvent) => {
        if ((this.ref && !this.ref.contains(event.target as Node | null))) {
            this.setState({ shown: false });
        }
        document.removeEventListener("mousedown", this.clickAway);
        // @ts-ignore
    }

    private readonly toggle = () => {
        const newShown = !this.state.shown;
        this.setState({ shown: newShown });

        if (newShown) {
            document.addEventListener("mousedown", this.clickAway);
        } else {
            document.removeEventListener("mousedown", this.clickAway);
        }
    }
}

interface Props extends WithTranslation, ConnectedProps<[AppContainer]> {
}

export const AccountDropdown = withTranslation()(connect<Props>([AppContainer])(AccountDropdownClass));
