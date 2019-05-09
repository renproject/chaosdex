import * as React from "react";

import { connect, ConnectedReturnType } from "react-redux"; // Custom typings
import { Redirect, Route, RouteComponentProps, Router, withRouter } from "react-router-dom";
import { bindActionCreators, Dispatch } from "redux";

import { _captureBackgroundException_ } from "../lib/errors";
import { history } from "../lib/history";
import { setAlert } from "../store/actions/alert/alertActions";
import { clearPopup, setPopup } from "../store/actions/popup/popupActions";
import { storeURL } from "../store/actions/trader/accountActions";
import { ApplicationData } from "../store/types/general";
import { Alerts } from "./Alerts";
import { Header } from "./Header";
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

    public constructor(props: Props, context: object) {
        super(props, context);
        this.state = {
            checkingReLogin: true,
        };
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { username, advanced, theme, advancedTheme } = this.props;
        return (
            <Router history={history}>
                <main className={`app ${advanced ? advancedTheme : theme}`}>
                    <div className="themed-app">
                        <ScrollToTop />

                        <div key={username || undefined}>
                            <PopupController>
                                {_catch_(<Header />)}
                                <Route path="/" exact={true} component={Exchange} />
                                {/* <Footer /> */}
                                {_catch_(<Alerts />)}
                            </PopupController>

                            {_catch_(<FeedbackButton />)}
                        </div>
                    </div>
                </main>
            </Router>
        );
    }
}

const mapStateToProps = (state: ApplicationData) => ({
    username: state.trader.username,
    agreedToTerms: state.trader.agreedToTerms,
    url: state.trader.url,

    advanced: state.trader.advanced,
    theme: state.trader.theme,
    advancedTheme: state.trader.advancedTheme,
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        clearPopup,
        setAlert,
        setPopup,
        storeURL,
    }, dispatch)
});

interface Props extends ReturnType<typeof mapStateToProps>, ConnectedReturnType<typeof mapDispatchToProps> {
}

interface State {
    /**
     * When the page is first loaded, the component checks the user
     * can be logged in automatically. While this is happening, we show a
     * spinner based on if checkingReLogin is true or not.
     */
    checkingReLogin: boolean;
}

export const App = connect(mapStateToProps, mapDispatchToProps)(AppClass);
