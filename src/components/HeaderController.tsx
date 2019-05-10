import * as React from "react";

import { currencies, Currency, CurrencyIcon, Dropdown, Header } from "@renex/react-components";
import { WithTranslation, withTranslation } from "react-i18next";
import { Link, RouteComponentProps, withRouter } from "react-router-dom";
import { bindActionCreators, Dispatch } from "redux";

import { storeQuoteCurrency } from "../store/actions/trader/accountActions";
import { ApplicationData } from "../store/types/general";

import { ReactComponent as German } from "../styles/images/rp-flag-de.svg";
import { ReactComponent as English } from "../styles/images/rp-flag-uk.svg";

import { connect, ConnectedProps } from "../state/connect";
import { OptionsContainer } from "../state/containers";
import { ReactComponent as Logo } from "../styles/images/logo.svg";
import { AccountDropdown } from "./AccountDropdown";

const getCurrencyOptions = () => {
    const options = new Map<string, React.ReactNode>();

    for (const currency of currencies) {
        options.set(currency.currency, <>
            <CurrencyIcon currency={currency.currency} />
            {" "}{currency.description}
        </>);
    }

    return options;
};

const currencyOptions = getCurrencyOptions();

const logo = <Link className="no-underline" to="/">
    <Logo />
    <span>beta</span>
</Link>;

/**
 * Header is a visual component providing page branding and navigation.
 */
class HeaderClass extends React.Component<Props, State> {
    private readonly optionsContainer: OptionsContainer;

    constructor(props: Props) {
        super(props);
        [this.optionsContainer] = props.containers;
        const { t, i18n } = props;
        this.state = {
            currentLanguage: i18n.language,
            currentLanguageName: t("language.currentLanguageName"),
        };
    }

    public render = (): JSX.Element => {
        const { t } = this.props;
        const quoteCurrency = this.optionsContainer.state.preferredCurrency;

        const languageOptions = new Map()
            .set("en",
                <><English /> {t("language.english")}</>
            )
            .set("de",
                <><German /> {t("language.german")}</>
            );

        const languageDropdown = <Dropdown
            key="languageDropdown"
            selected={{
                value: this.state.currentLanguage,
                render: this.state.currentLanguageName,
            }}
            options={languageOptions}
            setValue={this.setLanguage}
        />;

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
            setValue={this.setCurrency}
        />;

        return <Header
            logo={logo}
            menu={[
                languageDropdown, currencyDropdown, <AccountDropdown key="AccountDropdown" />,
            ]}
        />;
    }

    private readonly setCurrency = async (quoteCurrency: Currency): Promise<void> => {
        await this.optionsContainer.setCurrency(quoteCurrency);
    }

    private readonly setLanguage = async (language: string): Promise<void> => {
        const { t, i18n } = this.props;
        await i18n.changeLanguage(language);
        this.setState({
            currentLanguage: language,
            currentLanguageName: t("language.currentLanguageName"),
        });
    }
}
interface Props extends ConnectedProps, RouteComponentProps, WithTranslation {
}

interface State {
    currentLanguage: string;
    currentLanguageName: string;
}

export const HeaderController = withTranslation()(withRouter(connect<Props>([OptionsContainer])(HeaderClass)));
