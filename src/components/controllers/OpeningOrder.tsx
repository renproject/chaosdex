import * as React from "react";

import { Loading } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";

import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer, OptionsContainer } from "../../state/containers";
import { AskForAddress } from "../popups/AskForAddress";
import { ConfirmTradeDetails } from "../popups/ConfirmTradeDetails";
import { Popup } from "../popups/Popup";

const defaultState = { // Entries must be immutable
    confirmedTrade: false,
    submitting: false,
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
        const { confirmedTrade, submitting } = this.state;
        const {
            order: orderInput, toAddress, refundAddress, depositAddress, utxos,
            messageID, messageResponse, transactionHash,
        } = this.appContainer.state;

        let submitPopup = <></>;
        if (!confirmedTrade) {
            submitPopup = <ConfirmTradeDetails
                orderInputs={orderInput}
                done={this.onConfirmedTrade}
                cancel={this.cancel}
                quoteCurrency={this.optionsContainer.state.preferredCurrency}
                tokenPrices={this.appContainer.state.tokenPrices}
            />;
        } else if (toAddress === null) {
            submitPopup = <AskForAddress
                key={orderInput.dstToken}
                token={orderInput.dstToken}
                message={`Enter the ${orderInput.dstToken} public address you want to receive your tokens to.`}
                onAddress={this.ontoAddress}
                cancel={this.cancel}
            />;
        } else if (refundAddress === null) {
            submitPopup = <AskForAddress
                key={orderInput.srcToken}
                token={orderInput.srcToken}
                message={`Enter your ${orderInput.srcToken} refund address in case the trade doesn't go through.`}
                onAddress={this.onRefundAddress}
                cancel={this.cancel}
            />;
        } else if (depositAddress === null) {
            submitPopup = <Popup><div className="popup--body">Generating address... <Loading /></div></Popup>;
        } else if (!utxos || utxos.length === 0) {
            submitPopup = <Popup><div className="popup--body">
                Please deposit to <b>{depositAddress}</b>
            </div></Popup>;
        } else if (!messageID) {
            submitPopup = <Popup><div className="popup--body">
                Deposit found! {utxos[0].utxo.txHash}
                <button onClick={this.submitDeposit} disabled={submitting}>{submitting ? <Loading /> : <>Submit deposit</>}</button>
            </div></Popup>;
        } else if (!messageResponse) {
            submitPopup = <Popup><div className="popup--body">
                Submitting to darknodes...
            </div></Popup>;
        } else if (!transactionHash) {
            submitPopup = <Popup><div className="popup--body">
                Response from darknodes! {messageResponse}
                <button onClick={this.submitSwap}>Submit swap</button>
            </div></Popup>;
        } else {
            submitPopup = <Popup><div className="popup--body">
                Submitted! {transactionHash}
            </div></Popup>;
        }

        return submitPopup;
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
        this.setState({ submitting: true });
        this.appContainer.submitDeposit().catch(_catchInteractionErr_);
    }

    private readonly submitSwap = async () => {
        this.appContainer.submitSwap().catch(_catchInteractionErr_);
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
        this.appContainer.cancelTrade().catch(_catchInteractionErr_);
        this.props.cancel();
    }
}

interface Props extends ConnectedProps<[AppContainer, OptionsContainer]>, WithTranslation {
    cancel: () => void;
    done: () => void;
}

export const OpeningOrder = withTranslation()(connect<Props>([AppContainer, OptionsContainer])(OpeningOrderClass));
