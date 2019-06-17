import * as React from "react";

import createPersistedState from "use-persisted-state";

import { _catchBackgroundErr_ } from "../../lib/errors";
import { AppContainer } from "../../state/appContainer";
import { connect, ConnectedProps } from "../../state/connect";
import { HeaderController } from "../views/HeaderController";
import { Exchange } from "./Exchange";

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
type Props = ConnectedProps<[AppContainer]>;
export const App = connect<Props>([AppContainer])(
    (props) => {
        const { containers: [appContainer] } = props;

        const login = async () => {
            await appContainer.connect();
        };

        const logout = async () => {
            await appContainer.clearAddress();
        };

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {
                setInterval(() => appContainer.updateTokenPrices().catch(_catchBackgroundErr_), 30 * 1000);
                setInterval(() => appContainer.updateBalanceReserves().catch(_catchBackgroundErr_), 30 * 1000);
                setInterval(() => appContainer.updateAccountBalances().catch(_catchBackgroundErr_), 30 * 1000);
                appContainer.connect().catch(_catchBackgroundErr_);
                appContainer.updateTokenPrices().catch(_catchBackgroundErr_);
                appContainer.updateBalanceReserves().catch(_catchBackgroundErr_);
                appContainer.updateAccountBalances().catch(_catchBackgroundErr_);
                setInitialized(true);
            }
        }, [initialized, appContainer]);

        return <main>
            <React.Suspense fallback={null}>
                <HeaderController handleLogin={login} handleLogout={logout} />
            </React.Suspense>
            <Exchange />
        </main>;
    }
);
