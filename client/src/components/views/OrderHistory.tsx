import * as React from "react";

import { TokenIcon } from "@renex/react-components";
import { Chain } from "@ren-project/ren";
import i18next from "i18next";
import { OrderedMap } from "immutable";
import { useTranslation } from "react-i18next";

import { naturalTime } from "../../lib/conversion";
import { ETHERSCAN } from "../../lib/environmentVariables";
import { HistoryEvent, Tx } from "../../state/appContainer";
import { ReactComponent as Arrow } from "../../styles/images/arrow-right.svg";
import { ReactComponent as Next } from "../../styles/images/next.svg";
import { ReactComponent as Previous } from "../../styles/images/previous.svg";
import { TokenBalance } from "./TokenBalance";

const txUrl = (tx: Tx | null): string => {
    if (!tx) { return ""; }
    switch (tx.chain) {
        case Chain.Ethereum:
            return `${ETHERSCAN}/tx/${tx.hash}`;
        case Chain.Bitcoin:
            return `https://live.blockcypher.com/btc-testnet/tx/${tx.hash}`;
        case Chain.ZCash:
            return `https://chain.so/tx/ZEC/${tx.hash}`;
    }
};

const OrderHistoryEntry = ({ order, t, outTxPending }: {
    order: HistoryEvent,
    t: i18next.TFunction,
    // inTxPending: boolean,
    outTxPending: boolean,
}) => {
    return <div className="swap--history--entry">
        <div className="token--info">
            <TokenIcon className="token-icon" token={order.orderInputs.dstToken} />
            <span className="received--text">{t("history.received")}</span>
            <span className="token--amount">
                <TokenBalance
                    token={order.orderInputs.dstToken}
                    amount={order.receivedAmount || order.orderInputs.dstAmount}
                />{" "}
                {order.orderInputs.dstToken}
            </span>
        </div>
        <div className="history--txs">
            <span className="swap--time">{naturalTime(order.time, { message: "Just now", suffix: "ago", countDown: false, abbreviate: true })}</span>
            {/*<a target="_blank" className={`tx-in ${inTxPending ? "tx-pending" : ""}`} rel="noopener noreferrer" href={txUrl(order.inTx)}>
                <Arrow />
            </a>*/}
            <a target="_blank" className={`tx-out ${outTxPending ? "tx-pending" : ""}`} rel="noopener noreferrer" href={txUrl(order.outTx)}>
                <Arrow />
            </a>
        </div>
    </div>;
};

/**
 * OrderHistory is a visual component for allowing users to open new orders
 */
export const OrderHistory = ({ orders, pendingTXs }: Props) => {
    const { t } = useTranslation();
    const [start, setStart] = React.useState(0);

    const nextPage = () => { setStart(start + 5); };
    const previousPage = () => { setStart(Math.max(start - 5, 0)); };

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
                        key={historyEvent.outTx ? historyEvent.outTx.hash : historyEvent.time}
                        order={historyEvent}
                        // inTxPending={pendingTXs.has(historyEvent.inTx.hash)}
                        outTxPending={pendingTXs.has(historyEvent.outTx.hash)}
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
    pendingTXs: OrderedMap<string, number>;
}
