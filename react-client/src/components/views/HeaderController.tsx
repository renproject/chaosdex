import * as React from "react";

import { currencies, CurrencyIcon, Dropdown, Header } from "@renproject/react-components";
import { Nav, Navbar, NavDropdown } from "react-bootstrap";
import { Link } from "react-router-dom";

import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";
import { ReactComponent as Build } from "../../styles/images/icons/build.svg";
import { ReactComponent as Docs } from "../../styles/images/icons/docs.svg";
import { ReactComponent as FAQ } from "../../styles/images/icons/faq.svg";
import { ReactComponent as Tutorial } from "../../styles/images/icons/tutorial.svg";
import { ReactComponent as Logo } from "../../styles/images/logo.svg";
import { BUILD_LINK, DOCS_LINK, FAQ_LINK } from "../views/tutorial-popup/TutorialPages";

const currencyOptions = (() => {
    const options = new Map<string, React.ReactNode>();

    for (const currency of currencies) {
        options.set(currency.currency, <>
            <CurrencyIcon currency={currency.currency} />
            {" "}{currency.description}
        </>);
    }

    return options;
})();

const logo = <Link className="header--logo no-underline" to="/">
    <Logo />
    <h1>DEX Demo</h1>
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
        const currencyDropdown = <Dropdown
            key="currencyDropdown"
            selected={{
                value: quoteCurrency,
                render: <>
                    <CurrencyIcon currency={quoteCurrency} />
                    {" "}{quoteCurrency.toUpperCase()}
                </>
            }}
            options={currencyOptions}
            setValue={uiContainer.setCurrency}
        />;

        const { address } = uiContainer.state;
        const account = <div
            className={`header--account--type ${address ?
                "header--account--connected" :
                "header--account--disconnected"}`}
        >
            {address ?
                <>{address.substring(0, 8)}...{address.slice(-5)}</> :
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
                        <Nav.Link className="nav--button nav--button-border" onClick={showTutorial}><Tutorial /> Welcome Tutorial</Nav.Link>
                        <div className="nav--divider" />
                        <Nav.Link className="nav--button" target="_blank" rel="noopener noreferrer" href={BUILD_LINK}><Build /> Integrate RenVM</Nav.Link>
                        <Nav.Link className="nav--button" target="_blank" rel="noopener noreferrer" href={DOCS_LINK}><Docs /> Read the docs</Nav.Link>
                        <Nav.Link className="nav--button" target="_blank" rel="noopener noreferrer" href={FAQ_LINK}><FAQ /> FAQs</Nav.Link>
                    </Nav>
                </Navbar.Collapse>
                <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
                    <Nav>
                        <NavDropdown title={<><CurrencyIcon currency={quoteCurrency} /> {quoteCurrency.toUpperCase()}</>} className="nav--bubble" id="currency-dropdown">
                            {
                                currencies.map(({ currency, description }) =>
                                    // tslint:disable-next-line: react-this-binding-issue jsx-no-lambda
                                    <NavDropdown.Item key={currency} onClick={() => uiContainer.setCurrency(currency)}>
                                        <CurrencyIcon currency={currency} />
                                        {" "}{description}
                                    </NavDropdown.Item>
                                )
                            }
                        </NavDropdown>
                        <NavDropdown title={account} className="nav--bubble" id="dropdown">
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
