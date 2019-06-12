import * as React from "react";

import { currencies, CurrencyIcon, Dropdown, Header } from "@renex/react-components";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { AppContainer } from "../../state/appContainer";
import { connect, ConnectedProps } from "../../state/connect";
import { ReactComponent as Logo } from "../../styles/images/logo.svg";
import { ReactComponent as German } from "../../styles/images/rp-flag-de.svg";
import { ReactComponent as English } from "../../styles/images/rp-flag-uk.svg";
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
        const { t, i18n } = useTranslation();

        const [currentLanguage, setCurrentLanguage] = React.useState(i18n.language);
        const [currentLanguageName, setCurrentLanguageName] = React.useState(t("language.currentLanguageName"));

        const setLanguage = async (language: string): Promise<void> => {
            await i18n.changeLanguage(language);
            setCurrentLanguage(language);
            setCurrentLanguageName(t("language.currentLanguageName"));
        };

        const languageOptions = new Map()
            .set("en", <><English /> {t("language.english")}</>)
            .set("de", <><German /> {t("language.german")}</>);

        const languageDropdown = <Dropdown
            key="languageDropdown"
            selected={{
                value: currentLanguage,
                render: currentLanguageName,
            }}
            options={languageOptions}
            setValue={setLanguage}
        />;

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
                languageDropdown, currencyDropdown, <AccountDropdown
                    key="AccountDropdown"
                    handleLogin={handleLogin}
                    handleLogout={handleLogout}
                />,
            ]}
        />;

    }
));
