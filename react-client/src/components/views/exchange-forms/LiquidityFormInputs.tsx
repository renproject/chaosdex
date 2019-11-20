import * as React from "react";

import { CurrencyIcon, TokenValueInput } from "@renproject/react-components";
import BigNumber from "bignumber.js";

import { useDebounce } from "../../../lib/debounce";
import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../../lib/errors";
import { connect, ConnectedProps } from "../../../state/connect";
import { Token, Tokens } from "../../../state/generalTypes";
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

        const {
            web3, address, orderInputs, liquidityTab,
            preferredCurrency: quoteCurrency, tokenPrices, reserveBalances,
        } = uiContainer.state;

        // Store `srcAmount` as state so we can debounce storing it in the
        // container
        const [liquidityBalance, setLiquidityBalance] = React.useState<BigNumber | null>(null);
        const [srcAmountState, setSrcAmountState] = React.useState(orderInputs.srcAmount);
        const debouncedSrcAmountState = useDebounce(srcAmountState, 250);
        // See `toggleSide`
        const [oldSrcAmount, setOldSrcAmount] = React.useState<string | undefined>(undefined);

        // Calculate the receive amount on load in case the srcAmount was stored
        // in local storage.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {
                setInitialized(true);
                uiContainer.updateSrcAmount(srcAmountState).catch(error => _catchInteractionErr_(error, "Error in LiquidityFormInputs: updateSrcAmount"));
                setTimeout(() => {
                    uiContainer.updateSrcAmount(srcAmountState).catch(error => _catchInteractionErr_(error, "Error in LiquidityFormInputs: updateSrcAmount (setTimeout)"));
                }, 1500);
            }
        }, [setInitialized, initialized, srcAmountState, uiContainer]);

        React.useEffect(
            () => {
                uiContainer.updateSrcAmount(debouncedSrcAmountState).catch(error => _catchInteractionErr_(error, "Error in LiquidityFormInputs: updateSrcAmount (debounced)"));
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
                tokenPrices={tokenPrices}
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
            <SelectMarketWrapper except={orderInputs.dstToken} top={true} thisToken={orderInputs.srcToken} otherToken={orderInputs.dstToken} />
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

        const selectAddTab = React.useCallback(() => {
            uiContainer.setLiquidityTab(LiquidityTabs.Add).catch(error => _catchInteractionErr_(error, "Error in LiquidityFormInputs: setLiquidityTab, Add"));
        }, [uiContainer]);

        const selectRemoveTab = React.useCallback(() => {
            uiContainer.setLiquidityTab(LiquidityTabs.Remove).catch(error => _catchInteractionErr_(error, "Error in LiquidityFormInputs: setLiquidityTab, Remove"));
        }, [uiContainer]);

        const srcTokenDetails = Tokens.get(orderInputs.srcToken);
        const dstTokenDetails = Tokens.get(orderInputs.dstToken);

        const quoteReserveBalances = React.useMemo(
            () => reserveBalances.get(orderInputs.srcToken, { quote: new BigNumber(0), base: new BigNumber(0) }),
            [reserveBalances, orderInputs.srcToken],
        );

        const exchangeRate = React.useMemo(() => {
            try {
                return quoteReserveBalances.base.div(new BigNumber(10).exponentiatedBy(dstTokenDetails ? dstTokenDetails.decimals : 0)).div(quoteReserveBalances.quote.div(new BigNumber(10).exponentiatedBy(srcTokenDetails ? srcTokenDetails.decimals : 0)));
            } catch (error) {
                return new BigNumber(0);
            }
        }, [quoteReserveBalances.base, quoteReserveBalances.quote, dstTokenDetails, srcTokenDetails]);

        React.useEffect(() => {
            (async () => {
                const liquidity = await sdkContainer.liquidityBalance(orderInputs.srcToken);
                if (liquidity) {
                    setLiquidityBalance(liquidity);
                }
            })().catch(error => _catchBackgroundErr_(error, "Error in LiquidityFormInputs: setLiquidityBalance"));
        }, [web3, address, sdkContainer, orderInputs.srcToken, quoteReserveBalances.base, quoteReserveBalances.quote]);

        return <div className="order--wrapper--wrapper">
            <div className="order--wrapper">
                <div className="liquidity--options">
                    <span role="tab" onClick={selectAddTab} className={["liquidity--option", liquidityTab === LiquidityTabs.Add ? "liquidity--option--selected" : ""].join(" ")}>Add liquidity</span>
                    <span role="tab" onClick={selectRemoveTab} className={["liquidity--option", liquidityTab === LiquidityTabs.Remove ? "liquidity--option--selected" : ""].join(" ")}>Remove liquidity</span>
                </div>
                {first}{toggle}{second}
                <div className="liquidity-details">
                    <div className="liquidity-detail"><span>Exchange rate</span><span>
                        <CurrencyIcon currency={quoteCurrency} />
                        {" "}
                        {!quoteReserveBalances ?
                            "-" :
                            <TokenBalance
                                token={Token.DAI}
                                convertTo={quoteCurrency}
                                tokenPrices={tokenPrices}
                                amount={exchangeRate || "0"}
                                digits={3}
                            />
                        }
                    </span></div>
                    <div className="liquidity-detail"><span>{orderInputs.srcToken} pool size</span><span>
                        {!quoteReserveBalances ?
                            "-" :
                            <TokenBalance
                                token={orderInputs.srcToken}
                                amount={quoteReserveBalances.quote || "0"}
                                toReadable={true}
                                decimals={srcTokenDetails ? srcTokenDetails.decimals : 0}
                            />
                        }
                        {" "}
                        {orderInputs.srcToken}
                        {" ("}
                        <CurrencyIcon currency={quoteCurrency} />
                        {" "}
                        {!quoteReserveBalances ?
                            "-" :
                            <TokenBalance
                                token={orderInputs.srcToken}
                                convertTo={quoteCurrency}
                                tokenPrices={tokenPrices}
                                amount={quoteReserveBalances.quote || "0"}
                                toReadable={true}
                                decimals={srcTokenDetails ? srcTokenDetails.decimals : 0}
                            />
                        }
                        {")"}
                    </span></div>
                    <div className="liquidity-detail"><span>{orderInputs.dstToken} pool size</span><span>
                        {!quoteReserveBalances ?
                            "-" :
                            <TokenBalance
                                token={orderInputs.dstToken}
                                amount={quoteReserveBalances.base || "0"}
                                toReadable={true}
                                decimals={dstTokenDetails ? dstTokenDetails.decimals : 0}
                                digits={2}
                            />
                        }
                        {" "}{orderInputs.dstToken}
                        {" ("}
                        <CurrencyIcon currency={quoteCurrency} />
                        {" "}
                        {!quoteReserveBalances ?
                            "-" :
                            <TokenBalance
                                token={orderInputs.dstToken}
                                convertTo={quoteCurrency}
                                tokenPrices={tokenPrices}
                                amount={quoteReserveBalances.base || "0"}
                                toReadable={true}
                                decimals={dstTokenDetails ? dstTokenDetails.decimals : 0}
                            />
                        }
                        {")"}
                    </span></div>
                    <div className="liquidity-detail"><span>Your pool share</span><span>
                        <CurrencyIcon currency={quoteCurrency} />
                        {" "}
                        {liquidityBalance === null ?
                            "-" :
                            <TokenBalance
                                token={orderInputs.srcToken}
                                convertTo={quoteCurrency}
                                tokenPrices={tokenPrices}
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
