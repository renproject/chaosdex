import * as React from "react";

import { InfoLabel } from "@renproject/react-components";

import { IS_TESTNET } from "../../lib/environmentVariables";
import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { renderToken, Token } from "../../state/generalTypes";
import { CommitmentType } from "../../state/persistentContainer";
import { SDKContainer } from "../../state/sdkContainer";
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
export const PromptDetails = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], cancel }) => {

        const {
            toAddress, confirmedOrderInputs, confirmedTrade,
            address, commitmentType, preferredCurrency, tokenPrices
        } = uiContainer.state;

        const onRefundAddress = React.useCallback(async (refundAddress: string) => {
            await uiContainer.updateRefundAddress(refundAddress).catch(error => _catchInteractionErr_(error, "Error in PromptDetails: updateRefundAddress"));
            const eventHistory = await uiContainer.commitOrder();
            if (eventHistory.shiftIn) {
                await sdkContainer.shiftIn(eventHistory);
            } else {
                await sdkContainer.shiftOut(eventHistory);
            }
        }, [uiContainer, sdkContainer]);

        const onCancel = () => {
            uiContainer.resetTrade().catch(error => _catchInteractionErr_(error, "Error in PromptDetails: resetTrade"));
            cancel();
        };

        // The confirmed order inputs should always be available
        if (!confirmedOrderInputs) {
            return <></>;
        }

        // Ask the user to confirm the details before continuing
        // Ask the user to confirm the details before continuing
        if (!confirmedTrade) {
            return <ConfirmTradeDetails
                orderInputs={confirmedOrderInputs}
                done={uiContainer.onConfirmedTrade}
                cancel={onCancel}
                quoteCurrency={preferredCurrency}
                tokenPrices={tokenPrices}
                commitmentType={commitmentType}
            />;
        }

        // Ask the user to provide an address for receiving `dstToken`
        if (toAddress === null) {
            return <AskForAddress
                key={confirmedOrderInputs.dstToken} // Since AskForAddress is used twice
                token={confirmedOrderInputs.dstToken}
                message={commitmentType === CommitmentType.Trade ? <>
                    Enter the {renderToken(confirmedOrderInputs.dstToken)} public address you want to receive your tokens to.
                    {confirmedOrderInputs.dstToken === Token.BTC && IS_TESTNET ? <InfoLabel><span className="hint">Hint</span>: If you don't have a Testnet BTC wallet, use the <a className="blue" href={BTC_FAUCET_LINK} target="_blank" rel="noopener noreferrer">faucet</a>'s return address.</InfoLabel> : <></>}
                </> : <>Enter your Ethereum address to receive Liquidity tokens.</>}
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
                Enter your {renderToken(confirmedOrderInputs.srcToken)} refund address in case the {commitmentType === CommitmentType.Trade ? "trade" : "transaction"} doesn't go through.
                {confirmedOrderInputs.srcToken === Token.BTC && IS_TESTNET ? <InfoLabel><span className="hint">Hint</span>: If you don't have a Testnet BTC wallet, use the <a className="blue" href={BTC_FAUCET_LINK} target="_blank" rel="noopener noreferrer">faucet</a>'s return address.</InfoLabel> : <></>}
                {confirmedOrderInputs.srcToken === Token.ZEC && IS_TESTNET ? <InfoLabel><span className="hint">Hint</span>: If you don't have a Testnet ZEC wallet, use the <a className="blue" href={TAZ_FAUCET_LINK} target="_blank" rel="noopener noreferrer">faucet</a>'s return address.</InfoLabel> : <></>}
            </>}
            onAddress={onRefundAddress}
            cancel={onCancel}
            defaultAddress={address || ""}
        />;
    }
);
