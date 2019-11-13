import { Currency } from "@renproject/react-components";
import { Chain } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { Map as ImmutableMap } from "immutable";
import Web3 from "web3";

import { getExchange, getReserve, Token, Tokens } from "../state/generalTypes";
import { ExchangeTabs, LiquidityTabs } from "../state/uiContainer";
import { syncGetDEXReserveAddress, syncGetTokenAddress } from "./contractAddresses";
import { removeRenVMFee } from "./estimatePrice";

export const calculateReceiveAmount = async (
    web3: Web3, networkID: number, exchangeTab: ExchangeTabs, liquidityTab: LiquidityTabs,
    { srcToken, dstToken, srcAmount }: { srcToken: Token, dstToken: Token, srcAmount: string },
    tokenPrices: ImmutableMap<Token, ImmutableMap<Currency, number>>, reserveBalances: ImmutableMap<Token, {
        quote: BigNumber;
        base: BigNumber;
    }>,
): Promise<BigNumber> => {
    const exchange = getExchange(web3, networkID);
    const srcTokenAddress = syncGetTokenAddress(networkID, srcToken);
    const dstTokenAddress = syncGetTokenAddress(networkID, dstToken);
    const srcTokenDetails = Tokens.get(srcToken) || { decimals: 18, chain: Chain.Ethereum };
    const dstTokenDetails = Tokens.get(dstToken) || { decimals: 18, chain: Chain.Ethereum };

    let dstAmountBN: BigNumber;

    let srcAmountBN = new BigNumber(srcAmount);

    if (exchangeTab === ExchangeTabs.Swap) {

        if (srcTokenDetails.chain !== Chain.Ethereum) {
            srcAmountBN = removeRenVMFee(srcAmountBN);
        }

        let srcAmountShifted = (srcAmountBN.times(new BigNumber(10).pow(srcTokenDetails.decimals))).decimalPlaces(0).toFixed();
        if (srcAmountShifted === "NaN") {
            srcAmountShifted = "0";
        }

        const dstAmount = await exchange.methods.calculateReceiveAmount(srcTokenAddress, dstTokenAddress, srcAmountShifted).call();

        let dstAmountShiftedBN = new BigNumber(dstAmount);
        if (dstTokenDetails.chain !== Chain.Ethereum) {
            dstAmountShiftedBN = removeRenVMFee(dstAmountShiftedBN);
        }

        dstAmountBN = (new BigNumber(dstAmountShiftedBN).div(new BigNumber(10).pow(dstTokenDetails.decimals)));
    } else if (exchangeTab === ExchangeTabs.Liquidity && liquidityTab === LiquidityTabs.Add) {
        const reserveAddress = syncGetDEXReserveAddress(networkID, srcToken);
        const reserve = getReserve(web3, networkID, reserveAddress);

        let srcAmountShifted = (srcAmountBN.times(new BigNumber(10).pow(srcTokenDetails.decimals)));
        if (srcAmountShifted.isNaN()) {
            srcAmountShifted = new BigNumber(0);
        }

        try {
            const dstAmountShiftedBN = new BigNumber(await reserve.methods.expectedBaseTokenAmount(srcAmountShifted.decimalPlaces(0).toFixed()).call());

            dstAmountBN = (new BigNumber(dstAmountShiftedBN).div(new BigNumber(10).pow(dstTokenDetails.decimals)));
            if (dstAmountBN.isNaN()) {
                // On Mainnet, an execution error results in a null result returned
                throw new Error("VM execution error");
            }
        } catch (error) {
            if (String(error.message || error).match(/VM execution error/)) {
                const srcTokenPrices = tokenPrices.get(srcToken);
                const dstTokenPrices = tokenPrices.get(dstToken);
                if (srcTokenPrices && dstTokenPrices) {
                    const srcTokenPrice = srcTokenPrices.get(Currency.USD) || 0;
                    const dstTokenPrice = dstTokenPrices.get(Currency.USD) || 0;
                    // console.log(`Using prices for ${srcToken}: $${srcTokenPrice} & ${dstToken}: $${dstTokenPrice}`);
                    dstAmountBN = srcAmountBN.times(srcTokenPrice).dividedBy(dstTokenPrice);
                } else {
                    dstAmountBN = new BigNumber(0);
                }

            } else {
                throw error;
            }
        }

        // Bump-it up in-case the amounts change while shifting.
        // Only the required amount will actually be transferred.
        dstAmountBN = dstAmountBN.times(1.05);
    } else if (exchangeTab === ExchangeTabs.Liquidity && liquidityTab === LiquidityTabs.Remove) {
        let srcAmountShifted = (srcAmountBN.times(new BigNumber(10).pow(srcTokenDetails.decimals))).decimalPlaces(0);
        if (srcAmountShifted.isNaN()) {
            srcAmountShifted = new BigNumber(0);
        }

        const reserveBalance = reserveBalances.get(srcToken);

        let dstAmountShiftedBN;
        if (!reserveBalance || reserveBalance.quote.isZero()) {
            dstAmountShiftedBN = new BigNumber(0);
        } else {
            dstAmountShiftedBN = srcAmountShifted.div(reserveBalance.quote).times(reserveBalance.base);
        }

        dstAmountBN = (dstAmountShiftedBN.div(new BigNumber(10).pow(dstTokenDetails.decimals)));
    } else {
        throw new Error("Unable to calculate expected receive amount - invalid page options");
    }
    return dstAmountBN;
};
