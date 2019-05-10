import * as React from "react";

import BigNumber from "bignumber.js";

import { CurrencyIcon, InfoLabel, Loading } from "@renex/react-components";
import { withTranslation, WithTranslation } from "react-i18next";

import { _captureInteractionException_ } from "../lib/errors";
import { MarketPairs, UnknownToken } from "../lib/market";
import { normalizeDecimals, setAndUpdateValues, swapTokens } from "../store/actions/inputs/newOrderActions";
import { ApplicationData, MarketPair, Token, Tokens } from "../store/types/general";
import { SelectMarketWrapper } from "./SelectMarketWrapper";
import { TokenValueInput } from "./views/TokenValueInput";

import { connect, ConnectedProps } from "../state/connect";
import { AppContainer } from "../state/containers/appContainer";
import { OptionsContainer } from "../state/containers/optionsContainer";
import arrow from "../styles/images/arrow.svg";
import { TokenBalance } from "./views/TokenBalance";

class NewOrderInputsClass extends React.Component<Props, State> {
    private readonly appContainer: AppContainer;
    private readonly optionsContainer: OptionsContainer;

    constructor(props: Props) {
        super(props);

        [this.appContainer, this.optionsContainer] = this.props.containers;

        this.state = {
            allOrNothing: false,
            immediateOrCancel: false,
            fillOrKill: false,
            flipped: false,
        };
    }

    public render(): React.ReactNode {
        const { t } = this.props;
        const { flipped } = this.state;

        const market = MarketPair.DAI_BTC;
        const pairDetails = MarketPairs.get(market);

        const btcTokenDetails = Tokens.get(Token.BTC) || UnknownToken;

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
        firstValue = orderInputs.sendVolume;
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

        const updating = false;
        const price = "0";

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
            hint={t("new_order.based_on_market_price") as string}
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

    private readonly onVolumeChange = (newValue: string, options: { blur: boolean }) => {
        this.appContainer.updateSendVolume(newValue);
    }

    private readonly toggleSide = () => {
        // const { orderInputs } = this.props;
        // this.props.actions.swapTokens(orderInputs);
        // this.setState({ flipped: !this.state.flipped });
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
    allOrNothing: boolean;
    immediateOrCancel: boolean;
    fillOrKill: boolean;
    flipped: boolean;
}

export const NewOrderInputs = withTranslation()(connect<Props>([AppContainer, OptionsContainer])(NewOrderInputsClass));
