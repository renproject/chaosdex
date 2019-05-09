import * as React from "react";

import { Blocky, Loading } from "@renex/react-components";
import { connect, ConnectedReturnType } from "react-redux";
import { bindActionCreators, Dispatch } from "redux";

import { ApplicationData } from "../store/types/general";

const defaultState = { // Entries must be immutable
    shown: false,
    copied: false,
};

// tslint:disable: react-unused-props-and-state
class AccountDropdownClass extends React.Component<Props, typeof defaultState> {
    private ref: HTMLDivElement | null = null;

    constructor(props: Props) {
        super(props);
        this.state = defaultState;
    }

    public render = () => {
        const { address } = this.props.store;
        const { copied } = this.state;

        const { shown } = this.state;

        return <div
            className="header--group header--group--account"
            ref={this.setRef}
        >
            <div className="header--account header--selected header--selected" role="menuitem" onClick={this.toggle}>
                {address && <Blocky address={address} />}
                <div
                    className={`header--account--right ${address ?
                        "header--account--connected" :
                        "header--account--disconnected"}`}
                >
                    <div className="header--account--type">
                        Logged in
                    </div>
                    {address ?
                        <div className="header--account--address">
                            {address.substring(0, 8)}...{address.slice(-5)}
                        </div> :
                        <div className="header--account--address">Not connected</div>
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
                                Log out
                            </li>
                        </> :
                            <li
                                role="button"
                                onClick={this.handleLogin}
                                className="header--dropdown--option header--dropdown--highlight"
                            >
                                Log in
                            </li>
                        }
                    </ul>
                </div> : <></>
            }
        </div>;
    }

    private readonly handleLogin = async (): Promise<void> => {
        const { address } = this.props.store;
        if (!address) {
            // await this.props.actions.login({ redirect: false, showPopup: true, immediatePopup: true });
        }
    }

    private readonly handleLogout = async (): Promise<void> => {
        // await this.props.actions.logout({ reload: false });
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

    // tslint:disable-next-line: no-any
    private readonly clickAway = (event: any) => {
        // tslint:disable-next-line: no-any
        if ((this.ref && !this.ref.contains(event.target))) {
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

const mapStateToProps = (state: ApplicationData) => ({
    store: {
        address: state.trader.address,
    },
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
    }, dispatch),
});

interface Props extends ReturnType<typeof mapStateToProps>, ConnectedReturnType<typeof mapDispatchToProps> {
}

export const AccountDropdown = connect(mapStateToProps, mapDispatchToProps)(AccountDropdownClass);
