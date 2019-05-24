import * as React from "react";

import BigNumber from "bignumber.js";

import { TokenIcon } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";

import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { HistoryEvent } from "../../state/containers/appContainer";
import { Token } from "../../state/generalTypes";

import { naturalTime } from "../../lib/conversion";

const defaultState = { // Entries must be immutable
    submitting: false,
};

const OrderHistoryEntry = (props: { order: HistoryEvent }) => {
    return (
        <div className="swap--history--entry">
            <div className="token--amounts">
                <TokenIcon className="token-icon" token={props.order.dstToken} />
                <span>Received {props.order.dstAmount.toFixed()} {props.order.dstToken}</span>
            </div>
            <span>{naturalTime(props.order.time, { message: "Just now", suffix: "ago", countDown: false, abbreviate: true })}</span>
        </div>
    );
};

/**
 * OrderHistory is a visual component for allowing users to open new orders
 */
class OrderHistoryClass extends React.Component<Props, typeof defaultState> {
    constructor(props: Props) {
        super(props);
        this.state = defaultState;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { containers: [appContainer] } = this.props;
        console.log("history:");
        console.log(appContainer.state.swapHistory);
        const swap: HistoryEvent = {
            commitment: {
                srcToken: "0x2a8368d2a983a0aeae8da0ebc5b7c03a0ea66b37",
                dstToken: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
                minDestinationAmount: new BigNumber("6000000000000000000000"),
                srcAmount: new BigNumber("100000000"),
                toAddress: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
                refundBlockNumber: 11111762,
                refundAddress: "0x6fca15b7fa057863ee881130006817f12de46c3ad8ebe2d9de"
            },
            srcToken: Token.BTC,
            dstToken: Token.DAI,
            srcAmount: new BigNumber(1),
            dstAmount: new BigNumber(6345.1234),
            promiEvent: undefined,
            transactionHash: undefined,
            swapError: undefined,
            time: Date.now() / 1000, // Convert from milliseconds to seconds
        };
        appContainer.state.swapHistory.push(swap);
        appContainer.state.swapHistory.push(swap);
        appContainer.state.swapHistory.push(swap);
        return <>
            <div className="section history">
                <div className="history--banner">
                    <span>History</span>
                </div>
                <div className="history--list">
                    {appContainer.state.swapHistory.map(h => {
                        return <OrderHistoryEntry
                            key={`${h.commitment.refundBlockNumber}--${h.time}`}
                            order={h}
                        />;
                    })}
                </div>
            </div>
        </>;
    }

    private readonly cancel = () => {
        this.setState({ submitting: false });
    }

    private readonly openOrder = async () => {
        this.setState({ submitting: true });
    }
}

interface Props extends ConnectedProps<[AppContainer]>, WithTranslation {
}

export const OrderHistory = withTranslation()(connect<Props>([AppContainer])(OrderHistoryClass));
