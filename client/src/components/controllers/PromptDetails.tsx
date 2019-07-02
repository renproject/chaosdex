import * as React from "react";

import { withTranslation, WithTranslation } from "react-i18next";

import { _catchInteractionErr_ } from "../../lib/errors";
import { SDKContainer } from "../../state/sdkContainer";
import { connect, ConnectedProps } from "../../state/connect";
import { AskForAddress } from "../views/popups/AskForAddress";
import { ConfirmTradeDetails } from "../views/popups/ConfirmTradeDetails";

/**
 * PromptDetails is a visual component for allowing users to open new orders
 */
class PromptDetailsClass extends React.Component<Props> {

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const [appContainer] = this.props.containers;
        const {
            toAddress, confirmedOrderInputs, confirmedTrade,
            address,
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
        return <AskForAddress
            key={confirmedOrderInputs.srcToken} // Since AskForAddress is used twice
            token={confirmedOrderInputs.srcToken}
            message={`Enter your ${confirmedOrderInputs.srcToken} refund address in case the trade doesn't go through.`}
            onAddress={this.onRefundAddress}
            cancel={this.cancel}
            defaultAddress={address || ""}
        />;
    }

    private readonly ontoAddress = (toAddress: string) => {
        this.props.containers[0].updateToAddress(toAddress).catch(_catchInteractionErr_);
    }

    private readonly onRefundAddress = async (refundAddress: string) => {
        await this.props.containers[0].updateRefundAddress(refundAddress).catch(_catchInteractionErr_);
    }

    private readonly cancel = () => {
        this.props.containers[0].resetTrade().catch(_catchInteractionErr_);
        this.props.cancel();
    }
}

interface Props extends ConnectedProps<[SDKContainer]>, WithTranslation {
    cancel: () => void;
}

export const PromptDetails = withTranslation()(connect<Props>([SDKContainer])(PromptDetailsClass));
