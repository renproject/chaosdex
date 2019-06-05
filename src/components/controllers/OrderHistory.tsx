import * as React from "react";

import { TokenIcon } from "@renex/react-components";
import i18next from "i18next";
import { useTranslation } from "react-i18next";

import { naturalTime } from "../../lib/conversion";
import { ETHERSCAN } from "../../lib/environmentVariables";
import { HistoryEvent } from "../../state/containers/appContainer";
import { ReactComponent as Next } from "../../styles/images/next.svg";
import { ReactComponent as Previous } from "../../styles/images/previous.svg";

const OrderHistoryEntry = ({ order, t }: { order: HistoryEvent, t: i18next.TFunction }) => {
    const etherscanUrl = order.outTx ? `${ETHERSCAN}/tx/${order.outTx}` : undefined;
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
    const [start, setStart] = React.useState(0);

    const nextPage = () => { setStart(start + 5); };
    const previousPage = () => { setStart(Math.max(start - 5, 0)); };

    const { orders } = props;
    if (orders.length === 0) {
        return <></>;
    }
    return <>
        <div className="section history">
            <div className="history--banner">
                <span>{t("history.history")}</span>
            </div>
            <div className="history--list">
                {orders.slice(start, start + 5).map(historyEvent => {
                    return <OrderHistoryEntry
                        t={t}
                        key={historyEvent.outTx}
                        order={historyEvent}
                    />;
                })}
            </div>
            {orders.length > 5 ? <div className="history--pages">
                <button disabled={start === 0} onClick={previousPage}><Previous /></button>
                <div className="history--page-count">Page {start / 5 + 1} of {Math.ceil(orders.length / 5)}</div>
                <button disabled={start + 5 > orders.length} onClick={nextPage}><Next /></button>
            </div> : null}
        </div>
    </>;
};

interface Props {
    orders: HistoryEvent[];
}
