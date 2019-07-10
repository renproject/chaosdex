import * as React from "react";

import { Loading } from "@renproject/react-components";
import createPersistedState from "use-persisted-state";

import { _catchBackgroundErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { HistoryEvent, SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { NewOrder } from "../views/NewOrder";
import { OrderHistory } from "../views/OrderHistory";
import { OpeningOrder } from "./OpeningOrder";
import { PromptDetails } from "./PromptDetails";

const useOrderHistoryState = createPersistedState("order-history-v3");

interface StoredHistory {
    [outTx: string]: HistoryEvent;
}

interface Props {
    handleLogin: () => void;
}

/**
 * Exchange is the main token-swapping page.
 */
export const Exchange = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ handleLogin, containers: [uiContainer, sdkContainer] }) => {
        const [orderHistory, setOrderHistory] = useOrderHistoryState({} as unknown as StoredHistory);

        const cancel = () => {
            uiContainer.setSubmitting(false).catch(_catchBackgroundErr_);
        };

        const swapSubmitted = (historyEvent: HistoryEvent) => {
            setOrderHistory((hist: StoredHistory) => {
                return {
                    ...hist,
                    [historyEvent.time]: historyEvent,
                };
            });
        };

        const orders = Object.values(orderHistory as StoredHistory).sort((a, b) => b.time - a.time);

        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    <React.Suspense fallback={<Loading />}>
                        <NewOrder handleLogin={handleLogin} />
                        <OrderHistory orders={orders} />
                        {uiContainer.state.submitting ?
                            sdkContainer.state.commitment ?
                                <OpeningOrder cancel={cancel} swapSubmitted={swapSubmitted} />
                                : <PromptDetails cancel={cancel} />
                            : <></>
                        }
                    </React.Suspense>
                </div>
            </div>
        </div>;
    }
);
