import * as React from "react";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { isERC20, isEthereumBased } from "../../state/generalTypes";
import { HistoryEvent, SDKContainer } from "../../state/sdkContainer";
import { UIContainer } from "../../state/uiContainer";
import { DepositReceived } from "../views/popups/DepositReceived";
import { ShowDepositAddress } from "../views/popups/ShowDepositAddress";
import { SubmitToEthereum } from "../views/popups/SubmitToEthereum";
import { TokenAllowance } from "../views/popups/TokenAllowance";

interface Props extends ConnectedProps<[UIContainer, SDKContainer]> {
    cancel: () => void;
    swapSubmitted?: (h: HistoryEvent) => void;
}

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
export const OpeningOrder = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], cancel, swapSubmitted }) => {

        // tslint:disable-next-line: prefer-const
        let [returned, setReturned] = React.useState(false);
        const [depositReceived, setDepositReceived] = React.useState(false);
        const [depositSubmitted, setDepositSubmitted] = React.useState(false);

        const {
            orderInputs,
        } = uiContainer.state;

        const onDeposit = () => {
            setDepositReceived(true);
        };

        const waitForDeposit = async () => {
            await sdkContainer.waitForDeposits();
        };

        const submitDeposit = async () => {
            await sdkContainer.submitDeposit();
        };

        const onDepositSubmitted = () => {
            setDepositSubmitted(true);
        };

        const submitSwap = async () => {
            await sdkContainer.submitSwap();
        };

        const submitBurn = async () => {
            await sdkContainer.submitBurn();
        };

        const checkBurnStatus = async () => {
            await sdkContainer.checkBurnStatus();
        };

        const onCancel = () => {
            uiContainer.resetTrade().catch(_catchInteractionErr_);
            sdkContainer.resetTrade().catch(_catchInteractionErr_);
            cancel();
        };

        const onDone = async () => {
            if (returned) {
                return;
            }
            returned = true;
            setReturned(true);
            const historyItem = await sdkContainer.getHistoryEvent();
            if (!historyItem || !swapSubmitted) {
                return;
            }
            onCancel();
            swapSubmitted(historyItem);
        };

        const mint = () => {
            const {
                confirmedOrderInputs,
            } = uiContainer.state;
            const { depositAddress, outTx, messageID } = sdkContainer.state;

            if (!confirmedOrderInputs) {
                return null;
            }

            if (!depositSubmitted) {
                // Show the deposit address and wait for a deposit
                if (!depositReceived) {
                    return <ShowDepositAddress
                        generateAddress={sdkContainer.generateAddress}
                        token={orderInputs.srcToken}
                        depositAddress={depositAddress}
                        amount={confirmedOrderInputs.srcAmount}
                        waitForDeposit={waitForDeposit}
                        cancel={onCancel}
                        done={onDeposit}
                    />;
                }
                return <DepositReceived messageID={messageID} submitDeposit={submitDeposit} done={onDepositSubmitted} />;
            }

            if (!outTx) {
                // Submit the trade to Ethereum
                return <SubmitToEthereum token={orderInputs.dstToken} submit={submitSwap} />;
            }

            onDone().catch(_catchInteractionErr_);
            return <></>;
        };

        const burn = () => {
            // Burning

            const { confirmedOrderInputs } = uiContainer.state;
            const { erc20Approved, outTx, inTx, messageID } = sdkContainer.state;

            if (!confirmedOrderInputs) {
                return null;
            }

            if (!inTx) {
                // // If `srcToken` is Ethereum-based they can submit to the contract
                // // directly, otherwise they must deposit `srcToken` to a generated
                // // address.
                if (isERC20(orderInputs.srcToken) && !erc20Approved) {
                    return <TokenAllowance token={orderInputs.srcToken} amount={confirmedOrderInputs.srcAmount} submit={sdkContainer.setAllowance} commitment={sdkContainer.state.commitment} />;
                }

                // Submit the trade to Ethereum
                return <SubmitToEthereum token={orderInputs.dstToken} submit={submitBurn} />;
            }

            if (!outTx) {
                return <DepositReceived messageID={messageID} submitDeposit={checkBurnStatus} done={onDepositSubmitted} />;
            }

            onDone().catch(_catchInteractionErr_);
            return <></>;
        };

        if (!isEthereumBased(orderInputs.srcToken) && isEthereumBased(orderInputs.dstToken)) {
            return mint();
        } else if (isEthereumBased(orderInputs.srcToken) && !isEthereumBased(orderInputs.dstToken)) {
            return burn();
        } else {
            return <p>Unsupported token pair.</p>;
        }
    }
);
