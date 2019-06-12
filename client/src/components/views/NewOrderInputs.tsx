import * as React from "react";

import { CurrencyIcon, TokenValueInput } from "@renex/react-components";
import BigNumber from "bignumber.js";
import { withTranslation, WithTranslation } from "react-i18next";
import { debounce } from "throttle-debounce";

import { _catchInteractionErr_ } from "../../lib/errors";
import { AppContainer } from "../../state/appContainer";
import { connect, ConnectedProps } from "../../state/connect";
import arrow from "../../styles/images/arrow.svg";
import { SelectMarketWrapper } from "./SelectMarketWrapper";
import { TokenBalance } from "./TokenBalance";

export const normalizeDecimals = (inputIn: string | null): string | null => {
    return inputIn === null ? inputIn : new BigNumber(inputIn).decimalPlaces(8).toFixed();
};

const defaultState = {
    srcAmountState: "",
    allOrNothing: false,
    immediateOrCancel: false,
    fillOrKill: false,
    flipped: false,
};

class NewOrderInputsClass extends React.Component<Props, typeof defaultState> {
    constructor(props: Props) {
        super(props);
        this.state = { ...defaultState, srcAmountState: props.containers[0].state.orderInputs.srcAmount };
    }

    public render(): React.ReactNode {
        const { t, containers: [appContainer] } = this.props;
        const { flipped } = this.state;

        const toggle = <div className="order--tabs">
            <span
                role="button"
                onClick={this.toggleSide}
            >
                <img alt="Swap side" role="button" className={flipped ? "flipped" : ""} src={arrow} />
            </span>
        </div>;

        const quoteCurrency = appContainer.state.preferredCurrency;
        const orderInputs = appContainer.state.orderInputs;

        const firstSubtext = <>
            {"~ "}
            <CurrencyIcon currency={quoteCurrency} />
            {" "}
            <TokenBalance
                token={orderInputs.srcToken}
                convertTo={quoteCurrency}
                tokenPrices={appContainer.state.tokenPrices}
                amount={orderInputs.srcAmount || "0"}
            />
        </>;

        const first = <TokenValueInput
            title={t("new_order.spend")}
            value={this.state.srcAmountState}
            subtext={firstSubtext}
            hint={null}
            error={false}
            onChange={this.onVolumeChange}
        >
            <SelectMarketWrapper top={true} thisToken={orderInputs.srcToken} otherToken={orderInputs.dstToken} />
        </TokenValueInput >;

        const second = <TokenValueInput
            title={t("new_order.receive")}
            value={normalizeDecimals(orderInputs.dstAmount)}
            subtext={<></>}
            hint={t<string>("new_order.based_on_market_price")}
            error={false}
            onChange={null}
            className="order-inputs--second"
        >
            <SelectMarketWrapper top={false} thisToken={orderInputs.dstToken} otherToken={orderInputs.srcToken} />
        </TokenValueInput>;

        return <div className="order--wrapper">
            {first}{toggle}{second}
        </div>;
    }

    private readonly onVolumeChange = (value: string, options: { blur: boolean }) => {
        // If the value is in scientific notation, fix it
        if (value.toLowerCase().indexOf("e") !== -1) {
            value = new BigNumber(value).toFixed();
        }

        this.setState({ srcAmountState: value });
        // tslint:disable-next-line: no-floating-promises
        this.debouncedVolumeChange(value);
    }

    /**
     * Waits 100ms to update the send volume in case the user is still typing
     */
    private readonly debouncedVolumeChange = async (value: string) =>
        debounce(100, false, async () =>
            this.props.containers[0].updateSrcAmount(value).catch(_catchInteractionErr_)
        )()

    private readonly toggleSide = async () => {
        await this.props.containers[0].flipSendReceive();
    }
}

interface Props extends ConnectedProps<[AppContainer, AppContainer]>, WithTranslation {
    marketPrice: number;
}

export const NewOrderInputs = withTranslation()(connect<Props>([AppContainer, AppContainer])(NewOrderInputsClass));
