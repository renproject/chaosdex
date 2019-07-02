import * as React from "react";

import { withTranslation, WithTranslation } from "react-i18next";

import { _catchInteractionErr_ } from "../../lib/errors";
import { SDKContainer, HistoryEvent } from "../../state/sdkContainer";
import { connect, ConnectedProps } from "../../state/connect";
import { isERC20, isEthereumBased } from "../../state/generalTypes";
import { DepositReceived } from "../views/popups/DepositReceived";
import { ShowDepositAddress } from "../views/popups/ShowDepositAddress";
import { SubmitToEthereum } from "../views/popups/SubmitToEthereum";
import { TokenAllowance } from "../views/popups/TokenAllowance";

const defaultState = { // Entries must be immutable
    depositReceived: false,
    depositSubmitted: false,
};

/**
 * OpeningOrder is a visual component for allowing users to open new orders
 */
class OpeningOrderClass extends React.Component<Props, typeof defaultState> {
    private _returned = false;

    constructor(props: Props) {
        super(props);
        this.state = defaultState;
    }

    public componentDidMount = () => {
        this._returned = false;
    }

    public mint() {
        const [appContainer] = this.props.containers;
        const { depositReceived, depositSubmitted } = this.state;
        const {
            orderInputs: orderInput, depositAddress, confirmedOrderInputs,
            outTx, messageID,
        } = appContainer.state;

        if (!confirmedOrderInputs) {
            return null;
        }

        if (!depositSubmitted) {
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
            return <DepositReceived messageID={messageID} submitDeposit={this.submitDeposit} done={this.onDepositSubmitted} />;
        }

        if (!outTx) {
            // Submit the trade to Ethereum
            return <SubmitToEthereum token={orderInput.dstToken} submit={this.submitSwap} />;
        }

        this.onDone().catch(_catchInteractionErr_);
        return <></>;
    }

    public burn() {
        // Burning

        const [appContainer] = this.props.containers;
        const {
            orderInputs: orderInput, confirmedOrderInputs, erc20Approved, outTx,
            inTx, messageID,
        } = appContainer.state;

        if (!confirmedOrderInputs) {
            return null;
        }

        if (!inTx) {
            // // If `srcToken` is Ethereum-based they can submit to the contract
            // // directly, otherwise they must deposit `srcToken` to a generated
            // // address.
            if (isERC20(orderInput.srcToken) && !erc20Approved) {
                return <TokenAllowance token={orderInput.srcToken} amount={confirmedOrderInputs.srcAmount} submit={this.props.containers[0].setAllowance} />;
            }

            // Submit the trade to Ethereum
            return <SubmitToEthereum token={orderInput.dstToken} submit={this.submitBurn} />;
        }

        if (!outTx) {
            return <DepositReceived messageID={messageID} submitDeposit={this.checkBurnStatus} done={this.onDepositSubmitted} />;
        }

        this.onDone().catch(_catchInteractionErr_);
        return <></>;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const [appContainer] = this.props.containers;
        const {
            orderInputs: orderInput, confirmedOrderInputs,
        } = appContainer.state;

        if (!confirmedOrderInputs) {
            return null;
        }

        if (!isEthereumBased(orderInput.srcToken) && isEthereumBased(orderInput.dstToken)) {
            return this.mint();
        } else if (isEthereumBased(orderInput.srcToken) && !isEthereumBased(orderInput.dstToken)) {
            return this.burn();
        } else {
            return <p>Unsupported token pair.</p>;
        }
    }

    private readonly onDeposit = () => {
        this.setState({ depositReceived: true });
    }

    private readonly waitForDeposit = async () => {
        await this.props.containers[0].waitForDeposits();
    }

    private readonly submitDeposit = async () => {
        await this.props.containers[0].submitDeposit();
    }

    private readonly onDepositSubmitted = () => {
        this.setState({ depositSubmitted: true });
    }

    private readonly submitSwap = async () => {
        await this.props.containers[0].submitSwap();
    }

    private readonly submitBurn = async () => {
        await this.props.containers[0].submitBurn();
    }

    private readonly checkBurnStatus = async () => {
        await this.props.containers[0].checkBurnStatus();
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

    private readonly generateAddress = async () => {
        await this.props.containers[0].updateCommitment();
    }

    private readonly cancel = () => {
        this.props.containers[0].resetTrade().catch(_catchInteractionErr_);
        this.props.cancel();
    }
}

interface Props extends ConnectedProps<[SDKContainer]>, WithTranslation {
    cancel: () => void;
    swapSubmitted?: (h: HistoryEvent) => void;
}

export const OpeningOrder = withTranslation()(connect<Props>([SDKContainer])(OpeningOrderClass));
