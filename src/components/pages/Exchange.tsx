import * as qs from "query-string";
import * as React from "react";

import { Loading } from "@renex/react-components";
import { RouteComponentProps } from "react-router";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { Token } from "../../state/generalTypes";
import { NewOrder } from "../controllers/NewOrder";
import { _catch_ } from "../views/ErrorBoundary";

/**
 * Exchange is the main token-swapping page.
 */
export const Exchange = connect<RouteComponentProps & ConnectedProps<[AppContainer]>>([AppContainer])(
    ({ containers: [appContainer], location }) => {

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {

                /*
                 * Set the URL based on the URL
                 * e.g. `URL?send=ETH&receive=DAI` will set the tokens to ETH
                 * and DAI.
                 */
                try {
                    const queryParams = qs.parse(location.search);
                    if (queryParams.send) {
                        appContainer.updateSrcToken(queryParams.send as Token).catch(_catchInteractionErr_);
                    }
                    if (queryParams.receive) {
                        appContainer.updateDstToken(queryParams.receive as Token).catch(_catchInteractionErr_);
                    }
                } catch (error) {
                    _catchInteractionErr_(error, {
                        description: "Error in Exchange.effect",
                        shownToUser: "No",
                    });
                }
                setInitialized(true);
            }
        }, [initialized, location.search, appContainer]);

        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    {_catch_(
                        <React.Suspense fallback={<Loading />}>
                            <NewOrder />
                        </React.Suspense>
                    )}
                </div>
            </div>
        </div>;
    }
);
