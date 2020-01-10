import * as React from "react";

import { CurrencyIcon, TokenValueInput } from "@renproject/react-components";
import BigNumber from "bignumber.js";

import { useDebounce } from "../../../lib/debounce";
import { _catchInteractionErr_ } from "../../../lib/errors";
import { connect, ConnectedProps } from "../../../state/connect";
import { UIContainer } from "../../../state/uiContainer";
import arrow from "../../../styles/images/arrow.svg";
import { ErrorBoundary } from "../../ErrorBoundary";
import { SelectMarketWrapper } from "../SelectMarketWrapper";
import { TokenBalance } from "../TokenBalance";

const normalizeDecimals = (inputIn: string | null): string | null => {
    return inputIn === null ? inputIn : new BigNumber(inputIn).decimalPlaces(8).toFixed();
};

interface Props {
    marketPrice: number;
}

export const OrderFormInputs = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer], }) => {

        const { orderInputs, preferredCurrency: quoteCurrency, tokenPrices } = uiContainer.state;

        // Store `srcAmount` as state so we can debounce storing it in the
        // container
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
                uiContainer.updateSrcAmount(srcAmountState).catch(error => _catchInteractionErr_(error, "Error in OrderFormInputs: updateSrcAmount"));
                setTimeout(() => {
                    uiContainer.updateSrcAmount(srcAmountState).catch(error => _catchInteractionErr_(error, "Error in OrderFormInputs: updateSrcAmount (setTimeout)"));
                }, 1500);
            }
        }, [setInitialized, initialized, srcAmountState, uiContainer]);

        React.useEffect(
            () => {
                uiContainer.updateSrcAmount(debouncedSrcAmountState).catch(error => _catchInteractionErr_(error, "Error in OrderFormInputs: updateSrcAmount (debounced)"));
            },
            [debouncedSrcAmountState, uiContainer]
        );

        const onVolumeChange = React.useCallback((value: string, options: { blur: boolean }) => {
            // If the value is in scientific notation, fix it
            if (value.toLowerCase().indexOf("e") !== -1) {
                value = new BigNumber(value).toFixed();
            }

            setSrcAmountState(value);

            if (oldSrcAmount) {
                setOldSrcAmount(undefined);
            }
        }, [oldSrcAmount]);

        const toggleSide = React.useCallback(async () => {
            await uiContainer.flipSendReceive();

            // Flip the amounts, but if we flip twice in a row, use the original
            // srcAmount instead of calculating a new one
            // Without: src = 1 [flip] src = 0.01 [flip] src = 0.99
            // & with: src = 1 [flip] src = 0.01 [flip] src = 1
            const amount = oldSrcAmount !== undefined ? oldSrcAmount : new BigNumber(orderInputs.dstAmount).decimalPlaces(8).toFixed();
            setSrcAmountState(amount);
            uiContainer.updateSrcAmount(amount).catch(error => _catchInteractionErr_(error, "Error in OrderFormInputs: updateSrcAmount (toggleSide)"));
            if (oldSrcAmount === undefined) {
                setOldSrcAmount(srcAmountState);
            } else {
                setOldSrcAmount(undefined);
            }
        }, [uiContainer, oldSrcAmount, srcAmountState]);

        const toggle = <div className="order--tabs">
            <span
                role="button"
                onClick={toggleSide}
            >
                <img alt="Swap side" role="button" src={arrow} />
            </span>
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

        const first = <ErrorBoundary id="OrderFormInputs.tsx > TokenValueInput first"><TokenValueInput
            title={"Spend"}
            value={srcAmountState}
            subtext={firstSubtext}
            hint={null}
            error={false}
            onValueChange={onVolumeChange}
        >
            <SelectMarketWrapper top={true} thisToken={orderInputs.srcToken} otherToken={orderInputs.dstToken} />
        </TokenValueInput ></ErrorBoundary>;

        const second = <ErrorBoundary id="OrderFormInputs.tsx > TokenValueInput second"><TokenValueInput
            title={"Receive"}
            value={normalizeDecimals(orderInputs.dstAmount)}
            subtext={<></>}
            hint={"Based on market price, after transfer and RenVM fees."}
            error={false}
            onValueChange={null}
            className="order-inputs--second"
        >
            <SelectMarketWrapper top={false} thisToken={orderInputs.dstToken} otherToken={orderInputs.srcToken} />
        </TokenValueInput></ErrorBoundary>;

        return <div className="order--wrapper--wrapper">
            <div className="order--wrapper">
                {first}{toggle}{second}
            </div>
        </div>;
    }
);
