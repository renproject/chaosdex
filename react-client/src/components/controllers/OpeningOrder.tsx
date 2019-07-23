import * as React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { isERC20, isEthereumBased } from "../../state/generalTypes";
import { ShiftInStatus, ShiftOutEvent, ShiftOutStatus } from "../../state/persistentContainer";
import { SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { DepositReceived } from "../views/order-popup/DepositReceived";
import { ShowDepositAddress } from "../views/order-popup/ShowDepositAddress";
import { SubmitToEthereum } from "../views/order-popup/SubmitToEthereum";
import { TokenAllowance } from "../views/order-popup/TokenAllowance";

interface Props extends ConnectedProps<[UIContainer, SDKContainer]> {
    orderID: string;
    cancel: () => void;
}

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
export const OpeningOrder = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ orderID, containers: [uiContainer, sdkContainer], cancel }) => {

        // tslint:disable-next-line: prefer-const
        let [returned, setReturned] = React.useState(false);
        const [ERC20Approved, setERC20Approved] = React.useState(false);
        const { orderInputs } = uiContainer.state;

        const onCancel = () => {
            uiContainer.resetTrade().catch(_catchInteractionErr_);
            sdkContainer.resetTrade(orderID).catch(_catchInteractionErr_);
            cancel();
        };

        const onDone = async () => {
            if (returned) {
                return;
            }
            returned = true;
            setReturned(true);
            uiContainer.resetTrade().catch(_catchInteractionErr_);
        };

        const shiftIn = () => {
            const order = sdkContainer.order(orderID);

            switch (order.status) {
                case ShiftInStatus.Commited:
                    // Show the deposit address and wait for a deposit
                    return <ShowDepositAddress
                        orderID={orderID}
                        generateAddress={sdkContainer.generateAddress}
                        token={orderInputs.srcToken}
                        amount={order.orderInputs.srcAmount}
                        waitForDeposit={sdkContainer.waitForDeposits}
                        cancel={onCancel}
                    />;
                case ShiftInStatus.Deposited:
                case ShiftInStatus.SubmittedToRenVM:
                    return <DepositReceived messageID={order.messageID} orderID={orderID} submitDeposit={sdkContainer.submitMintToRenVM} />;
                case ShiftInStatus.ReturnedFromRenVM:
                case ShiftInStatus.SubmittedToEthereum:
                    return <SubmitToEthereum token={orderInputs.dstToken} orderID={orderID} submit={sdkContainer.submitMintToEthereum} />;
                case ShiftInStatus.ConfirmedOnEthereum:
                    onDone().catch(_catchInteractionErr_);
                    return <></>;
            }
            return <></>;
        };

        const shiftOut = () => {
            // Burning

            const order = sdkContainer.order(orderID);
            const { messageID, commitment } = order as ShiftOutEvent;

            switch (order.status) {
                case ShiftOutStatus.Commited:
                case ShiftOutStatus.SubmittedToEthereum:
                    const submit = async (submitOrderID: string) => {
                        await sdkContainer.approveTokenTransfer(submitOrderID);
                        setERC20Approved(true);
                    };
                    if (isERC20(orderInputs.srcToken) && !ERC20Approved) {
                        return <TokenAllowance token={orderInputs.srcToken} amount={order.orderInputs.srcAmount} orderID={orderID} submit={submit} commitment={commitment} />;
                    }

                    // Submit the trade to Ethereum
                    return <SubmitToEthereum token={orderInputs.dstToken} orderID={orderID} submit={sdkContainer.submitBurnToEthereum} />;
                case ShiftOutStatus.ConfirmedOnEthereum:
                case ShiftOutStatus.SubmittedToRenVM:
                    return <DepositReceived messageID={messageID} orderID={orderID} submitDeposit={sdkContainer.submitBurnToRenVM} />;
                case ShiftOutStatus.ReturnedFromRenVM:
                    onDone().catch(_catchInteractionErr_);
                    return <></>;
            }
            return <></>;
        };

        if (!isEthereumBased(orderInputs.srcToken) && isEthereumBased(orderInputs.dstToken)) {
            return shiftIn();
        } else if (isEthereumBased(orderInputs.srcToken) && !isEthereumBased(orderInputs.dstToken)) {
            return shiftOut();
        } else {
            return <p>Unsupported token pair.</p>;
        }
    }
);
