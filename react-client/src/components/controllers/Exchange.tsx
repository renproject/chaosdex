import * as React from "react";

import { Loading } from "@renproject/react-components";

import { className } from "../../lib/className";
import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";
import { _catch_ } from "../ErrorBoundary";
import { LiquidityForm } from "../views/exchange-forms/LiquidityForm";
import { OrderForm } from "../views/exchange-forms/OrderForm";
import { OrderHistory } from "../views/OrderHistory";
import { OpeningOrder } from "./OpeningOrder";
import { PromptDetails } from "./PromptDetails";

interface Props {
    handleLogin: () => void;
}

enum Tabs {
    Swap,
    Liquidity,
}

/**
 * Exchange is the main token-swapping page.
 */
export const Exchange = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ handleLogin, containers: [uiContainer] }) => {

        const [tab, setTab] = React.useState<Tabs>(Tabs.Swap);

        const onSwapTab = React.useCallback(() => { setTab(Tabs.Swap); }, [setTab]);
        const onLiquidityTab = React.useCallback(() => { setTab(Tabs.Liquidity); }, [setTab]);

        const cancel = async () => {
            await uiContainer.setSubmitting(false);
        };

        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    <React.Suspense fallback={<Loading />}>
                        <div className="exchange--tabs">
                            <button onClick={onSwapTab} className={className("exchange--tab", tab === Tabs.Swap ? "exchange--tab--selected" : "")}>Swap</button>
                            <button onClick={onLiquidityTab} className={className("exchange--tab", tab === Tabs.Liquidity ? "exchange--tab--selected" : "")}>Liquidity</button>
                        </div>
                        {tab === Tabs.Swap ?
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
