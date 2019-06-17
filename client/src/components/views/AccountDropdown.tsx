import * as React from "react";

import { Blocky } from "@renex/react-components";

import { AppContainer } from "../../state/appContainer";
import { connect, ConnectedProps } from "../../state/connect";

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
        const { containers: [appContainer] } = this.props;
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
                            <>Not Connected</>
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
                                    onClick={this.props.handleLogout}
                                    className="header--dropdown--option"
                                >
                                    Log out
                                </li>
                            </> :
                                <li
                                    role="button"
                                    onClick={this.props.handleLogin}
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

interface Props extends ConnectedProps<[AppContainer]> {
    handleLogin: () => {};
    handleLogout: () => {};
}

export const AccountDropdown = connect<Props>([AppContainer])(AccountDropdownClass);
