import * as React from "react";

import { Loading } from "@renproject/react-components";

import { className } from "../../lib/className";
import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { ExchangeTabs, UIContainer } from "../../state/uiContainer";
import { ReactComponent as Warning } from "../../styles/images/warning.svg";
import { ErrorBoundary } from "../ErrorBoundary";
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

        const onSwapTab = React.useCallback(async () => {
            (async () => {
                await uiContainer.resetReceiveValue();
                await uiContainer.setExchangeTab(ExchangeTabs.Swap);
            })().catch(_catchInteractionErr_);
        }, [uiContainer]);
        const onLiquidityTab = React.useCallback(() => {
            const { srcToken, dstToken } = uiContainer.state.orderInputs;

            // If src token is DAI, set it to the dst token - unless it's also DAI
            const newSrcToken = srcToken === Token.DAI ? (dstToken === Token.DAI ? Token.BTC : dstToken) : srcToken;
            uiContainer.resetReceiveValue().then(() => {
                uiContainer.updateBothTokens(newSrcToken, Token.DAI).catch(_catchInteractionErr_);
                uiContainer.setExchangeTab(ExchangeTabs.Liquidity).catch(_catchInteractionErr_);
            }).catch(_catchInteractionErr_);
        }, [uiContainer]);

        const cancel = React.useCallback(async () => {
            await uiContainer.setSubmitting(false);
        }, [uiContainer]);

        const { exchangeTab } = uiContainer.state;

        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    <React.Suspense fallback={<Loading />}>
                        <div className="unaudited">
                            <Warning />️ Chaosnet is unaudited, please proceed with caution.
                        </div>
                        <div className="exchange--tabs">
                            <button onClick={onSwapTab} className={className("exchange--tab", exchangeTab === ExchangeTabs.Swap ? "exchange--tab--selected" : "")}>Swap</button>
                            <button onClick={onLiquidityTab} className={className("exchange--tab", exchangeTab === ExchangeTabs.Liquidity ? "exchange--tab--selected" : "")}>Liquidity</button>
                        </div>
                        {exchangeTab === ExchangeTabs.Swap ?
                            <ErrorBoundary><OrderForm handleLogin={handleLogin} /></ErrorBoundary> :
                            <ErrorBoundary><LiquidityForm handleLogin={handleLogin} /></ErrorBoundary>
                        }
                        <ErrorBoundary><OrderHistory /></ErrorBoundary>
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
