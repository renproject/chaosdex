import * as React from "react";

import { Loading } from "@renproject/react-components";

import { _catchBackgroundErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { NewOrder } from "../views/NewOrder";
import { OrderHistory } from "../views/OrderHistory";
import { OpeningOrder } from "./OpeningOrder";
import { PromptDetails } from "./PromptDetails";

interface Props {
    handleLogin: () => void;
}

/**
 * Exchange is the main token-swapping page.
 */
export const Exchange = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ handleLogin, containers: [uiContainer, sdkContainer] }) => {

        const cancel = () => {
            uiContainer.setSubmitting(false).catch(_catchBackgroundErr_);
        };

        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    <React.Suspense fallback={<Loading />}>
                        <NewOrder handleLogin={handleLogin} />
                        <OrderHistory />
                        {uiContainer.state.submitting ?
                            uiContainer.state.currentOrderID ?
                                <OpeningOrder cancel={cancel} orderID={uiContainer.state.currentOrderID} />
                                : <PromptDetails cancel={cancel} />
                            : <></>
                        }
                    </React.Suspense>
                </div>
            </div>
        </div>;
    }
);
