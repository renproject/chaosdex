import * as React from "react";

import { withTranslation, WithTranslation } from "react-i18next";

import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer, OptionsContainer } from "../../state/containers";
import { HistoryEvent } from "../../state/containers/appContainer";
import { Token } from "../../state/generalTypes";
import { AskForAddress } from "../popups/AskForAddress";
import { ConfirmTradeDetails } from "../popups/ConfirmTradeDetails";
import { DepositReceived } from "../popups/DepositReceived";
import { ShowDepositAddress } from "../popups/ShowDepositAddress";
import { SubmitToEthereum } from "../popups/SubmitToEthereum";
import { TokenAllowance } from "../popups/TokenAllowance";

const defaultState = { // Entries must be immutable
    confirmedTrade: false,
    sufficientAllowance: false,
};

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
class OpeningOrderClass extends React.Component<Props, typeof defaultState> {
    private readonly appContainer: AppContainer;
    private readonly optionsContainer: OptionsContainer;
    private _depositTimer: NodeJS.Timeout | undefined;
    private _responseTimer: NodeJS.Timeout | undefined;
    private _mounted: boolean;

    constructor(props: Props) {
        super(props);
        [this.appContainer, this.optionsContainer] = this.props.containers;
        this.state = defaultState;
        this._mounted = true;
        this.updateDeposits().catch(_catchBackgroundErr_);
        this.updateResponse().catch(_catchBackgroundErr_);
    }

    public componentWillUnmount = () => {
        this._mounted = false;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { sufficientAllowance, confirmedTrade } = this.state;
        const {
            orderInputs: orderInput, toAddress, refundAddress, depositAddress, utxos,
            messageID, signature: messageResponse, confirmedOrderInputs
        } = this.appContainer.state;

        if (!confirmedOrderInputs) {
            return <></>;
        }

        let submitPopup = <></>;
        if (!confirmedTrade) {
            submitPopup = <ConfirmTradeDetails
                orderInputs={confirmedOrderInputs}
                done={this.onConfirmedTrade}
                cancel={this.cancel}
                quoteCurrency={this.optionsContainer.state.preferredCurrency}
                tokenPrices={this.appContainer.state.tokenPrices}
            />;
        } else if (toAddress === null) {
            submitPopup = <AskForAddress
                key={confirmedOrderInputs.dstToken} // Since AskForAddress is used twice
                token={confirmedOrderInputs.dstToken}
                message={`Enter the ${confirmedOrderInputs.dstToken} public address you want to receive your tokens to.`}
                onAddress={this.ontoAddress}
                cancel={this.cancel}
            />;
        } else if (refundAddress === null) {
            submitPopup = <AskForAddress
                key={confirmedOrderInputs.srcToken} // Since AskForAddress is used twice
                token={confirmedOrderInputs.srcToken}
                message={`Enter your ${confirmedOrderInputs.srcToken} refund address in case the trade doesn't go through.`}
                onAddress={this.onRefundAddress}
                cancel={this.cancel}
            />;
        } else if ([Token.DAI, Token.REN].includes(orderInput.srcToken)) {
            if (!sufficientAllowance) {
                submitPopup = <TokenAllowance token={orderInput.srcToken} amount={confirmedOrderInputs.srcAmount} submit={this.setAllowance} />;
            } else {
                submitPopup = <SubmitToEthereum token={orderInput.dstToken} submit={this.shiftERC20} />;
            }
        } else {
            if ((!utxos || utxos.size === 0)) {
                submitPopup = <ShowDepositAddress
                    token={orderInput.srcToken}
                    depositAddress={depositAddress}
                    amount={confirmedOrderInputs.srcAmount}
                    cancel={this.cancel}
                />;
            } else if (!messageResponse) {
                submitPopup = <DepositReceived submitDeposit={this.submitDeposit} messageID={messageID} />;
            } else {
                submitPopup = <SubmitToEthereum token={orderInput.dstToken} submit={this.submitSwap} />;
            }
        }
        return submitPopup;
    }

    private readonly setAllowance = async () => {
        const sufficientAllowance = await this.appContainer.setAllowance();
        this.setState({ sufficientAllowance });
    }

    private readonly updateDeposits = async () => {
        if (!this._mounted) { return; }
        let timeout = 500; // Half a second
        if (this.appContainer.state.depositAddress) {
            try {
                await this.appContainer.updateDeposits();
                timeout = 5000; // 5 seconds
            } catch (error) {
                _catchBackgroundErr_(error);
            }
        }
        if (this._depositTimer) { clearTimeout(this._depositTimer); }
        this._depositTimer = setTimeout(this.updateDeposits, timeout);
    }

    private readonly updateResponse = async () => {
        if (!this._mounted) { return; }
        let timeout = 10000; // Half a second
        if (this.appContainer.state.messageID) {
            try {
                await this.appContainer.updateMessageStatus();
                timeout = 10000; // 5 seconds
            } catch (error) {
                _catchBackgroundErr_(error);
            }
        }
        if (this._responseTimer) { clearTimeout(this._responseTimer); }
        this._responseTimer = setTimeout(this.updateResponse, timeout);
    }

    private readonly submitDeposit = async () => {
        this.appContainer.submitDeposit().catch(_catchInteractionErr_);
    }

    private readonly submitSwap = async () => {
        const historyItem = await this.appContainer.submitSwap();
        if (!historyItem || !this.props.swapSubmitted) {
            return;
        }
        this.props.swapSubmitted(historyItem);
    }

    private readonly onConfirmedTrade = () => {
        this.setState({ confirmedTrade: true });
    }

    private readonly ontoAddress = (toAddress: string) => {
        this.appContainer.updateToAddress(toAddress).catch(_catchInteractionErr_);
    }

    private readonly onRefundAddress = async (refundAddress: string) => {
        await this.appContainer.updateRefundAddress(refundAddress).catch(_catchInteractionErr_);
        await this.appContainer.updateCommitment().catch(_catchInteractionErr_);
    }

    private readonly cancel = () => {
        this.setState({ confirmedTrade: false, });
        this.appContainer.resetTrade().catch(_catchInteractionErr_);
        this.props.cancel();
    }

    private readonly shiftERC20 = async () => {
        const historyItem = await this.appContainer.shiftERC20();
        if (!historyItem || !this.props.swapSubmitted) {
            return;
        }
        this.props.swapSubmitted(historyItem);
    }
}

interface Props extends ConnectedProps<[AppContainer, OptionsContainer]>, WithTranslation {
    cancel: () => void;
    done: () => void;
    swapSubmitted?: (h: HistoryEvent) => void;
}

export const OpeningOrder = withTranslation()(connect<Props>([AppContainer, OptionsContainer])(OpeningOrderClass));
