import * as React from "react";

import BigNumber from "bignumber.js";

import { CurrencyIcon, InfoLabel, Loading } from "@renex/react-components";
import { connect, ConnectedReturnType } from "react-redux"; // Custom typings
import { bindActionCreators, Dispatch } from "redux";

import { _captureInteractionException_ } from "../lib/errors";
import { MarketPairs, UnknownToken } from "../lib/market";
import { normalizeDecimals, setAndUpdateValues, swapTokens } from "../store/actions/inputs/newOrderActions";
import { ApplicationData, MarketPair, Token, Tokens } from "../store/types/general";
import { SelectMarketWrapper } from "./SelectMarketWrapper";
import { TokenValueInput } from "./views/TokenValueInput";

import arrow from "../styles/images/arrow.svg";

class NewOrderInputsClass extends React.Component<Props, State> {

    public constructor(props: Props) {
        super(props);
        this.state = {
            allOrNothing: false,
            immediateOrCancel: false,
            fillOrKill: false,
            flipped: false,
        };

        this.props.actions.setAndUpdateValues(
            props.orderInputs, "price", new BigNumber(props.marketPrice).toFixed(), { blur: true },
        );
    }

    public async componentWillReceiveProps(nextProps: Props): Promise<void> {
        const { marketPrice } = this.props;

        // Update the market price if the market or market price has changed
        const marketPriceChanged = marketPrice !== nextProps.marketPrice;
        if (!nextProps.orderInputs.price || nextProps.orderInputs.price === "0" || marketPriceChanged) {
            this.props.actions.setAndUpdateValues(
                nextProps.orderInputs, "price", new BigNumber(nextProps.marketPrice).toFixed(), { blur: true },
            );
        }

        // Check if we should flip the toggle button
        const nextSend = nextProps.orderInputs.sendToken;
        const nextReceive = nextProps.orderInputs.receiveToken;
        const thisSend = this.props.orderInputs.sendToken;
        const thisReceive = this.props.orderInputs.receiveToken;
        if (nextSend === thisReceive && nextReceive === thisSend && nextSend !== nextReceive) {
            this.setState({ flipped: !this.state.flipped });
        } else if (nextSend !== thisSend || nextReceive !== thisReceive) {
            this.setState({ flipped: false });
        }
    }

    public render(): React.ReactNode {
        const { updating, orderInputs, quoteCurrency } = this.props;
        const { flipped } = this.state;

        const market = MarketPair.DAI_BTC;
        const pairDetails = MarketPairs.get(market);

        const btcTokenDetails = Tokens.get(Token.BTC) || UnknownToken;
        const amount = new BigNumber(0);

        const spendToken =  btcTokenDetails;
        const feeAmount = new BigNumber(0);

        const spendAmount = new BigNumber(0);

        const toggle = <div className="order--tabs">
            <span
                role="button"
                onClick={this.toggleSide}
            >
                <img alt="Swap side" role="button" className={flipped ? "flipped" : ""} src={arrow} />
            </span>
        </div>;

        const firstTitle = "Spend";
        let firstValue;
        let firstSubtext;
        let firstError;
        let firstOnChange;

        let secondValue;
        let secondSubtext;

        let extra;
        firstValue = orderInputs.sendVolume;
        firstSubtext = <>~ <CurrencyIcon currency={quoteCurrency} /></>;
        firstError = orderInputs.inputError !== null && orderInputs.inputError.category === "input";
        firstOnChange = this.onVolumeChange;

        secondValue = normalizeDecimals(orderInputs.receiveVolume);
        secondSubtext = <>
            {updating ? <Loading className="loading--small" /> : null}{" "}
            {pairDetails ? `1 ${pairDetails.base} = ${normalizeDecimals(orderInputs.price)} ${pairDetails.quote} ± 3%` : "\xa0"}
        </>;

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
            title={"Receive"}
            value={secondValue}
            subtext={secondSubtext}
            hint={"Based on market price."}
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
        const { advanced } = this.props;

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
        const { orderInputs } = this.props;
        this.props.actions.setAndUpdateValues(
            orderInputs, "sendVolume", newValue, { blur: options.blur },
        );
    }

    private readonly toggleSide = () => {
        const { orderInputs } = this.props;
        this.props.actions.swapTokens(orderInputs);
        // this.setState({ flipped: !this.state.flipped });
    }

    private readonly handleMoreOptions = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const { name, checked } = e.target;
        this.setState((oldState) => ({ ...oldState, [name]: checked, }));
    }
}

// tslint:enable:jsx-no-lambda

const mapStateToProps = (state: ApplicationData) => ({
    orderInputs: state.inputs,
    advanced: state.trader.advanced,
    quoteCurrency: state.trader.quoteCurrency,
    updating: state.marketPrices.updating,
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        setAndUpdateValues,
        swapTokens,
    }, dispatch)
});

interface Props extends ReturnType<typeof mapStateToProps>, ConnectedReturnType<typeof mapDispatchToProps> {
    marketPrice: number;
    handleChange: (inputValue: string | null) => void;
}

interface State {
    allOrNothing: boolean;
    immediateOrCancel: boolean;
    fillOrKill: boolean;
    flipped: boolean;
}

export const NewOrderInputs = connect(mapStateToProps, mapDispatchToProps)(NewOrderInputsClass);
