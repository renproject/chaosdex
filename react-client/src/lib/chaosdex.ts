import { Currency } from "@renproject/react-components";
import { Chain, NetworkDetails } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { Map as ImmutableMap } from "immutable";
import Web3 from "web3";

import { getERC20, getExchange, getReserve, Token, Tokens } from "../state/generalTypes";
import { ExchangeTabs, LiquidityTabs } from "../state/uiContainer";
import { syncGetDEXReserveAddress, syncGetTokenAddress } from "./contractAddresses";
import { removeRenVMFee } from "./estimatePrice";

export const fetchEthereumTokenBalance = async (web3: Web3, networkID: number, networkDetails: NetworkDetails, token: Token, address: string): Promise<BigNumber> => {
    if (!web3) {
        return new BigNumber(0);
    }
    let balance: string;
    if (token === Token.ETH) {
        balance = await web3.eth.getBalance(address);
    } else {
        // if (isERC20(token)) {
        const tokenAddress = syncGetTokenAddress(networkID, token);
        const tokenInstance = getERC20(web3, networkDetails, tokenAddress);
        const balanceBN = await tokenInstance.methods.balanceOf(address).call();
        if (balanceBN === null) {
            throw new Error(`balanceOf returned back 'null'`);
        }
        balance = balanceBN.toString();
        // } else {
        //     throw new Error(`Invalid Ethereum token: ${token}`);
    }
    return new BigNumber(balance);
};

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
        if (dstAmount === null) {
            throw new Error(`calculateReceiveAmount returned back 'null'`);
        }

        let dstAmountShiftedBN = new BigNumber(dstAmount.toString());
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
            const dstAmountShiftedCall = await reserve.methods.expectedBaseTokenAmount(srcAmountShifted.decimalPlaces(0).toFixed()).call();
            if (dstAmountShiftedCall === null) {
                throw new Error(`expectedBaseTokenAmount returned back 'null'`);
            }
            const dstAmountShiftedBN = new BigNumber(dstAmountShiftedCall.toString());

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

export const getBalances = async (web3: Web3, networkID: number, networkDetails: NetworkDetails, tokens: Token[], address: string) => {
    const promises = tokens.map(async token => {
        try {
            return await fetchEthereumTokenBalance(web3, networkID, networkDetails, token, address);
        } catch (error) {
            console.error(error);
            return new BigNumber(0);
        }
    });
    const balances = await Promise.all(promises);
    let accountBalances = ImmutableMap<Token, BigNumber>();
    balances.forEach((bal, index) => {
        accountBalances = accountBalances.set(tokens[index], bal);
    });
    return accountBalances;
};

export const getLiquidityBalances = async (web3: Web3, networkID: number, networkDetails: NetworkDetails, tokens: Token[], address: string) => {
    const liquidityBalancesAwaited = await Promise.all(tokens.map(async token => {
        const reserveAddress = syncGetDEXReserveAddress(networkID, token);
        const tokenInstance = getERC20(web3, networkDetails, reserveAddress);
        try {
            return new BigNumber(((await tokenInstance.methods.balanceOf(address).call()) || "0").toString());
        } catch (error) {
            console.error(error);
            return new BigNumber(0);
        }
    }));
    let liquidityBalances = ImmutableMap<Token, BigNumber>();
    liquidityBalancesAwaited.forEach((bal, index) => {
        liquidityBalances = liquidityBalances.set(tokens[index], bal);
    });
    return liquidityBalances;
};

export const getReserveTotalSupply = async (web3: Web3, networkID: number, networkDetails: NetworkDetails, tokens: Token[]) => {
    // Reserves total supply
    const reserveTotalSupplyAwaited = await Promise.all(tokens.map(async token => {
        const reserveAddress = syncGetDEXReserveAddress(networkID, token);
        const tokenInstance = getERC20(web3, networkDetails, reserveAddress);
        try {
            return new BigNumber(((await tokenInstance.methods.totalSupply().call()) || "0").toString());
        } catch (error) {
            console.error(error);
            return new BigNumber(0);
        }
    }));
    let reserveTotalSupply = ImmutableMap<Token, BigNumber>();
    reserveTotalSupplyAwaited.forEach((bal, index) => {
        reserveTotalSupply = reserveTotalSupply.set(tokens[index], bal);
    });
    return reserveTotalSupply;
};

export const getReserveBalances = async (web3: Web3, networkID: number, networkDetails: NetworkDetails, tokens: Token[]) => {
    const reserveBalancesAwaited = await Promise.all(tokens.map(async token => {
        const reserveAddress = syncGetDEXReserveAddress(networkID, token);
        let base = new BigNumber(0);
        let quote = new BigNumber(0);
        try {
            base = await fetchEthereumTokenBalance(web3, networkID, networkDetails, Token.DAI, reserveAddress);
        } catch (error) {
            console.error(error);
        }
        try {
            quote = await fetchEthereumTokenBalance(web3, networkID, networkDetails, token, reserveAddress);
        } catch (error) {
            console.error(error);
        }
        return { base, quote };
    }));
    let reserveBalances = ImmutableMap<Token, { base: BigNumber, quote: BigNumber }>();
    reserveBalancesAwaited.forEach((bal, index) => {
        reserveBalances = reserveBalances.set(tokens[index], bal);
    });
    return reserveBalances;
};
