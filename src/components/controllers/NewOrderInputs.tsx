import * as React from "react";

import { CurrencyIcon, InfoLabel, TokenValueInput } from "@renex/react-components";
import BigNumber from "bignumber.js";
import { withTranslation, WithTranslation } from "react-i18next";
import { debounce } from "throttle-debounce";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer, OptionsContainer } from "../../state/containers";
import arrow from "../../styles/images/arrow.svg";
import { TokenBalance } from "../views/TokenBalance";
import { SelectMarketWrapper } from "./SelectMarketWrapper";

export const normalizeDecimals = (inputIn: string | null): string | null => {
    return inputIn === null ? inputIn : new BigNumber(inputIn).decimalPlaces(8).toFixed();
};

const defaultState = {
    sendVolumeState: "",
    allOrNothing: false,
    immediateOrCancel: false,
    fillOrKill: false,
    flipped: false,
};

class NewOrderInputsClass extends React.Component<Props, typeof defaultState> {
    private readonly appContainer: AppContainer;
    private readonly optionsContainer: OptionsContainer;

    constructor(props: Props) {
        super(props);
        [this.appContainer, this.optionsContainer] = this.props.containers;
        this.state = { ...defaultState, sendVolumeState: this.appContainer.state.order.sendVolume };
    }

    public render(): React.ReactNode {
        const { t } = this.props;
        const { flipped } = this.state;

        const toggle = <div className="order--tabs">
            <span
                role="button"
                onClick={this.toggleSide}
            >
                <img alt="Swap side" role="button" className={flipped ? "flipped" : ""} src={arrow} />
            </span>
        </div>;

        const quoteCurrency = this.optionsContainer.state.preferredCurrency;
        const orderInputs = this.appContainer.state.order;

        const firstSubtext = <>
            {"~ "}
            <CurrencyIcon currency={quoteCurrency} />
            {" "}
            <TokenBalance
                token={orderInputs.srcToken}
                convertTo={quoteCurrency}
                tokenPrices={this.appContainer.state.tokenPrices}
                amount={orderInputs.sendVolume || "0"}
            />
        </>;

        const first = <TokenValueInput
            title={t("new_order.spend")}
            value={this.state.sendVolumeState}
            subtext={firstSubtext}
            hint={null}
            error={false}
            onChange={this.onVolumeChange}
        >
            <SelectMarketWrapper top={true} thisToken={orderInputs.srcToken} otherToken={orderInputs.dstToken} />
        </TokenValueInput >;

        const second = <TokenValueInput
            title={t("new_order.receive")}
            value={normalizeDecimals(orderInputs.receiveVolume)}
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

        this.setState({ sendVolumeState: value });
        // tslint:disable-next-line: no-floating-promises
        this.debouncedVolumeChange(value);
    }

    /**
     * Waits 100ms to update the send volume in case the user is still typing
     */
    private readonly debouncedVolumeChange = async (value: string) =>
        debounce(100, false, async () =>
            this.appContainer.updateSendVolume(value).catch(_catchInteractionErr_)
        )()

    private readonly toggleSide = async () => {
        await this.appContainer.flipSendReceive();
    }

    private readonly handleMoreOptions = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const { name, checked } = e.target;
        this.setState((oldState) => ({ ...oldState, [name]: checked, }));
    }
}

interface Props extends ConnectedProps<[AppContainer, OptionsContainer]>, WithTranslation {
    marketPrice: number;
}

export const NewOrderInputs = withTranslation()(connect<Props>([AppContainer, OptionsContainer])(NewOrderInputsClass));
