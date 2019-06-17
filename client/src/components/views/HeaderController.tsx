import * as React from "react";

import { currencies, CurrencyIcon, Dropdown, Header } from "@renex/react-components";
import { Link } from "react-router-dom";

import { AppContainer } from "../../state/appContainer";
import { connect, ConnectedProps } from "../../state/connect";
import { ReactComponent as Logo } from "../../styles/images/logo.svg";
import { AccountDropdown } from "./AccountDropdown";

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

const logo = <Link className="no-underline" to="/">
    <Logo />
    <h1>DEX Demo</h1>
</Link>;

interface Props extends ConnectedProps<[AppContainer]> {
    handleLogin: () => {};
    handleLogout: () => {};
}

/**
 * HeaderController is a visual component providing page branding and navigation.
 */
export const HeaderController = (connect<Props>([AppContainer])(
    ({ handleLogout, handleLogin, containers: [appContainer] }) => {
        const quoteCurrency = appContainer.state.preferredCurrency;
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
            setValue={appContainer.setCurrency}
        />;

        return <Header
            logo={logo}
            menu={[
                currencyDropdown, <AccountDropdown
                    key="AccountDropdown"
                    handleLogin={handleLogin}
                    handleLogout={handleLogout}
                />,
            ]}
        />;

    }
));
