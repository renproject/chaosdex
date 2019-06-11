import * as React from "react";

import { FeedbackButton } from "@renex/react-components";
import { Route, RouteComponentProps, withRouter } from "react-router-dom";
import createPersistedState from "use-persisted-state";

import { _catchBackgroundErr_ } from "../../lib/errors";
import { AppContainer } from "../../state/appContainer";
import { connect, ConnectedProps } from "../../state/connect";
import { Exchange } from "../pages/Exchange";
import { _catch_ } from "../views/ErrorBoundary";
import { HeaderController } from "./HeaderController";

const useLoggedInState = createPersistedState("web3-logged-in");

// Scroll restoration based on https://reacttraining.com/react-router/web/guides/scroll-restoration
const ScrollToTop = withRouter(
    // tslint:disable-next-line:no-any
    class ScrollToTopWithoutRouter extends React.Component<RouteComponentProps<any>> {
        // tslint:disable-next-line:no-any
        public componentDidUpdate(prevProps: Readonly<RouteComponentProps<any>>): void {
            if (this.props.location !== prevProps.location) {
                window.scrollTo(0, 0);
            }
        }

        /**
         * The main render function.
         * @dev Should have minimal computation, loops and anonymous functions.
         */
        public render(): React.ReactNode {
            return <></>;
        }
    }
);

/**
 * App is the main visual component responsible for displaying different routes
 * and running background app loops
 */
type Props = ConnectedProps<[AppContainer]>;
export const App = connect<Props>([AppContainer])(
    (props) => {
        const { containers: [appContainer] } = props;
        const [loggedIn, setLoggedIn] = useLoggedInState(false);

        const login = async () => {
            await appContainer.connect();
            if (appContainer.state.address !== null) {
                setLoggedIn(true);
            }
        };

        const logout = async () => {
            await appContainer.clearAddress();
            setLoggedIn(false);
        };

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {
                setInterval(() => appContainer.updateTokenPrices().catch(_catchBackgroundErr_), 30 * 1000);
                setInterval(() => appContainer.updateBalanceReserves().catch(_catchBackgroundErr_), 30 * 1000);
                setInterval(() => appContainer.updateAccountBalances().catch(_catchBackgroundErr_), 30 * 1000);
                if (loggedIn) {
                    appContainer.connect().catch(_catchBackgroundErr_);
                }
                appContainer.updateTokenPrices().catch(_catchBackgroundErr_);
                appContainer.updateBalanceReserves().catch(_catchBackgroundErr_);
                appContainer.updateAccountBalances().catch(_catchBackgroundErr_);
                setInitialized(true);
            }
        }, [initialized, appContainer]);

        return <main className="app">
            <ScrollToTop />

            {_catch_(
                <React.Suspense fallback={null/*<Loading />*/}>
                    <HeaderController handleLogin={login} handleLogout={logout} />
                </React.Suspense>
            )}
            <Route path="/" exact={true} component={Exchange} />
            {_catch_(<FeedbackButton url="https://docs.google.com/forms/d/e/1FAIpQLScDqffrmK-CtAOvL9dM0SUJq8_No6lTMmjnfH8s7a4bIbrJvA/viewform" />)}
        </main>;
    }
);
