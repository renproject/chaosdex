import * as React from "react";

import { TokenIcon } from "@renex/react-components";
import { Chain } from "@renproject/ren";

import { naturalTime } from "../../lib/conversion";
import { ETHERSCAN } from "../../lib/environmentVariables";
import { HistoryEvent, Tx } from "../../state/sdkContainer";
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
            return `https://chain.so/address/BTCTEST/${tx.hash}`;
        case Chain.Zcash:
            return `https://chain.so/address/ZECTEST/${tx.hash}`;
    }
};

const OrderHistoryEntry = ({ order }: {
    order: HistoryEvent,
}) => {
    return <div className="swap--history--entry">
        <div className="token--info">
            <TokenIcon className="token-icon" token={order.orderInputs.dstToken} />
            <span className="received--text">Received</span>
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
            <a target="_blank" className={`tx-out`} rel="noopener noreferrer" href={txUrl(order.outTx)}>
                <Arrow />
            </a>
        </div>
    </div>;
};

/**
 * OrderHistory is a visual component for allowing users to open new orders
 */
export const OrderHistory = ({ orders }: Props) => {
    const [start, setStart] = React.useState(0);

    const nextPage = () => { setStart(start + 5); };
    const previousPage = () => { setStart(Math.max(start - 5, 0)); };

    if (orders.length === 0) {
        return <></>;
    }
    return <>
        <div className="section history">
            <div className="history--banner">
                <span>History</span>
            </div>
            <div className="history--list">
                {orders.slice(start, start + 5).map(historyEvent => {
                    return <OrderHistoryEntry
                        key={historyEvent.time}
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
