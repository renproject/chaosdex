import * as React from "react";

import { Blocky, currencies, CurrencyIcon } from "@renproject/react-components";
import { Nav, Navbar, NavDropdown } from "react-bootstrap";
// import Nav from "react-bootstrap/Nav";
// import Navbar from "react-bootstrap/Navbar";
// import NavDropdown from "react-bootstrap/NavDropdown";
import { Link } from "react-router-dom";

import { DocsIcon, FAQIcon, HowItWorksIcon, TutorialIcon } from "../../lib/icons";
import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";
import { ReactComponent as LogoSmall } from "../../styles/images/logo-small.svg";
import { ReactComponent as Logo } from "../../styles/images/logo.svg";
import {
    BUILDWITHRENVM_LINK, FAQ_LINK, READTHEDOCS_LINK,
} from "../views/tutorial-popup/TutorialPages";

// const currencyOptions = (() => {
//     const options = new Map<string, React.ReactNode>();

//     for (const currency of currencies) {
//         options.set(currency.currency, <>
//             <CurrencyIcon currency={currency.currency} />
//             {" "}{currency.description}
//         </>);
//     }

//     return options;
// })();

const logo = <Link className="header--logo no-underline" to="/">
    <Logo className="ren-logo-big" />
    <LogoSmall className="ren-logo-small" />
</Link>;

interface Props extends ConnectedProps<[UIContainer]> {
    showTutorial: () => void;
    handleLogin: () => void;
    handleLogout: () => void;
}

/**
 * HeaderController is a visual component providing page branding and navigation.
 */
export const HeaderController = (connect<Props>([UIContainer])(
    ({ showTutorial, handleLogout, handleLogin, containers: [uiContainer] }) => {

        const quoteCurrency = uiContainer.state.preferredCurrency;
        // const currencyDropdown = <Dropdown
        //     key="currencyDropdown"
        //     selected={{
        //         value: quoteCurrency,
        //         render: <>
        //             <CurrencyIcon currency={quoteCurrency} />
        //             {" "}{quoteCurrency.toUpperCase()}
        //         </>
        //     }}
        //     options={currencyOptions}
        //     setValue={uiContainer.setCurrency}
        // />;

        const { address } = uiContainer.state;
        const account = <div
            className={`header--account--type ${address ?
                "header--account--connected" :
                "header--account--disconnected"}`}
        >
            {address ?
                <div className="header--account--address"><Blocky address={address} /><span>{address.substring(0, 8)}...{address.slice(-5)}</span></div> :
                <>Not connected</>
            }
        </div>;

        const copyToClipboard = (): void => {
            if (address) {
                const fauxInput = document.createElement("input");
                document.body.appendChild(fauxInput);
                fauxInput.setAttribute("value", address);
                fauxInput.select();
                document.execCommand("copy");
                document.body.removeChild(fauxInput);
            }
        };

        return <div className="container">
            <Navbar expand="lg">
                <Navbar.Brand>
                    {logo}
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="links-navbar-nav">
                    <Nav>
                        <Nav.Link className="nav--button nav--button-border" onClick={showTutorial}><TutorialIcon /><span>Welcome Tutorial</span></Nav.Link>
                        <div className="nav--divider" />
                        <Nav.Link className="nav--button" target="_blank" rel="noopener noreferrer" href={BUILDWITHRENVM_LINK}><HowItWorksIcon />Build with RenVM</Nav.Link>
                        <Nav.Link className="nav--button" target="_blank" rel="noopener noreferrer" href={READTHEDOCS_LINK}><DocsIcon />Read the docs</Nav.Link>
                        <Nav.Link className="nav--button" target="_blank" rel="noopener noreferrer" href={FAQ_LINK}><FAQIcon />FAQs</Nav.Link>
                    </Nav>
                </Navbar.Collapse>
                <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
                    <Nav>
                        <NavDropdown title={<span><CurrencyIcon currency={quoteCurrency} /> {quoteCurrency.toUpperCase()}</span>} className="nav--bubble" id="currency-dropdown">
                            {
                                currencies.map(({ currency, description }) =>
                                    // tslint:disable-next-line: react-this-binding-issue jsx-no-lambda
                                    <NavDropdown.Item key={currency} onClick={() => uiContainer.setCurrency(currency)}>
                                        <CurrencyIcon currency={currency} />
                                        {" "}
                                        {description}
                                    </NavDropdown.Item>
                                )
                            }
                        </NavDropdown>
                        <NavDropdown title={account} className="nav--bubble nav-dropdown--account" id="dropdown">
                            {address ?
                                <>
                                    <NavDropdown.Item onClick={copyToClipboard}>Copy address</NavDropdown.Item>
                                    <NavDropdown.Item onClick={handleLogout}>Log Out</NavDropdown.Item>
                                </> : <>
                                    <NavDropdown.Item onClick={handleLogin}>Connect wallet</NavDropdown.Item>
                                </>
                            }
                        </NavDropdown>
                    </Nav>
                </Navbar.Collapse>
            </Navbar>
        </div>;
    }
));
