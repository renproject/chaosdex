import * as React from "react";

import BigNumber from "bignumber.js";

import { CurrencyIcon, InfoLabel } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";
import { debounce } from "throttle-debounce";

import { _captureInteractionException_ } from "../lib/errors";
import { connect, ConnectedProps } from "../state/connect";
import { AppContainer, OptionsContainer } from "../state/containers";
import { SelectMarketWrapper } from "./SelectMarketWrapper";
import { TokenBalance } from "./views/TokenBalance";
import { TokenValueInput } from "./views/TokenValueInput";

import arrow from "../styles/images/arrow.svg";

export const normalizeDecimals = (inputIn: string | null): string | null => {
    return inputIn === null ? inputIn : new BigNumber(inputIn).decimalPlaces(8).toFixed();
};

class NewOrderInputsClass extends React.Component<Props, State> {
    private readonly appContainer: AppContainer;
    private readonly optionsContainer: OptionsContainer;

    constructor(props: Props) {
        super(props);

        [this.appContainer, this.optionsContainer] = this.props.containers;

        this.state = {
            sendVolumeState: this.appContainer.state.order.sendVolume,
            allOrNothing: false,
            immediateOrCancel: false,
            fillOrKill: false,
            flipped: false,
        };
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

        const firstTitle = t("new_order.spend");
        let firstValue;
        let firstSubtext;
        let firstError;
        let firstOnChange;

        let secondValue;
        let secondSubtext;

        const quoteCurrency = this.optionsContainer.state.preferredCurrency;
        const orderInputs = this.appContainer.state.order;

        let extra;
        firstValue = this.state.sendVolumeState;
        firstSubtext = <>
            {"~ "}
            <CurrencyIcon currency={quoteCurrency} />
            {" "}
            <TokenBalance
                token={orderInputs.sendToken}
                convertTo={quoteCurrency}
                tokenPrices={this.appContainer.state.tokenPrices}
                amount={orderInputs.sendVolume || "0"}
            />
        </>;
        firstError = false; // orderInputs.inputError !== null && orderInputs.inputError.category === "input";
        firstOnChange = this.onVolumeChange;

        secondValue = normalizeDecimals(orderInputs.receiveVolume);
        secondSubtext = <></>;
        /*
        secondSubtext = <>
            {updating ? <Loading className="loading--small" /> : null}{" "}
            {pairDetails ? `1 ${pairDetails.base} = ${normalizeDecimals(price)} ${pairDetails.quote} ± 3%` : "\xa0"}
        </>;
        */

        extra = this.advanced_render();

        const first = <TokenValueInput
            title={firstTitle}
            value={firstValue}
            subtext={firstSubtext}
            hint={null}
            error={firstError}
            onChange={firstOnChange}
        >
            <SelectMarketWrapper top={true} thisToken={orderInputs.sendToken} otherToken={orderInputs.receiveToken} />
        </TokenValueInput >;

        const second = <TokenValueInput
            title={t("new_order.receive")}
            value={secondValue}
            subtext={secondSubtext}
            hint={t<string>("new_order.based_on_market_price")}
            error={false}
            onChange={null}
            className="order-inputs--second"
        >
            <SelectMarketWrapper top={false} thisToken={orderInputs.receiveToken} otherToken={orderInputs.sendToken} />
        </TokenValueInput>;

        return <>
            <div className="order--wrapper order--wrapper--tabbed">
                {first}{toggle}{second}
            </div>
            {extra}
        </>;
    }

    public advanced_render(): React.ReactNode {
        const { fillOrKill, allOrNothing, immediateOrCancel } = this.state;
        const advanced = false;

        return <div className={`order--options ${!advanced ? "hidden" : ""}`}>
            <label>
                <input
                    name="allOrNothing"
                    type="checkbox"
                    disabled={fillOrKill}
                    checked={allOrNothing || fillOrKill}
                    onChange={this.handleMoreOptions}
                />
                All or Nothing <InfoLabel>No partial fills of order will be accepted.</InfoLabel>
            </label>
            <label>
                <input
                    name="immediateOrCancel"
                    type="checkbox"
                    disabled={fillOrKill}
                    checked={immediateOrCancel || fillOrKill}
                    onChange={this.handleMoreOptions}
                />
                Immediate or Cancel <InfoLabel>If no immediate order match is in the current orderbook (full or partial), then order is cancelled.</InfoLabel>
            </label>
            <label>
                <input
                    name="fillOrKill"
                    type="checkbox"
                    disabled={allOrNothing && immediateOrCancel}
                    checked={fillOrKill || (allOrNothing && immediateOrCancel)}
                    onChange={this.handleMoreOptions}
                />
                Fill or Kill <InfoLabel>If the entire order cannot be executed against the current orderbook, cancel the order.</InfoLabel>
            </label>
        </div>;
    }

    private readonly onVolumeChange = (value: string, options: { blur: boolean }) => {
        // If the value is in scientific notation, fix it
        if (value.toLowerCase().indexOf("e") !== -1) {
            value = new BigNumber(value).toFixed();
        }

        this.setState({ sendVolumeState: value });
        this.debouncedVolumeChange(value);
    }

    /**
     * Waits 100ms to update the send volume in case the user is still typing
     */
    private readonly debouncedVolumeChange = (value: string) => {
        debounce(100, false, async () =>
            this.appContainer.updateSendVolume(value)
        )().catch(_captureInteractionException_);
    }

    private readonly toggleSide = async () => {
        await this.appContainer.flipSendReceive();
    }

    private readonly handleMoreOptions = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const { name, checked } = e.target;
        this.setState((oldState) => ({ ...oldState, [name]: checked, }));
    }
}

// tslint:enable:jsx-no-lambda

interface Props extends ConnectedProps, WithTranslation {
    marketPrice: number;
    handleChange: (inputValue: string | null) => void;
}

interface State {
    sendVolumeState: string;
    allOrNothing: boolean;
    immediateOrCancel: boolean;
    fillOrKill: boolean;
    flipped: boolean;
}

export const NewOrderInputs = withTranslation()(connect<Props>([AppContainer, OptionsContainer])(NewOrderInputsClass));
