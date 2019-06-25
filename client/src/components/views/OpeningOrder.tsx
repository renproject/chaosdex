import * as React from "react";

import { withTranslation, WithTranslation } from "react-i18next";

import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../lib/errors";
import { AppContainer, HistoryEvent } from "../../state/appContainer";
import { connect, ConnectedProps } from "../../state/connect";
import { isERC20, isEthereumBased } from "../../state/generalTypes";
import { AskForAddress } from "./popups/AskForAddress";
import { ConfirmTradeDetails } from "./popups/ConfirmTradeDetails";
import { DepositReceived } from "./popups/DepositReceived";
import { ShowDepositAddress } from "./popups/ShowDepositAddress";
import { SubmitToEthereum } from "./popups/SubmitToEthereum";
import { TokenAllowance } from "./popups/TokenAllowance";

const defaultState = { // Entries must be immutable
    depositReceived: false,
};

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
class OpeningOrderClass extends React.Component<Props, typeof defaultState> {
    private _returned = false;
    private _mounted: boolean;

    constructor(props: Props) {
        super(props);
        this.state = defaultState;
        this._mounted = true;
    }

    public componentDidMount = () => {
        this._returned = false;
    }

    public componentWillUnmount = () => {
        this._mounted = false;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const [appContainer] = this.props.containers;
        const { depositReceived } = this.state;
        const {
            orderInputs: orderInput, toAddress, refundAddress, depositAddress,
            utxos, confirmedOrderInputs, erc20Approved, confirmedTrade, inTx,
            outTx, address,
        } = appContainer.state;

        // The confirmed order inputs should always be available
        if (!confirmedOrderInputs) {
            return <></>;
        }

        // Ask the user to confirm the details before continuing
        if (!confirmedTrade) {
            return <ConfirmTradeDetails
                orderInputs={confirmedOrderInputs}
                done={this.props.containers[0].onConfirmedTrade}
                cancel={this.cancel}
                quoteCurrency={this.props.containers[0].state.preferredCurrency}
                tokenPrices={this.props.containers[0].state.tokenPrices}
            />;
        }

        // Ask the user to provide an address for receiving `dstToken`
        if (toAddress === null) {
            return <AskForAddress
                key={confirmedOrderInputs.dstToken} // Since AskForAddress is used twice
                token={confirmedOrderInputs.dstToken}
                message={`Enter the ${confirmedOrderInputs.dstToken} public address you want to receive your tokens to.`}
                onAddress={this.ontoAddress}
                cancel={this.cancel}
                defaultAddress={address || ""}
            />;
        }

        // Ask the user to provide an address for refunding `srcToken` to in
        // case the trade doesn't go through
        if (refundAddress === null) {
            return <AskForAddress
                key={confirmedOrderInputs.srcToken} // Since AskForAddress is used twice
                token={confirmedOrderInputs.srcToken}
                message={`Enter your ${confirmedOrderInputs.srcToken} refund address in case the trade doesn't go through.`}
                onAddress={this.onRefundAddress}
                cancel={this.cancel}
                defaultAddress={address || ""}
            />;
        }

        if (!inTx) {
            // // If `srcToken` is Ethereum-based they can submit to the contract
            // // directly, otherwise they must deposit `srcToken` to a generated
            // // address.
            // if (isEthereumBased(orderInput.srcToken)) {
            //     if (isERC20(orderInput.srcToken) && !erc20Approved) {
            //         return <TokenAllowance token={orderInput.srcToken} amount={confirmedOrderInputs.srcAmount} submit={this.props.containers[0].setAllowance} />;
            //     }

            //     // Submit the trade to Ethereum
            //     return <SubmitToEthereum token={orderInput.dstToken} submit={this.submitSwap} />;
            // } else {
            // Show the deposit address and wait for a deposit
            if (!depositReceived) {
                return <ShowDepositAddress
                    generateAddress={this.generateAddress}
                    token={orderInput.srcToken}
                    depositAddress={depositAddress}
                    amount={confirmedOrderInputs.srcAmount}
                    waitForDeposit={this.waitForDeposit}
                    cancel={this.cancel}
                    done={this.onDeposit}
                />;
            }

            return <DepositReceived submitDeposit={this.submitDeposit} />;
            // }
        }

        if (!outTx) {
            // if (isEthereumBased(orderInput.srcToken)) {
            //     return <DepositReceived submitDeposit={this.submitBurn} />;
            // } else {
            // Submit the trade to Ethereum
            return <SubmitToEthereum token={orderInput.dstToken} submit={this.submitSwap} />;
            // }
        }

        this.onDone().catch(_catchInteractionErr_);
        return <></>;
    }

    private readonly onDeposit = async () => {
        this.setState({ depositReceived: true });
    }

    private readonly waitForDeposit = async () => {
        await this.props.containers[0].waitForDeposits();
    }

    private readonly submitDeposit = async () => {
        await this.props.containers[0].submitDeposit();
    }

    private readonly submitSwap = async () => {
        await this.props.containers[0].submitSwap();
    }

    private readonly submitBurn = async () => {
        await this.props.containers[0].submitBurn();
    }

    private readonly onDone = async () => {
        if (this._returned) {
            return;
        }
        this._returned = true;
        const historyItem = await this.props.containers[0].getHistoryEvent();
        if (!historyItem || !this.props.swapSubmitted) {
            return;
        }
        this.props.swapSubmitted(historyItem);
    }

    private readonly ontoAddress = (toAddress: string) => {
        this.props.containers[0].updateToAddress(toAddress).catch(_catchInteractionErr_);
    }

    private readonly onRefundAddress = async (refundAddress: string) => {
        await this.props.containers[0].updateRefundAddress(refundAddress).catch(_catchInteractionErr_);
        this.generateAddress().catch(_catchInteractionErr_);
    }

    private readonly generateAddress = async () => {
        await this.props.containers[0].updateCommitment();
    }

    private readonly cancel = () => {
        this.props.containers[0].resetTrade().catch(_catchInteractionErr_);
        this.props.cancel();
    }
}

interface Props extends ConnectedProps<[AppContainer]>, WithTranslation {
    cancel: () => void;
    done: () => void;
    swapSubmitted?: (h: HistoryEvent) => void;
}

export const OpeningOrder = withTranslation()(connect<Props>([AppContainer])(OpeningOrderClass));
