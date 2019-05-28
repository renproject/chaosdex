import * as React from "react";

import i18next from "i18next";

import { TokenIcon } from "@renex/react-components";
import { useTranslation } from "react-i18next";

import { naturalTime } from "../../lib/conversion";
import { ETHERSCAN } from "../../lib/environmentVariables";
import { StoredHistoryEvent } from "../../state/generalTypes";

const OrderHistoryEntry = (props: { order: StoredHistoryEvent, t: i18next.TFunction }) => {
    const etherscanUrl = props.order.transactionHash ? `${ETHERSCAN}/tx/${props.order.transactionHash}` : undefined;
    return (
        <a className="swap--history--entry" target="_blank" rel="noopener noreferrer" href={etherscanUrl} >
            <div className="token--info">
                <TokenIcon className="token-icon" token={props.order.dstToken} />
                <span className="received--text">{props.t("history.received")}</span><span className="token--amount">{props.order.dstAmount} {props.order.dstToken}</span>
            </div>
            <span className="swap--time">{naturalTime(props.order.time, { message: "Just now", suffix: "ago", countDown: false, abbreviate: true })}</span>
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
    return <>
        <div className="section history">
            <div className="history--banner">
                <span>{t("history.history")}</span>
            </div>
            <div className="history--list">
                {orders.map(h => {
                    return <OrderHistoryEntry
                        t={t}
                        key={`${h.refundBlockNumber}--${h.time}`}
                        order={h}
                    />;
                })}
            </div>
        </div>
    </>;
};

interface Props {
    orders: StoredHistoryEvent[];
}
