import * as React from "react";

import { TokenIcon } from "@renex/react-components";
import i18next from "i18next";
import { useTranslation } from "react-i18next";

import { naturalTime } from "../../lib/conversion";
import { ETHERSCAN } from "../../lib/environmentVariables";
import { HistoryEvent } from "../../state/containers/appContainer";

const OrderHistoryEntry = ({ order, t }: { order: HistoryEvent, t: i18next.TFunction }) => {
    const etherscanUrl = order.transactionHash ? `${ETHERSCAN}/tx/${order.transactionHash}` : undefined;
    return (
        <a className="swap--history--entry" target="_blank" rel="noopener noreferrer" href={etherscanUrl} >
            <div className="token--info">

                <TokenIcon className="token-icon" token={order.orderInputs.dstToken} />
                <span className="received--text">{t("history.received")}</span><span className="token--amount">{order.orderInputs.dstAmount} {order.orderInputs.dstToken}</span>
            </div>
            <span className="swap--time">{naturalTime(order.time, { message: "Just now", suffix: "ago", countDown: false, abbreviate: true })}</span>
        </a>
    );
};

/**
 * OrderHistory is a visual component for allowing users to open new orders
 */
export const OrderHistory = (props: Props) => {
    const { t } = useTranslation();

    const { orders } = props;
    if (orders.length === 0) {
        return <></>;
    }
    console.log(`Orders: ${orders}`);
    return <>
        <div className="section history">
            <div className="history--banner">
                <span>{t("history.history")}</span>
            </div>
            <div className="history--list">
                {orders.map(historyEvent => {
                    return <OrderHistoryEntry
                        t={t}
                        key={historyEvent.transactionHash}
                        order={historyEvent}
                    />;
                })}
            </div>
        </div>
    </>;
};

interface Props {
    orders: HistoryEvent[];
}
