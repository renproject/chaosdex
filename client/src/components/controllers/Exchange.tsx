import * as React from "react";

import { Loading } from "@renex/react-components";
import { RouteComponentProps, withRouter } from "react-router";
import createPersistedState from "use-persisted-state";

import { _catchBackgroundErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { HistoryEvent, SDKContainer } from "../../state/sdkContainer";
import { NewOrder } from "../views/NewOrder";
import { OrderHistory } from "../views/OrderHistory";
import { OpeningOrder } from "./OpeningOrder";
import { PromptDetails } from "./PromptDetails";

const useOrderHistoryState = createPersistedState("order-history-v3");

interface StoredHistory {
    [outTx: string]: HistoryEvent;
}

/**
 * Exchange is the main token-swapping page.
 */
export const Exchange = withRouter(connect<RouteComponentProps & ConnectedProps<[SDKContainer]>>([SDKContainer])(
    ({ containers: [appContainer], location }) => {
        const [orderHistory, setOrderHistory] = useOrderHistoryState({} as unknown as StoredHistory);

        const cancel = () => {
            appContainer.setSubmitting(false).catch(_catchBackgroundErr_);
        };

        const swapSubmitted = (historyEvent: HistoryEvent) => {
            setOrderHistory((hist: StoredHistory) => {
                return {
                    ...hist,
                    [historyEvent.outTx.hash]: historyEvent,
                };
            });
        };

        const orders = Object.values(orderHistory as StoredHistory).sort((a, b) => b.time - a.time);

        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    <React.Suspense fallback={<Loading />}>
                        <NewOrder />
                        <OrderHistory orders={orders} pendingTXs={appContainer.state.pendingTXs} />
                        {appContainer.state.submitting ?
                            appContainer.state.refundAddress ?
                                <OpeningOrder cancel={cancel} swapSubmitted={swapSubmitted} />
                                : <PromptDetails cancel={cancel} />
                            : <></>
                        }
                    </React.Suspense>
                </div>
            </div>
        </div>;
    }
));
