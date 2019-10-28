import { Currency } from "@renproject/react-components";
import RenSDK, { btcAddressToHex, Chain, zecAddressToHex } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { Map as ImmutableMap } from "immutable";
import { Container } from "unstated";
import Web3 from "web3";

import { syncGetTokenAddress } from "../lib/contractAddresses";
import { removeRenVMFee } from "../lib/estimatePrice";
import { history } from "../lib/history";
import { getMarket, getTokenPricesInCurrencies } from "../lib/market";
import {
    getERC20, getExchange, getReserve, isERC20, isEthereumBased, MarketPair, Token, Tokens,
} from "./generalTypes";
import {
    Commitment, CommitmentType, HistoryEvent, PersistentContainer, ShiftInStatus, ShiftOutStatus,
} from "./persistentContainer";
import { network } from "./sdkContainer";

export type ReserveBalances = Map<Token, BigNumber>;

export interface OrderInputs {
    srcToken: Token;
    dstToken: Token;
    srcAmount: string;
    dstAmount: string;
}

const initialOrder: OrderInputs = {
    srcToken: Token.BTC,
    dstToken: Token.DAI,
    srcAmount: "0.000225",
    dstAmount: "0",
};

export enum ExchangeTabs {
    Swap,
    Liquidity,
}

const initialState = {
    web3: null as Web3 | null,
    networkID: 0,

    confirmedOrderInputs: null as null | OrderInputs,

    preferredCurrency: Currency.USD,

    exchangeTab: ExchangeTabs.Swap,

    address: null as string | null,
    tokenPrices: ImmutableMap<Token, ImmutableMap<Currency, number>>(),
    accountBalances: ImmutableMap<Token, BigNumber>(),
    // balanceReserves: ImmutableMap<MarketPair, ReserveBalances>(),

    confirmedTrade: false,
    submitting: false,
    commitmentType: CommitmentType.Trade,
    toAddress: null as string | null,
    refundAddress: null as string | null,

    orderInputs: initialOrder,
    currentOrderID: null as string | null,

    network,
};

export class UIContainer extends Container<typeof initialState> {
    public state = initialState;
    public persistentContainer: PersistentContainer;

