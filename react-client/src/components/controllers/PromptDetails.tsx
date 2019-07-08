import * as React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { AskForAddress } from "../views/popups/AskForAddress";
import { ConfirmTradeDetails } from "../views/popups/ConfirmTradeDetails";

interface Props {
    cancel: () => void;
}

/**
 * PromptDetails is a visual component for allowing users to open new orders
 */
export const PromptDetails = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], cancel }) => {

        const {
            toAddress, confirmedOrderInputs, confirmedTrade,
            address,
        } = uiContainer.state;

        const onRefundAddress = async (refundAddress: string) => {
            await uiContainer.updateRefundAddress(refundAddress).catch(_catchInteractionErr_);
            const commitment = await uiContainer.updateCommitment();
            await sdkContainer.setCommitment(commitment);
        };

        const onCancel = () => {
            uiContainer.resetTrade().catch(_catchInteractionErr_);
            sdkContainer.resetTrade().catch(_catchInteractionErr_);
            cancel();
        };

        // The confirmed order inputs should always be available
        if (!confirmedOrderInputs) {
            return <></>;
        }

        // Ask the user to confirm the details before continuing
        if (!confirmedTrade) {
            return <ConfirmTradeDetails
                orderInputs={confirmedOrderInputs}
                done={uiContainer.onConfirmedTrade}
                cancel={onCancel}
                quoteCurrency={uiContainer.state.preferredCurrency}
                tokenPrices={uiContainer.state.tokenPrices}
            />;
        }

        // Ask the user to provide an address for receiving `dstToken`
        if (toAddress === null) {
            return <AskForAddress
                key={confirmedOrderInputs.dstToken} // Since AskForAddress is used twice
                token={confirmedOrderInputs.dstToken}
                message={`Enter the ${confirmedOrderInputs.dstToken} public address you want to receive your tokens to.`}
                onAddress={uiContainer.updateToAddress}
                cancel={onCancel}
                defaultAddress={address || ""}
            />;
        }

        // Ask the user to provide an address for refunding `srcToken` to in
        // case the trade doesn't go through
        return <AskForAddress
            key={confirmedOrderInputs.srcToken} // Since AskForAddress is used twice
            token={confirmedOrderInputs.srcToken}
            message={`Enter your ${confirmedOrderInputs.srcToken} refund address in case the trade doesn't go through.`}
            onAddress={onRefundAddress}
            cancel={onCancel}
            defaultAddress={address || ""}
        />;
    }
);
