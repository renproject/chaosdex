import * as React from "react";

import { Loading } from "@renex/react-components";
import { Route, RouteComponentProps, Router, withRouter } from "react-router-dom";

import { _captureBackgroundException_ } from "../lib/errors";
import { history } from "../lib/history";
import { connect, ConnectedProps } from "../state/connect";
import { AppContainer, OptionsContainer } from "../state/containers";
import { HeaderController } from "./HeaderController";
import { Exchange } from "./pages/Exchange";
import { PopupController } from "./popups/PopupController";
import { _catch_ } from "./views/ErrorBoundary";
import { FeedbackButton } from "./views/FeedbackButton";

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
class AppClass extends React.Component<Props, State> {
    private readonly appContainer: AppContainer;
    private readonly optionsContainer: OptionsContainer;

    public constructor(props: Props, context: object) {
        super(props, context);
        [this.appContainer, this.optionsContainer] = this.props.containers;
        setInterval(this.appContainer.updateTokenPrices, 30 * 1000);
        setInterval(this.appContainer.updateBalanceReserves, 30 * 1000);
    }

    public async componentDidMount(): Promise<void> {
        await this.appContainer.updateTokenPrices();
        await this.appContainer.updateBalanceReserves();
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        return (
            <Router history={history}>
                <main className={`app ${this.optionsContainer.state.theme}`}>
                    <div className="themed-app">
                        <ScrollToTop />

                        <div>
                            <PopupController>
                                {_catch_(
                                    <React.Suspense fallback={<Loading />}>
                                        <HeaderController />
                                    </React.Suspense>
                                )}
                                <Route path="/" exact={true} component={Exchange} />
                                {/* <Footer /> */}
                                {/*_catch_(<Alerts />)*/}
                            </PopupController>

                            {_catch_(<FeedbackButton />)}
                        </div>
                    </div>
                </main>
            </Router>
        );
    }
}

interface Props extends ConnectedProps {
}

interface State {
}

export const App = connect<Props>([AppContainer, OptionsContainer])(AppClass);
