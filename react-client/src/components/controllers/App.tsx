import * as React from "react";

import { FeedbackButton } from "@renproject/react-components";
import { parse as parseLocation } from "qs";
import { Route, RouteComponentProps, Switch, withRouter } from "react-router-dom";
import createPersistedState from "use-persisted-state";

import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../lib/errors";
import { getWeb3 } from "../../lib/getWeb3";
import { setIntervalAndRun } from "../../lib/utils";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { network, SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { ErrorBoundary } from "../ErrorBoundary";
import { HeaderController } from "../views/HeaderController";
import { LoggedOutPopup } from "../views/LoggedOutPopup";
import { Tutorial } from "../views/tutorial-popup/Tutorial";
import { Exchange } from "./Exchange";
import { Stats } from "./Stats";

const useTutorialState = createPersistedState("show-tutorial");

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
export const App = withRouter(connect<RouteComponentProps & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], location }) => {

        const [showingTutorial, setShowTutorial] = useTutorialState(true);

        const hideTutorial = React.useCallback(async () => {
            setShowTutorial(false);
        }, [setShowTutorial]);

        const showTutorial = React.useCallback(async () => {
            setShowTutorial(true);
        }, [setShowTutorial]);

        const login = React.useCallback(async () => {
            let web3 = uiContainer.state.web3;
            try {
                web3 = await getWeb3();
            } catch (error) {
                // ignore error
            }

            const πNetworkID = web3.eth.net.getId();
            const πAddresses = web3.eth.getAccounts();

            const networkID = await πNetworkID;
            if (network.contracts.networkID && networkID !== network.contracts.networkID) {
                alert(`Please switch to the ${network.contracts.chainLabel} Ethereum network.`);
                return;
            }
            const addresses = await πAddresses;
            const address = addresses.length > 0 ? addresses[0] : null;

            await Promise.all([
                uiContainer.connect(web3, address, networkID),
                sdkContainer.connect(web3, address, networkID),
            ]);
        }, [sdkContainer, uiContainer]);

        const logout = React.useCallback(async () => {
            await uiContainer.clearAddress();
        }, [uiContainer]);

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
                        uiContainer
                            .updateBothTokens(queryParams.send as Token, queryParams.receive as Token)
                            .catch(error => _catchInteractionErr_(error, "Error in App: updateBothTokens"));
                    } else {
                        if (queryParams.send) {
                            uiContainer
                                .updateSrcToken(queryParams.send as Token)
                                .catch(error => _catchInteractionErr_(error, "Error in App: updateSrcToken"));
                        }
                        if (queryParams.receive) {
                            uiContainer
                                .updateDstToken(queryParams.receive as Token)
                                .catch(error => _catchInteractionErr_(error, "Error in App: updateDstToken"));
                        }
                    }
                } catch (error) {
                    _catchInteractionErr_(error, {
                        description: "Error in Exchange.effect",
                    });
                }

                // Start loops to update prices and balances
                setIntervalAndRun(() => uiContainer.updateTokenPrices().catch(() => { /* ignore */ }), 30 * 1000);
                setIntervalAndRun(() => uiContainer.updateReserveBalances().catch(() => { /* ignore */ }), 30 * 1000);
                setInterval(() => uiContainer.updateAccountBalances().catch(() => { /* ignore */ }), 20 * 1000);
                setInterval(() => uiContainer.lookForLogout(), 1 * 1000);
                if (!showingTutorial) {
                    login().then(() => {
                        setInitialized(true);
                    }).catch(error => _catchBackgroundErr_(error, "Error in App: login"));
                } else {
                    setInitialized(true);
                }
            }
        }, [initialized, uiContainer, location.search, login, showingTutorial]);

        const { loggedOut } = uiContainer.state;

        return <main>
            <ErrorBoundary>
                <React.Suspense fallback={null}>
                    <HeaderController showTutorial={showTutorial} handleLogin={login} handleLogout={logout} />
                </React.Suspense>
            </ErrorBoundary>
            <ErrorBoundary>
                <Switch>
                    {/* tslint:disable: jsx-no-lambda react-this-binding-issue */}
                    <Route path="/stats" exact={true} render={() => <Stats />} />
                    {/* tslint:disable: jsx-no-lambda react-this-binding-issue */}
                    <Route render={() => <Exchange handleLogin={login} />} />
                </Switch>
            </ErrorBoundary>
            <ErrorBoundary>
                {loggedOut ?
                    <LoggedOutPopup oldAccount={loggedOut} /> :
                    <></>
                }
            </ErrorBoundary>
            <ErrorBoundary>{showingTutorial ? <Tutorial cancel={hideTutorial} /> : null}</ErrorBoundary>
            <ErrorBoundary><FeedbackButton url="https://renprotocol.typeform.com/to/YdmFyB" /></ErrorBoundary>
        </main>;
    }
));
