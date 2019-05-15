import * as React from "react";

import { withTranslation, WithTranslation } from "react-i18next";

import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { AskForAddress } from "../popups/AskForAddress";
import { ConfirmTradeDetails } from "../popups/ConfirmTradeDetails";
import { Popup } from "../popups/Popup";

const defaultState = { // Entries must be immutable
    confirmedTrade: false,
    receiveAddress: null as string | null,
    refundAddress: null as string | null,
    depositAddress: null as string | null,
};

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
class OpeningOrderClass extends React.Component<Props, typeof defaultState> {
    private readonly appContainer: AppContainer;

    constructor(props: Props) {
        super(props);
        [this.appContainer] = this.props.containers;
        this.state = defaultState;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { confirmedTrade, receiveAddress, refundAddress, depositAddress } = this.state;
        const orderInput = this.appContainer.state.order;

        let submitPopup = <></>;
        if (!confirmedTrade) {
            submitPopup = <ConfirmTradeDetails
                orderInputs={orderInput}
                done={this.onConfirmedTrade}
                cancel={this.cancel}
            />;
        } else if (receiveAddress === null) {
            submitPopup = <AskForAddress
                token={orderInput.receiveToken}
                message={`Enter the ${orderInput.receiveToken} public address you want to receive your tokens to.`}
                onAddress={this.onReceiveAddress}
                cancel={this.cancel}
            />;
        } else if (refundAddress === null) {
            submitPopup = <AskForAddress
                token={orderInput.sendToken}
                message={`Enter your ${orderInput.sendToken} refund address in case the trade doesn't go through.`}
                onAddress={this.onRefundAddress}
                cancel={this.cancel}
            />;
        } else if (depositAddress === null) {
            submitPopup = <Popup>Generating address...</Popup>;
        } else {
            submitPopup = <Popup>Something went wrong!</Popup>;
        }

        return submitPopup;
    }

    private readonly onConfirmedTrade = () => {
        this.setState({ confirmedTrade: true });
    }

    private readonly onReceiveAddress = (receiveAddress: string) => {
        this.setState({ receiveAddress });
    }

    private readonly onRefundAddress = (refundAddress: string) => {
        this.setState({ refundAddress });
        this.generatedDepositAddress();
    }

    private readonly generatedDepositAddress = () => {
        this.setState({ depositAddress: "0x1234" });
    }

    private readonly cancel = () => {
        this.setState({ receiveAddress: null, refundAddress: null, depositAddress: null, confirmedTrade: false, });
        this.props.cancel();
    }
}

interface Props extends ConnectedProps<[AppContainer]>, WithTranslation {
    cancel: () => void;
    done: () => void;
}

export const OpeningOrder = withTranslation()(connect<Props>([AppContainer])(OpeningOrderClass));