    constructor(persistentContainer: PersistentContainer) {
        super();
        this.persistentContainer = persistentContainer;
    }

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        await this.setState({ web3, networkID, address });
        await this.updateAccountBalances();
    }

    public clearAddress = async (): Promise<void> => {
        await this.setState({ address: null });
    }

    public onConfirmedTrade = async () => {
        await this.setState({ confirmedTrade: true });
    }

    public handleOrder = async (orderID: string | null) => {
        await this.setState({ submitting: false, currentOrderID: orderID });
    }

    public setExchangeTab = async (exchangeTab: ExchangeTabs) => {
        await this.setState({ exchangeTab });
    }

    // Token prices ////////////////////////////////////////////////////////////

    public setCurrency = async (preferredCurrency: Currency) => {
        await this.setState({ preferredCurrency });
    }

    public updateTokenPrices = async (): Promise<void> => {
        const tokenPrices = await getTokenPricesInCurrencies();
        await this.setState({ tokenPrices });
    }

    // public updateBalanceReserves = async (): Promise<void> => {
    //     const { balanceReserves } = this.state;

    //     let newBalanceReserves = balanceReserves;
    //     // const marketPairs = [MarketPair.DAI_BTC, MarketPair.ETH_BTC, MarketPair.REN_BTC, MarketPair.ZEC_BTC];
    //     const marketPairs = [MarketPair.DAI_BTC, MarketPair.DAI_ZEC];
    //     const res = await this.getReserveBalance(marketPairs); // Promise<Array<Map<Token, BigNumber>>> => {
    //     marketPairs.forEach((value, index) => {
    //         newBalanceReserves = newBalanceReserves.set(value, res[index]);
    //     });
    //     await this.setState({ balanceReserves: newBalanceReserves });
    //     await this.updateReceiveValue();
    // }

    public fetchEthereumTokenBalance = async (token: Token, address: string): Promise<BigNumber> => {
        const { web3, networkID, network } = this.state;
        if (!web3) {
            throw new Error("Web3 not set yet.");
        }
        let balance: string;
        if (token === Token.ETH) {
            balance = await web3.eth.getBalance(address);
        } else if (isERC20(token)) {
            const tokenAddress = syncGetTokenAddress(networkID, token);
            const tokenInstance = getERC20(web3, network, tokenAddress);
            balance = (await tokenInstance.methods.balanceOf(address).call()).toString();
        } else {
            throw new Error(`Invalid Ethereum token: ${token}`);
        }
        return new BigNumber(balance);
    }

    public updateAccountBalances = async (): Promise<void> => {
        const { address, network } = this.state;
        if (!address) {
            return;
        }
        let accountBalances = this.state.accountBalances;
        const ethTokens = [Token.ETH, Token.DAI]; // , Token.REN];
        const promises = ethTokens.map(token => this.fetchEthereumTokenBalance(token, address));
        const balances = await Promise.all(promises);
        balances.forEach((bal, index) => {
            accountBalances = accountBalances.set(ethTokens[index], bal);
        });

        await this.setState({ accountBalances, network });
    }

    /**
     * getPrice returns the rate at which dstToken can be received per srcToken.
     * @param srcToken The source token being spent
     * @param dstToken The destination token being received
     */
    // public getReserveBalance = async (marketPairs: MarketPair[]): Promise<ReserveBalances[]> => {
    //     const { web3, networkID, network } = this.state;
    //     if (!web3) {
    //         throw new Error("Web3 not set yet.");
    //     }
    //     const exchange = getExchange(web3, networkID);

    //     const balance = async (token: Token, reserve: string): Promise<BigNumber> => {
    //         if (token === Token.ETH) {
    //             return new BigNumber((await web3.eth.getBalance(reserve)).toString());
    //         }
    //         const tokenAddress = syncGetTokenAddress(networkID, token);
    //         const tokenInstance = getERC20(web3, network, tokenAddress);
    //         const decimals = getTokenDecimals(token);
    //         const rawBalance = new BigNumber((await tokenInstance.methods.balanceOf(reserve).call()).toString());
    //         return rawBalance.dividedBy(new BigNumber(10).exponentiatedBy(decimals));
    //     };

    //     return Promise.all(
    //         marketPairs.map(async (_marketPair) => {
    //             const [left, right] = _marketPair.split("/") as [Token, Token];
    //             const leftAddress = syncGetTokenAddress(networkID, left);
    //             const rightAddress = syncGetTokenAddress(networkID, right);
    //             const reserve = await exchange.methods.reserve(leftAddress, rightAddress).call();
    //             const leftBalance = await balance(left, reserve);
    //             const rightBalance = await balance(right, reserve);
    //             // console.debug(`${_marketPair} reserve: ${leftBalance.toFixed()} ${left}, ${rightBalance.toFixed()} ${right} (${reserve})`);
    //             return new Map().set(left, leftBalance).set(right, rightBalance);
    //         })
    //     );
    // }

    // Inputs for swap /////////////////////////////////////////////////////////

    public updateSrcToken = async (srcToken: Token): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, srcToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateDstToken = async (dstToken: Token): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, dstToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateSrcAmount = async (srcAmount: string): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, srcAmount } });
        await this.updateReceiveValue();
    }

    public flipSendReceive = async (): Promise<void> => {
        const { orderInputs: { srcToken, dstToken } } = this.state;
        await this.updateBothTokens(dstToken, srcToken);
    }

    public updateBothTokens = async (srcToken: Token, dstToken: Token): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, srcToken, dstToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateCommitmentType = async (commitmentType: CommitmentType) => {
        await this.setState({ commitmentType });
    }
    public updateToAddress = async (toAddress: string) => {
        await this.setState({ toAddress });
    }
    public updateRefundAddress = async (refundAddress: string) => {
        await this.setState({ refundAddress });
    }

    public commitOrder = async (): Promise<void> => {
        const { orderInputs: order, networkID, web3, commitmentType, toAddress, refundAddress, orderInputs } = this.state;
        if (!web3) {
            throw new Error("Web3 not set yet.");
        }

        const srcTokenDetails = Tokens.get(order.srcToken);
        const dstTokenDetails = Tokens.get(order.dstToken);
        if (!refundAddress || !srcTokenDetails || !dstTokenDetails || !toAddress) {
            throw new Error(`Required info is undefined (${toAddress}, ${refundAddress}, ${srcTokenDetails})`);
        }

        const blockNumber = await web3.eth.getBlockNumber();
        let hexRefundAddress = refundAddress;
        if (order.srcToken === Token.BTC) {
            hexRefundAddress = btcAddressToHex(refundAddress);
        } else if (order.srcToken === Token.ZEC) {
            hexRefundAddress = zecAddressToHex(refundAddress);
        }
        let hexToAddress = toAddress;
        if (order.dstToken === Token.BTC) {
            hexToAddress = btcAddressToHex(toAddress);
        } else if (order.dstToken === Token.ZEC) {
            hexToAddress = zecAddressToHex(toAddress);
        }

        let commitment: Commitment;

        switch (commitmentType) {
            case CommitmentType.Trade:

                commitment = {
                    type: commitmentType,
                    srcToken: syncGetTokenAddress(networkID, order.srcToken),
                    dstToken: syncGetTokenAddress(networkID, order.dstToken),
                    minDestinationAmount: 0,
                    srcAmount: new BigNumber(order.srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals)).toNumber(),
                    toAddress: hexToAddress,
                    refundBlockNumber: blockNumber + 360 * 48, // assuming 0.1bps 360 blocks is about 1 hour
                    refundAddress: hexRefundAddress,
                };
                break;
            case CommitmentType.AddLiquidity:
                commitment = {
                    type: commitmentType,
                    liquidityProvider: hexToAddress,
                    maxDAIAmount: new BigNumber(order.dstAmount).multipliedBy(new BigNumber(10).exponentiatedBy(dstTokenDetails.decimals)).decimalPlaces(0).toFixed(),
                    token: syncGetTokenAddress(networkID, order.srcToken),
                    amount: new BigNumber(order.srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals)).toNumber(),
                    refundBlockNumber: blockNumber + 360 * 48, // assuming 0.1bps 360 blocks is about 1 hour
                    refundAddress: hexRefundAddress,
                };
                break;
            default:
                throw new Error(`Unknown commitment type`);
        }

        const time = Date.now() / 1000;
        const currentOrderID = String(time);

        const shift = !isEthereumBased(orderInputs.srcToken) && isEthereumBased(orderInputs.dstToken) ? {
            // Cast required by TS to differentiate ShiftIn and ShiftOut types.
            shiftIn: true as true,
            status: ShiftInStatus.Committed,
        } : {
                shiftIn: false as false,
                status: ShiftOutStatus.Committed,
            };

        const nonce = RenSDK.randomNonce();

        const historyEvent: HistoryEvent = {
            ...shift,
            id: currentOrderID,
            time,
            inTx: null,
            outTx: null,
            receivedAmount: null,
            orderInputs,
            commitment,
            messageID: null,
            renVMStatus: null,
            nonce,
        };

        await this.persistentContainer.updateHistoryItem(currentOrderID, historyEvent);

        await this.setState({
            confirmedTrade: false,
            toAddress: null,
            refundAddress: null,
            confirmedOrderInputs: null,
            currentOrderID: null,
        });

        await this.handleOrder(currentOrderID);
    }

    public resetTrade = async () => {
        await this.setState({
            confirmedTrade: false,
            toAddress: null,
            refundAddress: null,
            confirmedOrderInputs: null,
            currentOrderID: null,
            submitting: false,
        });
    }

    public sufficientBalance = (): boolean => {
        const { orderInputs: { srcToken, srcAmount, dstAmount, dstToken }, exchangeTab, accountBalances } = this.state;

        let amount = srcAmount;
        let token = srcToken;

        if (exchangeTab === ExchangeTabs.Liquidity) {
            amount = dstAmount;
            token = dstToken;
        }

        // We can't know the balance if it's not an Ethereum token
        if (!isEthereumBased(token)) {
            return true;
        }

        // Fetch information about token
        const tokenDetails = Tokens.get(token);
        if (!tokenDetails) {
            return false;
        }
        const amountBN = new BigNumber(amount).multipliedBy(new BigNumber(10).exponentiatedBy(tokenDetails.decimals));
        const balance = accountBalances.get(token) || new BigNumber(0);
        if (amountBN.isNaN()) {
            return true;
        }
        return amountBN.lte(balance);
    }

    // Check the the volume isn't below the minimum required volume
    public validVolume = (): boolean => {
        const { orderInputs: { srcToken, srcAmount, dstToken, dstAmount } } = this.state;
        if (srcToken === Token.BTC || srcToken === Token.ZEC) {
            if (new BigNumber(srcAmount).isLessThan(0.00015)) {
                return false;
            }
        }
        if (dstToken === Token.BTC || dstToken === Token.ZEC) {
            if (new BigNumber(dstAmount).isLessThan(0.00015)) {
                return false;
            }
        }
        return true;
    }

    public setSubmitting = async (submitting: boolean) => {
        await this.setState({
            submitting,
            confirmedOrderInputs: { ...this.state.orderInputs },
        });
    }

    public resetReceiveValue = async (): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, dstAmount: "0" } });
    }

    public updateReceiveValue = async (): Promise<void> => {
        const { exchangeTab, orderInputs: { srcToken, dstToken, srcAmount } } = this.state;

        // const market = getMarket(
        //     srcToken,
        //     dstToken
        // );
        // if (market) {
        const { web3, networkID } = this.state;
        if (!web3) {
            throw new Error("Web3 not set yet.");
        }
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
        } else if (exchangeTab === ExchangeTabs.Liquidity) {
            const reserveAddress = await exchange.methods.reserves(syncGetTokenAddress(networkID, srcToken)).call();
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
                    const { tokenPrices } = this.state;
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
        } else {
            return;
        }

        // const dstAmountShifted = (new BigNumber(dstAmountBN).div(new BigNumber(10).pow(dstTokenDetails.decimals))).toString();

        // const reserves = balanceReserves.get(market);

        // let srcAmountAfterFees = new BigNumber(srcAmount);
        // if (srcToken === Token.BTC) {
        //     // Remove BTC transfer fees
        //     srcAmountAfterFees = BigNumber.max(srcAmountAfterFees.minus(0.0001), 0);
        // }

        // const dstAmount = await estimatePrice(
        //     srcToken,
        //     dstToken,
        //     srcAmountAfterFees,
        //     reserves,
        // );
        await this.setState({ orderInputs: { ...this.state.orderInputs, dstAmount: dstAmountBN.toFixed() } });
        // }
    }

    private readonly updateHistory = async (): Promise<void> => {
        const { orderInputs: { srcToken, dstToken } } = this.state;
        history.replace(`/?send=${srcToken}&receive=${dstToken}`);
    }
}
