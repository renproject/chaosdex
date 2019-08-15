import "react-circular-progressbar/dist/styles.css";

import * as React from "react";

import { InfoLabel, naturalTime, TokenIcon } from "@renproject/react-components";
import { Chain } from "@renproject/ren";
import { CircularProgressbar } from "react-circular-progressbar";

import { ETHERSCAN } from "../../lib/environmentVariables";
import { connect, ConnectedProps } from "../../state/connect";
import {
    HistoryEvent, PersistentContainer, ShiftInStatus, ShiftOutStatus, Tx,
} from "../../state/persistentContainer";
import { UIContainer } from "../../state/uiContainer";
import { ReactComponent as Arrow } from "../../styles/images/arrow-right.svg";
import { ReactComponent as Next } from "../../styles/images/next.svg";
import { ReactComponent as Previous } from "../../styles/images/previous.svg";
import { TokenBalance } from "./TokenBalance";

const shiftProgress = (status: ShiftInStatus | ShiftOutStatus) => {
    switch (status) {
        case ShiftInStatus.Committed:
            return 1 / 6 * 100;
        case ShiftInStatus.Deposited:
            return 2 / 6 * 100;
        case ShiftInStatus.SubmittedToRenVM:
            return 3 / 6 * 100;
        case ShiftInStatus.ReturnedFromRenVM:
            return 4 / 6 * 100;
        case ShiftInStatus.SubmittedToEthereum:
            return 5 / 6 * 100;
        case ShiftOutStatus.Committed:
            return 1 / 5 * 100;
        case ShiftOutStatus.SubmittedToEthereum:
            return 2 / 5 * 100;
        case ShiftOutStatus.ConfirmedOnEthereum:
            return 3 / 5 * 100;
        case ShiftOutStatus.SubmittedToRenVM:
            return 4 / 5 * 100;
        default:
            return 100;
    }
};

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

const OrderHistoryEntry = ({ order, continueOrder, loggedIn }: {
    order: HistoryEvent,
    loggedIn: boolean,
    continueOrder: (orderID: string) => void,
}) => {
    const amount = <span className="token--amount">
        <TokenBalance
            token={order.orderInputs.dstToken}
            amount={order.receivedAmount || order.orderInputs.dstAmount}
            digits={8}
        />{" "}
        {order.orderInputs.dstToken}
    </span>;
    const onClick = () => {
        continueOrder(order.id);
    };
    return <div className="swap--history--entry">
        <div className="token--info">
            {(
                order.status === ShiftInStatus.ConfirmedOnEthereum ||
                order.status === ShiftOutStatus.ReturnedFromRenVM
            ) ?
                <>
                    <TokenIcon className="token-icon" token={order.orderInputs.dstToken} />
                    <span className="received--text">Received</span>{amount}
                </> :
                (
                    order.status === ShiftInStatus.RefundedOnEthereum ||
                    order.status === ShiftOutStatus.RefundedOnEthereum
                ) ?
                    <>
                        <TokenIcon className="token-icon" token={order.orderInputs.dstToken} />
                        <span className="received--text">{order.orderInputs.srcToken} refunded</span> <InfoLabel>A swap will be refunded if too much time has passed or if the price has fallen too much.</InfoLabel>
                    </> :
                    <>
                        {/*<span className="tx-pending tx-pending--solid" />*/}
                        <CircularProgressbar
                            className="swap--progress"
                            value={shiftProgress(order.status)}
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
                        <span className="received--text">Receiving</span>{amount}
                        <button
                            disabled={!loggedIn}
                            className="button--plain"
                            onClick={onClick}
                        >
                            {loggedIn ? <>Continue swap</> : <>: Connect to continue</>}
                        </button>
                    </>
            }

        </div>
        <div className="history--txs">
            <span className="swap--time">{naturalTime(order.time, { message: "Just now", suffix: "ago", countDown: false, abbreviate: true })}</span>
            {order.inTx ?
                <a className={`tx-in`} target="_blank" rel="noopener noreferrer" href={txUrl(order.inTx)}>
                    <Arrow />
                </a> :
                <></>
            }
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
export const OrderHistory = connect<{} & ConnectedProps<[PersistentContainer, UIContainer]>>([PersistentContainer, UIContainer])(
    ({ containers: [persistentContainer, uiContainer] }) => {
        // export const OrderHistory = ({ orders }: Props) => {
        const [start, setStart] = React.useState(0);

        const nextPage = () => { setStart(start + 5); };
        const previousPage = () => { setStart(Math.max(start - 5, 0)); };

        const orders = Object.values(persistentContainer.state.historyItems).sort((a, b) => b.time - a.time);

        const loggedIn = uiContainer.state.address !== null;

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
                            loggedIn={loggedIn}
                            continueOrder={uiContainer.handleOrder}
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
