import * as React from "react";

import i18next from "i18next";
import { TokenIcon } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";

import { naturalTime } from "../../lib/conversion";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { HistoryEvent } from "../../state/containers/appContainer";

const OrderHistoryEntry = ({ order, t }: { order: HistoryEvent, t: i18next.TFunction }) => {
    return (
        <div className="swap--history--entry">
            <div className="token--info">
                <TokenIcon className="token-icon" token={order.commitment.orderInputs.dstToken} />
                <span className="received--text">{t("history.received")}</span><span className="token--amount">{order.commitment.orderInputs.dstAmount} {order.commitment.orderInputs.dstToken}</span>
            </div>
            <span className="swap--time">{naturalTime(order.time, { message: "Just now", suffix: "ago", countDown: false, abbreviate: true })}</span>
        </div>
    );
};

/**
 * OrderHistory is a visual component for allowing users to open new orders
 */
class OrderHistoryClass extends React.Component<Props, {}> {
    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { t, containers: [appContainer] } = this.props;
        if (appContainer.state.swapHistory.size === 0) {
            return <></>;
        }
        return <>
            <div className="section history">
                <div className="history--banner">
                    <span>{t("history.history")}</span>
                </div>
                <div className="history--list">
                    {appContainer.state.swapHistory.map(h => {
                        return <OrderHistoryEntry
                            t={t}
                            key={`${h.commitment.refundBlockNumber}--${h.time}`}
                            order={h}
                        />;
                    })}
                </div>
            </div>
        </>;
    }
}

interface Props extends ConnectedProps<[AppContainer]>, WithTranslation {
}

export const OrderHistory = withTranslation()(connect<Props>([AppContainer])(OrderHistoryClass));
