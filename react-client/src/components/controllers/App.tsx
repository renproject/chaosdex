import * as React from "react";

import { parse as parseLocation } from "qs";
import { RouteComponentProps, withRouter } from "react-router-dom";
import createPersistedState from "use-persisted-state";

import { ETHEREUM_NETWORK, ETHEREUM_NETWORK_ID } from "../../lib/environmentVariables";
import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../lib/errors";
import { getWeb3 } from "../../lib/getWeb3";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { HeaderController } from "../views/HeaderController";
import { Tutorial } from "../views/tutorial-popup/Tutorial";
import { Exchange } from "./Exchange";
import { FeedbackButton } from "@renproject/react-components";

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
            const web3 = await getWeb3();
            const networkID = await web3.eth.net.getId();
            if (ETHEREUM_NETWORK_ID && networkID.toString() !== ETHEREUM_NETWORK_ID) {
                alert(`Please switch to the ${ETHEREUM_NETWORK} Ethereum network.`);
                return;
            }
            const addresses = await web3.eth.getAccounts();
            const address = addresses.length > 0 ? addresses[0] : null;
            await uiContainer.connect(web3, address, networkID);
            await sdkContainer.connect(web3, address, networkID);

            uiContainer.updateTokenPrices().catch(_catchBackgroundErr_);
            uiContainer.updateBalanceReserves().catch(_catchBackgroundErr_);
            uiContainer.updateAccountBalances().catch(_catchBackgroundErr_);
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
                        uiContainer.updateBothTokens(queryParams.send as Token, queryParams.receive as Token).catch(_catchInteractionErr_);
                    } else {
                        if (queryParams.send) {
                            uiContainer.updateSrcToken(queryParams.send as Token).catch(_catchInteractionErr_);
                        }
                        if (queryParams.receive) {
                            uiContainer.updateDstToken(queryParams.receive as Token).catch(_catchInteractionErr_);
                        }
                    }
                } catch (error) {
                    _catchInteractionErr_(error, {
                        description: "Error in Exchange.effect",
                        shownToUser: "No",
                    });
                }

                // Start loops to update prices and balances
                setInterval(() => uiContainer.updateTokenPrices().catch(() => { /* ignore */ }), 10 * 1000);
                setInterval(() => uiContainer.updateBalanceReserves().catch(() => { /* ignore */ }), 10 * 1000);
                setInterval(() => uiContainer.updateAccountBalances().catch(() => { /* ignore */ }), 10 * 1000);
                if (!showingTutorial) {
                    login().then(() => {
                        setInitialized(true);
                    }).catch(_catchBackgroundErr_);
                } else {
                    setInitialized(true);
                }
            }
        }, [initialized, uiContainer, location.search, login, showingTutorial]);

        return <main>
            <React.Suspense fallback={null}>
                <HeaderController showTutorial={showTutorial} handleLogin={login} handleLogout={logout} />
            </React.Suspense>
            <Exchange handleLogin={login} />
            {showingTutorial ? <Tutorial cancel={hideTutorial} /> : null}
            <FeedbackButton url="https://renprotocol.typeform.com/to/YdmFyB" />
        </main>;
    }
));
