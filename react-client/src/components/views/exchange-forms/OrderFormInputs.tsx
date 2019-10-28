import * as React from "react";

import { CurrencyIcon, TokenValueInput } from "@renproject/react-components";
import BigNumber from "bignumber.js";

import { useDebounce } from "../../../lib/debounce";
import { _catchInteractionErr_ } from "../../../lib/errors";
import { connect, ConnectedProps } from "../../../state/connect";
import { UIContainer } from "../../../state/uiContainer";
import arrow from "../../../styles/images/arrow.svg";
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

        // Store `srcAmount` as state so we can debounce storing it in the
        // container
        const [srcAmountState, setSrcAmountState] = React.useState(uiContainer.state.orderInputs.srcAmount);
        const debouncedSrcAmountState = useDebounce(srcAmountState, 250);
        // See `toggleSide`
        const [oldSrcAmount, setOldSrcAmount] = React.useState<string | undefined>(undefined);

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

        const toggleSide = async () => {
            await uiContainer.flipSendReceive();

            // Flip the amounts, but if we flip twice in a row, use the original
            // srcAmount instead of calculating a new one
            // Wihout: src = 1 [flip] src = 0.01 [flip] src = 0.99
            // & with: src = 1 [flip] src = 0.01 [flip] src = 1
            const amount = oldSrcAmount !== undefined ? oldSrcAmount : new BigNumber(orderInputs.dstAmount).decimalPlaces(8).toFixed();
            setSrcAmountState(amount);
            uiContainer.updateSrcAmount(amount).catch(_catchInteractionErr_);
            if (oldSrcAmount === undefined) {
                setOldSrcAmount(srcAmountState);
            } else {
                setOldSrcAmount(undefined);
            }
        };

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
            <SelectMarketWrapper top={false} thisToken={orderInputs.dstToken} otherToken={orderInputs.srcToken} />
        </TokenValueInput>;

        return <div className="order--wrapper--wrapper">
            <div className="order--wrapper">
                {first}{toggle}{second}
            </div>
        </div>;
    }
);
