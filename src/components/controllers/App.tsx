import * as React from "react";

import { FeedbackButton, Loading } from "@renex/react-components";
import { Route, RouteComponentProps, withRouter } from "react-router-dom";

import { _catchBackgroundErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer, OptionsContainer } from "../../state/containers";
import { Exchange } from "../pages/Exchange";
import { _catch_ } from "../views/ErrorBoundary";
import { HeaderController } from "./HeaderController";

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
type Props = ConnectedProps<[AppContainer, OptionsContainer]>;
export const App = connect<Props>([AppContainer, OptionsContainer])(
    (props) => {

        const { containers: [appContainer, optionsContainer] } = props;

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {
                setInterval(() => appContainer.updateTokenPrices().catch(_catchBackgroundErr_), 30 * 1000);
                setInterval(() => appContainer.updateBalanceReserves().catch(_catchBackgroundErr_), 30 * 1000);
                appContainer.updateTokenPrices().catch(_catchBackgroundErr_);
                appContainer.updateBalanceReserves().catch(_catchBackgroundErr_);
                setInitialized(true);
            }
        }, [initialized, appContainer]);

        return <main className={`app ${optionsContainer.state.theme}`}>
            <ScrollToTop />

            {_catch_(
                <React.Suspense fallback={<Loading />}>
                    <HeaderController />
                </React.Suspense>
            )}
            <Route path="/" exact={true} component={Exchange} />
            {_catch_(<FeedbackButton url="https://docs.google.com/forms/d/e/1FAIpQLScDqffrmK-CtAOvL9dM0SUJq8_No6lTMmjnfH8s7a4bIbrJvA/viewform" />)}
        </main>;
    }
);
