import * as React from "react";

import { Loading } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";

import { getMarket } from "../../lib/market";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { AskForAddress } from "../popups/AskForAddress";
// import { ConfirmTradeDetails } from "../popups/ConfirmTradeDetails";
import { NewOrderInputs } from "./NewOrderInputs";

const defaultState = { // Entries must be immutable
    submitting: false,
    receiveAddress: null as string | null,
};

/**
 * NewOrder is a visual component for allowing users to open new orders
 */
class NewOrderClass extends React.Component<Props, typeof defaultState> {
    private readonly appContainer: AppContainer;

    constructor(props: Props) {
        super(props);
        [this.appContainer] = this.props.containers;
        this.state = defaultState;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { t, disabled } = this.props;
        const { submitting, receiveAddress } = this.state;
        const orderInput = this.appContainer.state.order;
        const market = getMarket(orderInput.sendToken, orderInput.receiveToken);

        const marketPrice = 0;

        return <>
            <div className="section order">
                <NewOrderInputs
                    marketPrice={marketPrice}
                    handleChange={this.handleChange}
                />
                {
                    market ?
                        <button
                            onClick={this.openOrder}
                            disabled={disabled}
                            className="button submit-swap"
                        >
                            {submitting ? <Loading alt={true} /> : <>{t("new_order.trade")}</>}
                        </button> :
                        <button disabled={true} className="button submit-swap">
                            {t("new_order.unsupported_token_pair")}
                        </button>
                }
            </div>
            {/*<div className="order--error red">{orderInputs.inputError.error}</div>*/}
            {submitting ? <>
                {receiveAddress === null ? <AskForAddress
                    token={this.appContainer.state.order.receiveToken}
                    message={`Enter the ${this.appContainer.state.order.receiveToken} public address you want to receive your tokens to.`}
                    onAddress={this.onAddress}
                    cancel={this.cancel}
                /> : <></>}
            </>
                : <></>
            }
        </>;
    }

    private readonly onAddress = (receiveAddress: string) => {
        this.setState({ receiveAddress });
    }

    private readonly cancel = () => {
        this.setState({ submitting: false, receiveAddress: null });
    }

    private readonly openOrder = async () => {
        this.setState({ submitting: true });
    }
    //     try {
    //         await confirmTradeDetails(this.appContainer);

    //         const refundAddress = await askForAddress(
    //             this.appContainer,
    //             this.appContainer.state.order.sendToken,
    //             `Enter your ${this.appContainer.state.order.receiveToken} refund address in case the trade doesn't go through.`,
    //         );
    //         console.debug(`receiveAddress: ${receiveAddress},   refundAddress: ${refundAddress}`);
    //     } catch (error) {
    //         return;
    //     }

    // }

    private readonly handleChange = async (value: string | null) => {
        console.debug("handelChange: unimplemented");
    }
}

interface Props extends ConnectedProps<[AppContainer]>, WithTranslation {
    disabled: boolean;
}

export const NewOrder = withTranslation()(connect<Props>([AppContainer])(NewOrderClass));
