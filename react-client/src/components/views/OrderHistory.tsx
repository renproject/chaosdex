import "react-circular-progressbar/dist/styles.css";

import * as React from "react";

import { InfoLabel, naturalTime, TokenIcon } from "@renproject/react-components";
import { Chain, strip0x } from "@renproject/ren";
import { CircularProgressbar } from "react-circular-progressbar";

import { connect, ConnectedProps } from "../../state/connect";
import {
    CommitmentType, HistoryEvent, PersistentContainer, ShiftInStatus, ShiftOutStatus, Tx,
} from "../../state/persistentContainer";
import { network } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { ReactComponent as Arrow } from "../../styles/images/arrow-right.svg";
import { ReactComponent as Next } from "../../styles/images/next.svg";
import { ReactComponent as Previous } from "../../styles/images/previous.svg";
import { TokenBalance } from "./TokenBalance";

const continueText = (commitmentType: CommitmentType): string => {
    switch (commitmentType) {
        case CommitmentType.Trade:
            return "Continue swap";
        case CommitmentType.AddLiquidity:
            return "Continue adding liquidity";
        case CommitmentType.RemoveLiquidity:
            return "Continue removing liquidity";
        default:
            return "Continue";
    }
};

const shiftProgress = (status: ShiftInStatus | ShiftOutStatus) => {
    switch (status) {
        // Shift in
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

        // Shift out
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

export const txUrl = (tx: Tx | null): string => {
    if (!tx) { return ""; }
    const isTx = tx.hash && tx.hash.slice && tx.hash.match(/(0x)?[a-fA-F0-9]+/);
    switch (tx.chain) {
        case Chain.Ethereum:
            return `${network.contracts.etherscan}/tx/${tx.hash}`;
        case Chain.Bitcoin:
            return `https://chain.so/${isTx ? "tx" : "address"}/BTC${network.isTestnet ? "TEST" : ""}/${strip0x(tx.hash)}`;
        case Chain.Zcash:
            return `https://chain.so/${isTx ? "tx" : "address"}/ZEC${network.isTestnet ? "TEST" : ""}/${strip0x(tx.hash)}`;
        case Chain.BCash:
            return `https://explorer.bitcoin.com/${network.isTestnet ? "t" : ""}bch/${isTx ? "tx" : "address"}/${strip0x(tx.hash)}`;
    }
};

const OrderHistoryEntry = ({ order, continueOrder, loggedIn }: {
    order: HistoryEvent,
    loggedIn: boolean,
    continueOrder: (orderID: string) => void,
}) => {
    const srcAmount = <span className="token--amount">
        <TokenBalance
            token={order.orderInputs.srcToken}
            amount={order.orderInputs.srcAmount}
            digits={8}
        />{" "}
        {order.orderInputs.srcToken}
    </span>;
    const amount = order.commitment.type === CommitmentType.AddLiquidity ? srcAmount : <span className="token--amount">
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
    // tslint:disable-next-line: no-console
    return <div className="swap--history--entry">
        <div className="token--info">
            {
                (
                    (order.status === ShiftInStatus.RefundedOnEthereum ||
                        order.status === ShiftOutStatus.RefundedOnEthereum ||
                        order.status === ShiftInStatus.ConfirmedOnEthereum ||
                        order.status === ShiftOutStatus.ReturnedFromRenVM
                    ) && order.commitment.type === CommitmentType.AddLiquidity
                ) ? <>
                        <TokenIcon className="token-icon" token={order.orderInputs.srcToken} />
                        <span className="received--text">Added liquidity - </span>{srcAmount}
                    </> :

                    (
                        (order.status === ShiftInStatus.RefundedOnEthereum ||
                            order.status === ShiftOutStatus.RefundedOnEthereum ||
                            order.status === ShiftInStatus.ConfirmedOnEthereum ||
                            order.status === ShiftOutStatus.ReturnedFromRenVM
                        ) && order.commitment.type === CommitmentType.RemoveLiquidity
                    ) ? <>
                            <TokenIcon className="token-icon" token={order.orderInputs.srcToken} />
                            <span className="received--text">Removed liquidity - </span>{srcAmount}
                        </> :

                        (
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
                                    <span className="received--text">{order.commitment.type === CommitmentType.AddLiquidity ? "Adding" : order.commitment.type === CommitmentType.RemoveLiquidity ? "Removing" : "Receiving"}</span>{amount}
                                    <button
                                        disabled={!loggedIn}
                                        className="button--plain"
                                        onClick={onClick}
                                    >
                                        {loggedIn ? continueText(order.commitment.type) : <>: Connect to continue</>}
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

        const { historyItems } = persistentContainer.state;
        const { address } = uiContainer.state;

        // export const OrderHistory = ({ orders }: Props) => {
        const [start, setStart] = React.useState(0);

        const nextPage = () => { setStart(start + 5); };
        const previousPage = () => { setStart(Math.max(start - 5, 0)); };

        const orders = Object.values(historyItems).sort((a, b) => b.time - a.time);

        const loggedIn = address !== null;

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
