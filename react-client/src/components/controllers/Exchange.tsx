import * as React from "react";

import { Loading } from "@renproject/react-components";

import { className } from "../../lib/className";
import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { ExchangeTabs, UIContainer } from "../../state/uiContainer";
import { _catch_ } from "../ErrorBoundary";
import { LiquidityForm } from "../views/exchange-forms/LiquidityForm";
import { OrderForm } from "../views/exchange-forms/OrderForm";
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

        const onSwapTab = React.useCallback(() => { uiContainer.setExchangeTab(ExchangeTabs.Swap).catch(_catchInteractionErr_); }, [uiContainer]);
        const onLiquidityTab = React.useCallback(() => { uiContainer.setExchangeTab(ExchangeTabs.Liquidity).catch(_catchInteractionErr_); }, [uiContainer]);

        const cancel = React.useCallback(async () => {
            await uiContainer.setSubmitting(false);
        }, [uiContainer]);

        const { exchangeTab } = uiContainer.state;

        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    <React.Suspense fallback={<Loading />}>
                        <div className="exchange--tabs">
                            <button onClick={onSwapTab} className={className("exchange--tab", exchangeTab === ExchangeTabs.Swap ? "exchange--tab--selected" : "")}>Swap</button>
                            <button onClick={onLiquidityTab} className={className("exchange--tab", exchangeTab === ExchangeTabs.Liquidity ? "exchange--tab--selected" : "")}>Liquidity</button>
                        </div>
                        {exchangeTab === ExchangeTabs.Swap ?
                            _catch_(<OrderForm handleLogin={handleLogin} />) :
                            _catch_(<LiquidityForm handleLogin={handleLogin} />)
                        }
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
        </div >;
    }
);
