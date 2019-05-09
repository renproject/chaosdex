import * as React from "react";

import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { currencies, Currency, CurrencyIcon } from "@renex/react-components";
import { connect, ConnectedReturnType } from "react-redux"; // Custom typings
import { Link, RouteComponentProps, withRouter } from "react-router-dom";
import { bindActionCreators, Dispatch } from "redux";

import { history } from "../lib/history";
import { storeQuoteCurrency } from "../store/actions/trader/accountActions";
import { ApplicationData } from "../store/types/general";

import English from "../styles/images/rp-flag-uk.svg";

import { ReactComponent as Logo } from "../styles/images/logo.svg";

/**
 * Header is a visual component providing page branding and navigation.
 */
class HeaderClass extends React.Component<Props, State> {
    private currentDropdown: HTMLElement | null = null;

    public constructor(props: Props, context: object) {
        super(props, context);
        this.state = {
            copied: false,
            accountDropdown: false,
            languageDropdown: false,
            currencyDropdown: false,
        };
    }

    public render = (): JSX.Element => {
        const { username, quoteCurrency } = this.props.store;
        const { accountDropdown, languageDropdown, currencyDropdown } = this.state;

        return (
            <div className="header">
                <div className="container">
                    <Link className="no-underline" to="/">
                        <div className="header--logo">
                            <Logo />
                        </div>
                    </Link>
                    <ul className="header--menu">

                        <li
                            data-id="languageDropdown"
                            className="header--group header--group--language"
                            role="menuitem"
                            onClick={this.toggleDropdown}
                        // onMouseEnter={this.showDropdown}
                        // onMouseLeave={this.hideDropdown}
                        >
                            <span>English</span><FontAwesomeIcon icon={faChevronDown} style={{ opacity: 0.6 }} />
                            {languageDropdown ?
                                <div className="header--dropdown--spacing header--dropdown--options">
                                    <ul className="header--dropdown">
                                        <li role="button">
                                            <img alt="" role="presentation" src={English} />
                                            {" "}
                                            English
                                            </li>
                                    </ul>
                                </div> : null
                            }
                        </li>

                        <li
                            data-id="currencyDropdown"
                            className="header--group header--group--currency"
                            role="menuitem"
                            onClick={this.toggleDropdown}
                        // onMouseEnter={this.showDropdown}
                        // onMouseLeave={this.hideDropdown}
                        >
                            <span><CurrencyIcon currency={quoteCurrency} />{" "}{quoteCurrency.toUpperCase()}</span><FontAwesomeIcon icon={faChevronDown} style={{ opacity: 0.6 }} />
                            {currencyDropdown ?
                                <div className="header--dropdown--spacing header--dropdown--currency">
                                    <ul className="header--dropdown">
                                        {currencies.map(({ currency, description }) => <li
                                            key={currency}
                                            role="button"
                                            data-id={currency}
                                            className={quoteCurrency === currency ?
                                                "header--dropdown--selected" :
                                                ""}
                                            onClick={this.setCurrency}
                                        >
                                            <CurrencyIcon currency={currency} />
                                            {" "}{description}
                                        </li>)}
                                    </ul>
                                </div> : null
                            }
                        </li>

                        <li
                            data-id="accountDropdown"
                            className="header--group"
                            role="menuitem"
                        >
                            <div className="header--account">
                                <div
                                    className={`header--account--right ${username ?
                                        "header--account--connected" :
                                        "header--account--disconnected"}`}
                                >
                                    <div className="header--account--type">
                                        {username ? username : <>Log in</>}
                                    </div>
                                </div>
                            </div>
                            {username && accountDropdown ?
                                <div className={`header--dropdown--spacing header--dropdown--login`}>
                                    <ul className={`header--dropdown`}>
                                        <li
                                            role="button"
                                        >
                                            Log out
                                        </li>
                                    </ul>
                                </div> : null
                            }
                        </li>
                    </ul>
                </div>
            </div>
        );
    }

    private readonly toggleDropdown = (e: React.MouseEvent<HTMLLIElement>): void => {
        const id = e.currentTarget.dataset ? e.currentTarget.dataset.id : undefined;
        if (id) {
            if (!this.state[id]) {
                this.currentDropdown = e.currentTarget;
                document.addEventListener("mousedown", this.clickAway);
            } else {
                this.currentDropdown = null;
                document.removeEventListener("mousedown", this.clickAway);
            }
            this.setState((state: State) => ({
                ...state,
                // Reset dropdown state
                accountDropdown: false,
                languageDropdown: false,
                currencyDropdown: false,
                copied: false,

                // Toggle target dropdown
                [id]: !state[id],
            }));
        }
    }

    private readonly clickAway: EventListenerOrEventListenerObject = (event) => {
        // tslint:disable-next-line: no-any
        if ((this.currentDropdown && !this.currentDropdown.contains(event.target as any))) {
            this.setState({
                // Reset dropdown state
                accountDropdown: false,
                languageDropdown: false,
                currencyDropdown: false,
                copied: false,
            });
        }
    }

    // private readonly showDropdown = (e: React.MouseEvent<HTMLLIElement>): void => {
    //     const id = e.currentTarget.dataset ? e.currentTarget.dataset.id : undefined;
    //     if (id) {
    //         this.setState((state: State) => ({ ...state, [id]: true, copied: false }));
    //     }
    // }

    // private readonly hideDropdown = (e: React.MouseEvent<HTMLLIElement>): void => {
    //     const id = e.currentTarget.dataset ? e.currentTarget.dataset.id : undefined;
    //     if (id) {
    //         this.setState((state: State) => ({ ...state, [id]: false, copied: false }));
    //     }
    // }

    private readonly setCurrency = (e: React.MouseEvent<HTMLLIElement>): void => {
        const id = e.currentTarget.dataset ? e.currentTarget.dataset.id : undefined;
        if (id) {
            this.props.actions.storeQuoteCurrency({ quoteCurrency: id as Currency });
        }
    }

    // private readonly copyToClipboard = (e: React.MouseEvent<HTMLElement>): void => {
    //     const el = e.currentTarget.childNodes[0] as Element;
    //     const address = el.getAttribute("data-addr");
    //     if (address) {
    //         const dummy = document.createElement("input");
    //         document.body.appendChild(dummy);
    //         dummy.setAttribute("value", address);
    //         dummy.select();
    //         document.execCommand("copy");
    //         document.body.removeChild(dummy);
    //     }
    //     this.setState({ copied: true });
    // }
}

const mapStateToProps = (state: ApplicationData) => ({
    store: {
        quoteCurrency: state.trader.quoteCurrency,
        username: state.trader.username,
    },
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        storeQuoteCurrency,
    }, dispatch),
});

interface Props extends ReturnType<typeof mapStateToProps>, ConnectedReturnType<typeof mapDispatchToProps>,
    RouteComponentProps {
}

interface State {
    accountDropdown: boolean;
    languageDropdown: boolean;
    currencyDropdown: boolean;
    copied: boolean;
}

export const Header = connect(mapStateToProps, mapDispatchToProps)(withRouter(HeaderClass));
