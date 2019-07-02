import * as React from "react";

import { parse as parseLocation } from "qs";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { HeaderController } from "../views/HeaderController";
import { Exchange } from "./Exchange";

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
export const App = withRouter(connect<RouteComponentProps & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ containers: [appContainer], location }) => {

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

                // Set the URL based on the URL
                // e.g. `URL?send=ETH&receive=DAI` will set the tokens to ETH
                // and DAI.
                try {
                    const queryParams = parseLocation(location.search.replace(/^\?/, ""));
                    if (queryParams.send && queryParams.receive) {
                        appContainer.updateBothTokens(queryParams.send as Token, queryParams.receive as Token).catch(_catchInteractionErr_);
                    } else {
                        if (queryParams.send) {
                            appContainer.updateSrcToken(queryParams.send as Token).catch(_catchInteractionErr_);
                        }
                        if (queryParams.receive) {
                            appContainer.updateDstToken(queryParams.receive as Token).catch(_catchInteractionErr_);
                        }
                    }
                } catch (error) {
                    _catchInteractionErr_(error, {
                        description: "Error in Exchange.effect",
                        shownToUser: "No",
                    });
                }

                // Start loops to update prices and balances
                setInterval(() => appContainer.updateTokenPrices().catch(_catchBackgroundErr_), 10 * 1000);
                setInterval(() => appContainer.updateBalanceReserves().catch(_catchBackgroundErr_), 10 * 1000);
                setInterval(() => appContainer.updateAccountBalances().catch(_catchBackgroundErr_), 10 * 1000);
                appContainer.connect().then(() => {
                    appContainer.updateTokenPrices().catch(_catchBackgroundErr_);
                    appContainer.updateBalanceReserves().catch(_catchBackgroundErr_);
                    appContainer.updateAccountBalances().catch(_catchBackgroundErr_);
                    setInitialized(true);
                }).catch(_catchBackgroundErr_);
            }
        }, [initialized, appContainer, location.search]);

        return <main>
            <React.Suspense fallback={null}>
                <HeaderController handleLogin={login} handleLogout={logout} />
            </React.Suspense>
            <Exchange />
        </main>;
    }
));
