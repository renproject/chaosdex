import * as React from "react";

import { currencies, Currency, CurrencyIcon, Dropdown, Header } from "@renex/react-components";
import { WithTranslation, withTranslation } from "react-i18next";
import { connect, ConnectedReturnType } from "react-redux"; // Custom typings
import { Link, RouteComponentProps, withRouter } from "react-router-dom";
import { bindActionCreators, Dispatch } from "redux";

import { storeQuoteCurrency } from "../store/actions/trader/accountActions";
import { ApplicationData } from "../store/types/general";

import { ReactComponent as German } from "../styles/images/rp-flag-de.svg";
import { ReactComponent as English } from "../styles/images/rp-flag-uk.svg";

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
    public render = (): JSX.Element => {
        const { store, t } = this.props;
        const { quoteCurrency } = store;

        const languageOptions = new Map()
            .set("en",
                <><English /> {t("english")}</>
            )
            .set("de",
                <><German /> {t("german")}</>
            );

        const languageDropdown = <Dropdown
            key="languageDropdown"
            selected={{
                value: "en",
                render: t("english")
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

    private readonly setCurrency = (quoteCurrency: Currency): void => {
        this.props.actions.storeQuoteCurrency({ quoteCurrency });
    }

    private readonly setLanguage = async (language: string): Promise<void> => {
        await this.props.i18n.changeLanguage(language);
    }
}

const mapStateToProps = (state: ApplicationData) => ({
    store: {
        quoteCurrency: state.trader.quoteCurrency,
    },
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        storeQuoteCurrency,
    }, dispatch),
});

interface Props extends ReturnType<typeof mapStateToProps>, ConnectedReturnType<typeof mapDispatchToProps>,
    RouteComponentProps, WithTranslation {
}

interface State {
}

const TranslatedHeader = withTranslation()(HeaderClass);

export const HeaderController = connect(mapStateToProps, mapDispatchToProps)(withRouter(TranslatedHeader));
