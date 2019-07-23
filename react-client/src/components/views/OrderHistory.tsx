import "react-circular-progressbar/dist/styles.css";

import * as React from "react";

import { TokenIcon } from "@renproject/react-components";
import { Chain } from "@renproject/ren";
import { CircularProgressbar } from "react-circular-progressbar";

import { naturalTime } from "../../lib/conversion";
import { ETHERSCAN } from "../../lib/environmentVariables";
import { connect, ConnectedProps } from "../../state/connect";
import { HistoryEvent, PersistentContainer, Tx } from "../../state/persistentContainer";
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
            <span className="tx-pending tx-pending--solid" />
            {order.complete ?
                <TokenIcon className="token-icon" token={order.orderInputs.dstToken} /> :
                <CircularProgressbar
                    className="swap--progress"
                    value={33}
                    strokeWidth={18}
                    styles={{
                        path: {
                            stroke: "#006FE8",
                            strokeLinecap: "butt",
                            // strokeOpacity: 0.6,
                        },
                        trail: {
                            stroke: "#006FE8",
                            strokeOpacity: 0.2,
                        },
                    }}
                />
            }
            <span className="received--text">{order.complete ? <>Received</> : <>Receiving</>}</span>
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
            {/*<a className={`tx-in ${inTxPending ? "tx-pending" : ""}`} target="_blank" rel="noopener noreferrer" href={txUrl(order.inTx)}>
                <Arrow />
            </a>*/}
            {order.outTx ?
                <a className={`tx-out`} target="_blank" rel="noopener noreferrer" href={txUrl(order.outTx)}>
                    <Arrow />
                </a> :
                <></>
            }
        </div>
    </div>;
};

/**
 * OrderHistory is a visual component for allowing users to open new orders
 */
export const OrderHistory = connect<{} & ConnectedProps<[PersistentContainer]>>([PersistentContainer])(
    ({ containers: [persistentContainer] }) => {
        // export const OrderHistory = ({ orders }: Props) => {
        const [start, setStart] = React.useState(0);

        const nextPage = () => { setStart(start + 5); };
        const previousPage = () => { setStart(Math.max(start - 5, 0)); };

        const orders = Object.values(persistentContainer.state.historyItems).sort((a, b) => b.time - a.time);

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
                        if (!historyEvent) {
                            return <></>;
                        }
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
    });
