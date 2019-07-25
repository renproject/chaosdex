import * as React from "react";

import { Loading } from "@renproject/react-components";

import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";
import { _catch_ } from "../ErrorBoundary";
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
export const Exchange = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ handleLogin, containers: [uiContainer] }) => {

        const cancel = async () => {
            await uiContainer.setSubmitting(false);
        };

        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    <React.Suspense fallback={<Loading />}>
                        {_catch_(<NewOrder handleLogin={handleLogin} />)}
                        {_catch_(<OrderHistory />)}
                        {uiContainer.state.submitting ?
                            <PromptDetails cancel={cancel} /> :
                            <></>
                        }
                        {uiContainer.state.currentOrderID ?
                            <OpeningOrder orderID={uiContainer.state.currentOrderID} /> :
                            <></>
                        }
                    </React.Suspense>
                </div>
            </div>
        </div>;
    }
);
