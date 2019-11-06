import * as React from "react";

import { CurrencyIcon, TokenValueInput } from "@renproject/react-components";
import BigNumber from "bignumber.js";

import { useDebounce } from "../../../lib/debounce";
import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../../lib/errors";
import { connect, ConnectedProps } from "../../../state/connect";
import { Tokens } from "../../../state/generalTypes";
import { SDKContainer } from "../../../state/sdkContainer";
import { LiquidityTabs, UIContainer } from "../../../state/uiContainer";
import { SelectMarketWrapper } from "../SelectMarketWrapper";
import { TokenBalance } from "../TokenBalance";

const normalizeDecimals = (inputIn: string | null): string | null => {
    return inputIn === null ? inputIn : new BigNumber(inputIn).decimalPlaces(8).toFixed();
};

interface Props {
    marketPrice: number;
}

export const LiquidityFormInputs = connect<Props & ConnectedProps<[UIContainer, SDKContainer]>>([UIContainer, SDKContainer])(
    ({ containers: [uiContainer, sdkContainer], }) => {

        // Store `srcAmount` as state so we can debounce storing it in the
        // container
        const [liquidityBalance, setLiquidityBalance] = React.useState<BigNumber | null>(null);
        const [srcAmountState, setSrcAmountState] = React.useState(uiContainer.state.orderInputs.srcAmount);
        const debouncedSrcAmountState = useDebounce(srcAmountState, 250);
        // See `toggleSide`
        const [oldSrcAmount, setOldSrcAmount] = React.useState<string | undefined>(undefined);

        const liquidityTab = uiContainer.state.liquidityTab;
        const quoteCurrency = uiContainer.state.preferredCurrency;
        const orderInputs = uiContainer.state.orderInputs;

        // Calculate the receive amount on load in case the srcAmount was stored
        // in local storage.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {
                setInitialized(true);
                uiContainer.updateSrcAmount(srcAmountState).catch(_catchInteractionErr_);
                setTimeout(() => {
                    uiContainer.updateSrcAmount(srcAmountState).catch(_catchInteractionErr_);
                }, 1500);
            }
        }, [setInitialized, initialized, srcAmountState, uiContainer]);

        React.useEffect(
            () => {
                uiContainer.updateSrcAmount(debouncedSrcAmountState).catch(_catchInteractionErr_);
            },
            [debouncedSrcAmountState]
        );

        const onVolumeChange = (value: string, options: { blur: boolean }) => {
            // If the value is in scientific notation, fix it
            if (value.toLowerCase().indexOf("e") !== -1) {
                value = new BigNumber(value).toFixed();
            }

            setSrcAmountState(value);

            if (oldSrcAmount) {
                setOldSrcAmount(undefined);
            }
        };

        const toggle = <div className="order--tabs">
            {liquidityTab === LiquidityTabs.Add ? <span>+</span> : <span className="order--tabs--minus">-</span>}
            {/* <img alt="Swap side" role="button" src={arrow} /> */}
        </div>;

        const firstSubtext = <>
            {"~ "}
            <CurrencyIcon currency={quoteCurrency} />
            {" "}
            <TokenBalance
                token={orderInputs.srcToken}
                convertTo={quoteCurrency}
                tokenPrices={uiContainer.state.tokenPrices}
                amount={orderInputs.srcAmount || "0"}
            />
        </>;

        const first = <TokenValueInput
            title={"Spend"}
            value={srcAmountState}
            subtext={firstSubtext}
            hint={null}
            error={false}
            onValueChange={onVolumeChange}
        >
            <SelectMarketWrapper top={true} thisToken={orderInputs.srcToken} otherToken={orderInputs.dstToken} />
        </TokenValueInput >;

        const second = <TokenValueInput
            title={"Receive"}
            value={normalizeDecimals(orderInputs.dstAmount)}
            subtext={<></>}
            hint={"Based on market price, after transfer and RenVM fees."}
            error={false}
            onValueChange={null}
            className="order-inputs--second"
        >
            <SelectMarketWrapper top={false} thisToken={orderInputs.dstToken} otherToken={orderInputs.srcToken} locked={true} />
        </TokenValueInput>;

        React.useEffect(() => {
            (async () => {
                const liquidity = await sdkContainer.liquidityBalance(orderInputs.srcToken);
                if (liquidity) {
                    setLiquidityBalance(liquidity);
                }
            })().catch(_catchBackgroundErr_);
        }, [uiContainer.state.web3, uiContainer.state.address, orderInputs.srcToken]);

        const selectAddTab = React.useCallback(() => {
            uiContainer.setLiquidityTab(LiquidityTabs.Add).catch(_catchInteractionErr_);
        }, [uiContainer]);

        const selectRemoveTab = React.useCallback(() => {
            uiContainer.setLiquidityTab(LiquidityTabs.Remove).catch(_catchInteractionErr_);
        }, [uiContainer]);

        const srcTokenDetails = Tokens.get(orderInputs.srcToken);

        return <div className="order--wrapper--wrapper">
            <div className="order--wrapper">
                <div className="liquidity--options">
                    <span role="tab" onClick={selectAddTab} className={["liquidity--option", liquidityTab === LiquidityTabs.Add ? "liquidity--option--selected" : ""].join(" ")}>Add liquidity</span>
                    <span role="tab" onClick={selectRemoveTab} className={["liquidity--option", liquidityTab === LiquidityTabs.Remove ? "liquidity--option--selected" : ""].join(" ")}>Remove liquidity</span>
                </div>
                {first}{toggle}{second}
                <div className="liquidity-details">
                    <div className="liquidity-detail"><span>Exchange rate</span><span>-</span></div>
                    <div className="liquidity-detail"><span>Current pool size</span><span>-</span></div>
                    <div className="liquidity-detail"><span>Your pool share</span><span>
                        <CurrencyIcon currency={quoteCurrency} />
                        {" "}
                        {liquidityBalance === null ?
                            "-" :
                            <TokenBalance
                                token={orderInputs.srcToken}
                                convertTo={quoteCurrency}
                                tokenPrices={uiContainer.state.tokenPrices}
                                amount={liquidityBalance || "0"}
                                toReadable={true}
                                decimals={srcTokenDetails ? srcTokenDetails.decimals : 0}
                            />
                        }
                    </span></div>
                </div>
            </div>
        </div>;
    }
);
