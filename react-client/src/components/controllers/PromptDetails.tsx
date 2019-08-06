import * as React from "react";

import { InfoLabel } from "@renproject/react-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { UIContainer } from "../../state/uiContainer";
import { AskForAddress } from "../views/order-popup/AskForAddress";
import { ConfirmTradeDetails } from "../views/order-popup/ConfirmTradeDetails";
import { BTC_FAUCET_LINK, TAZ_FAUCET_LINK } from "../views/tutorial-popup/TutorialPages";

interface Props {
    cancel: () => void;
}

/**
 * PromptDetails is a visual component for allowing users to open new orders
 */
export const PromptDetails = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer], cancel }) => {

        const {
            toAddress, confirmedOrderInputs, confirmedTrade,
            address,
        } = uiContainer.state;

        const onRefundAddress = async (refundAddress: string) => {
            await uiContainer.updateRefundAddress(refundAddress).catch(_catchInteractionErr_);
            await uiContainer.commitOrder();
        };

        const onCancel = () => {
            uiContainer.resetTrade().catch(_catchInteractionErr_);
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
                message={<>
                    Enter the {confirmedOrderInputs.dstToken} public address you want to receive your tokens to.
                    {confirmedOrderInputs.dstToken === Token.BTC ? <InfoLabel><span className="hint">Hint</span>: If you don't have a Testnet BTC wallet, use the <a className="blue" href={BTC_FAUCET_LINK} target="_blank" rel="noopener noreferrer">faucet</a>'s return address.</InfoLabel> : <></>}
                </>}
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
            message={<>
                Enter your {confirmedOrderInputs.srcToken} refund address in case the trade doesn't go through.
                {confirmedOrderInputs.srcToken === Token.BTC ? <InfoLabel><span className="hint">Hint</span>: If you don't have a Testnet BTC wallet, use the <a className="blue" href={BTC_FAUCET_LINK} target="_blank" rel="noopener noreferrer">faucet</a>'s return address.</InfoLabel> : <></>}
                {confirmedOrderInputs.srcToken === Token.ZEC ? <InfoLabel><span className="hint">Hint</span>: If you don't have a Testnet ZEC wallet, use the <a className="blue" href={TAZ_FAUCET_LINK} target="_blank" rel="noopener noreferrer">faucet</a>'s return address.</InfoLabel> : <></>}
            </>}
            onAddress={onRefundAddress}
            cancel={onCancel}
            defaultAddress={address || ""}
        />;
    }
);
