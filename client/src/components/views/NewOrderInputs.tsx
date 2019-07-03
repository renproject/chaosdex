import * as React from "react";

import { CurrencyIcon, TokenValueInput } from "@renex/react-components";
import BigNumber from "bignumber.js";
import { debounce } from "throttle-debounce";

import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { UIContainer } from "../../state/uiContainer";
import arrow from "../../styles/images/arrow.svg";
import { SelectMarketWrapper } from "./SelectMarketWrapper";
import { TokenBalance } from "./TokenBalance";

const normalizeDecimals = (inputIn: string | null): string | null => {
    return inputIn === null ? inputIn : new BigNumber(inputIn).decimalPlaces(8).toFixed();
};

interface Props {
    marketPrice: number;
}

export const NewOrderInputs = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer], }) => {

        const [srcAmountState, setSrcAmountState] = React.useState(uiContainer.state.orderInputs.srcAmount);

        /**
         * Waits 100ms to update the send volume in case the user is still typing
         */
        const debouncedVolumeChange = async (value: string) =>
            debounce(100, false, async () =>
                uiContainer.updateSrcAmount(value).catch(_catchInteractionErr_)
            )();

        const onVolumeChange = (value: string, options: { blur: boolean }) => {
            // If the value is in scientific notation, fix it
            if (value.toLowerCase().indexOf("e") !== -1) {
                value = new BigNumber(value).toFixed();
            }

            setSrcAmountState(value);
            // tslint:disable-next-line: no-floating-promises
            debouncedVolumeChange(value);
        };

        const toggleSide = async () => {
            await uiContainer.flipSendReceive();
        };

        const toggle = <div className="order--tabs">
            <span
                role="button"
                onClick={toggleSide}
            >
                <img alt="Swap side" role="button" src={arrow} />
            </span>
        </div>;

        const quoteCurrency = uiContainer.state.preferredCurrency;
        const orderInputs = uiContainer.state.orderInputs;

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
            onChange={onVolumeChange}
        >
            <SelectMarketWrapper top={true} thisToken={orderInputs.srcToken} otherToken={orderInputs.dstToken} />
        </TokenValueInput >;

        const second = <TokenValueInput
            title={"Receive"}
            value={normalizeDecimals(orderInputs.dstAmount)}
            subtext={<></>}
            hint={"Based on market price."}
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
);
