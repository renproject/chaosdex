import * as React from "react";

import { Header } from "@renex/react-components";
import { Link } from "react-router-dom";

import { AppContainer } from "../../state/appContainer";
import { connect, ConnectedProps } from "../../state/connect";
import { ReactComponent as Logo } from "../../styles/images/logo.svg";
import { AccountDropdown } from "./AccountDropdown";

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
        return <Header
            logo={logo}
            menu={[
                <AccountDropdown
                    key="AccountDropdown"
                    handleLogin={handleLogin}
                    handleLogout={handleLogout}
                />,
            ]}
        />;

    }
));
