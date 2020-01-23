import { Currency } from "@renproject/react-components";
import RenJS from "@renproject/ren";
import BigNumber from "bignumber.js";
import { Map as ImmutableMap } from "immutable";
import { Container } from "unstated";
import Web3 from "web3";
import { ShiftInStatus } from "@renproject/gateway-js";
import { ShiftOutStatus } from "@renproject/ren-js-common";

import {
    calculateReceiveAmount, fetchEthereumTokenBalance, getBalances, getLiquidityBalances,
    getReserveBalances, getReserveTotalSupply,
} from "../lib/chaosdex";
import { syncGetTokenAddress } from "../lib/contractAddresses";
import { ETHEREUM_NODE } from "../lib/environmentVariables";
import { _catchInteractionErr_ } from "../lib/errors";
import { history } from "../lib/history";
import { getTokenPricesInCurrencies } from "../lib/market";
import { isEthereumBased, Token, Tokens } from "./generalTypes";
import {
    Commitment, CommitmentType, HistoryEvent, PersistentContainer,
} from "./persistentContainer";
import { PopupContainer } from "./popupContainer";
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

export enum LiquidityTabs {
    Add,
    Remove,
}

const initialState = {
    web3: new Web3(ETHEREUM_NODE),
    networkID: network.contracts.networkID,

    loggedOut: null as string | null,

    confirmedOrderInputs: null as null | OrderInputs,

    preferredCurrency: Currency.USD,

    exchangeTab: ExchangeTabs.Swap,
    liquidityTab: LiquidityTabs.Add,

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

    // Liquidity and reserve balances
    liquidityBalances: ImmutableMap<Token, BigNumber>(),
    reserveBalances: ImmutableMap<Token, { quote: BigNumber, base: BigNumber }>(),
    reserveTotalSupply: ImmutableMap<Token, BigNumber>(),

    network,
};

export class UIContainer extends Container<typeof initialState> {
    public state = initialState;
    public persistentContainer: PersistentContainer;
    public popupContainer: PopupContainer;

    constructor(persistentContainer: PersistentContainer, popupContainer: PopupContainer) {
        super();
        this.persistentContainer = persistentContainer;
        this.popupContainer = popupContainer;
    }

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        await this.setState({ web3, networkID, address, loggedOut: null, currentOrderID: null });
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

    public setLiquidityTab = async (liquidityTab: LiquidityTabs) => {
        await this.setState({ liquidityTab });
        await this.updateReceiveValue();
    }

    // Token prices ////////////////////////////////////////////////////////////

    public setCurrency = async (preferredCurrency: Currency) => {
        await this.setState({ preferredCurrency });
    }

    public updateTokenPrices = async (): Promise<void> => {
        const tokenPrices = await getTokenPricesInCurrencies();
        await this.setState({ tokenPrices });
    }

    public fetchEthereumTokenBalance = async (token: Token, address: string): Promise<BigNumber> => {
        const { web3, networkID, network: networkDetails } = this.state;
        if (!web3) {
            return new BigNumber(0);
        }
        return fetchEthereumTokenBalance(web3, networkID, networkDetails, token, address);
    }

    public updateAccountBalances = async (): Promise<void> => {
        const { address, web3, networkID, network: networkDetails } = this.state;
        let { accountBalances, liquidityBalances } = this.state;
        if (!web3 || !address) {
            return;
        }

        const ethTokens = [Token.ETH, Token.DAI];
        accountBalances = accountBalances.merge(await getBalances(web3, networkID, networkDetails, ethTokens, address));

        const tokensWithReserves = [Token.BTC, Token.ZEC, Token.BCH];
        liquidityBalances = liquidityBalances.merge(await getLiquidityBalances(web3, networkID, networkDetails, tokensWithReserves, address));

        await this.setState({ accountBalances, liquidityBalances });
    }

    public updateReserveBalances = async (): Promise<void> => {
        const { web3, networkID, network: networkDetails } = this.state;
        let { reserveTotalSupply, reserveBalances } = this.state;

        const tokensWithReserves = [Token.BTC, Token.ZEC, Token.BCH];
        reserveTotalSupply = reserveTotalSupply.merge(await getReserveTotalSupply(web3, networkID, networkDetails, tokensWithReserves));
        reserveBalances = reserveBalances.merge(await getReserveBalances(web3, networkID, networkDetails, tokensWithReserves));

        await this.setState({ reserveTotalSupply, reserveBalances });
    }

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

    public commitOrder = async (): Promise<HistoryEvent> => {
        const { orderInputs: order, networkID, web3, commitmentType, toAddress, refundAddress, orderInputs } = this.state;
        if (!web3) {
            throw new Error("Web3 not set yet.");
        }

        const srcTokenDetails = Tokens.get(order.srcToken);
        const dstTokenDetails = Tokens.get(order.dstToken);
        if (!refundAddress || !srcTokenDetails || !dstTokenDetails || !toAddress) {
            throw new Error(`Required info is undefined (${toAddress}, ${refundAddress}, ${srcTokenDetails}, ${dstTokenDetails})`);
        }

        const blockNumber = await web3.eth.getBlockNumber();
        let hexRefundAddress = refundAddress;
        if (order.srcToken === Token.BTC) {
            hexRefundAddress = RenJS.utils.btc.addressToHex(refundAddress);
        } else if (order.srcToken === Token.ZEC) {
            hexRefundAddress = RenJS.utils.zec.addressToHex(refundAddress);
        } else if (order.srcToken === Token.BCH) {
            hexRefundAddress = RenJS.utils.bch.addressToHex(refundAddress);
        }
        let hexToAddress = toAddress;
        if (order.dstToken === Token.BTC) {
            hexToAddress = RenJS.utils.btc.addressToHex(toAddress);
        } else if (order.dstToken === Token.ZEC) {
            hexToAddress = RenJS.utils.zec.addressToHex(toAddress);
        } else if (order.dstToken === Token.BCH) {
            hexToAddress = RenJS.utils.bch.addressToHex(toAddress);
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
            case CommitmentType.RemoveLiquidity:
                const { reserveBalances, reserveTotalSupply } = this.state;

                const token = order.srcToken;
                const reserveBalance = reserveBalances.get(token);
                const totalSupply = reserveTotalSupply.get(token);

                const srcAmountBN = new BigNumber(order.srcAmount);

                let srcAmountShifted = (srcAmountBN.times(new BigNumber(10).pow(srcTokenDetails.decimals))).decimalPlaces(0);
                if (srcAmountShifted.isNaN()) {
                    srcAmountShifted = new BigNumber(0);
                }

                let liquidity;
                if (!reserveBalance || !totalSupply || reserveBalance.quote.isZero()) {
                    liquidity = new BigNumber(0);
                } else {
                    liquidity = srcAmountShifted.times(totalSupply).div(reserveBalance.quote).decimalPlaces(0);
                }

                commitment = {
                    type: commitmentType,
                    token: syncGetTokenAddress(networkID, token),
                    liquidity: liquidity.toNumber(),
                    nativeAddress: hexRefundAddress,
                };

                break;
            default:
                throw new Error(`Unknown commitment type`);
        }

        const time = Date.now() / 1000;
        const currentOrderID = String(time);

        const shift = !isEthereumBased(orderInputs.srcToken) && isEthereumBased(orderInputs.dstToken) && commitmentType !== CommitmentType.RemoveLiquidity ? {
            // Cast required by TS to differentiate ShiftIn and ShiftOut types.
            shiftIn: true as true,
            status: ShiftInStatus.Committed,
        } : {
                shiftIn: false as false,
                status: ShiftOutStatus.Committed,
            };

        const nonce = RenJS.utils.randomNonce();

        const historyEvent: HistoryEvent = {
            ...shift,
            id: currentOrderID,
            time,
            inTx: null,
            outTx: null,
            receivedAmount: null,
            orderInputs,
            commitment: commitment,
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

        return historyEvent;
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

    public getMaxInput = (token: Token): BigNumber => {
        const { exchangeTab, liquidityTab, accountBalances, liquidityBalances, reserveBalances, reserveTotalSupply } = this.state;

        // Fetch information about token
        const tokenDetails = Tokens.get(token);
        if (!tokenDetails) {
            return new BigNumber(0);
        }

        let balance;
        if (exchangeTab === ExchangeTabs.Liquidity && liquidityTab === LiquidityTabs.Remove) {
            const reserveBalance = reserveBalances.get(token);
            const liquidityBalance = liquidityBalances.get(token);
            const totalSupply = reserveTotalSupply.get(token);

            if (!reserveBalance || !liquidityBalance || !totalSupply || totalSupply.isZero()) {
                balance = new BigNumber(0);
            } else {
                balance = liquidityBalance.times(reserveBalance.quote).div(totalSupply);
            }
        } else {
            // We can't know the balance if it's not an Ethereum token
            if (!isEthereumBased(token)) {
                throw new Error(`Unable to check ${token} balance.`);
            }

            balance = accountBalances.get(token) || new BigNumber(0);
        }

        return balance;
    }

    public sufficientBalance = (): boolean => {
        const { orderInputs: { srcToken, srcAmount, dstAmount, dstToken }, exchangeTab, liquidityTab } = this.state;

        let amount = srcAmount;
        let token = srcToken;

        if (exchangeTab === ExchangeTabs.Liquidity && liquidityTab === LiquidityTabs.Add) {
            amount = dstAmount;
            token = dstToken;
        }

        if (
            (exchangeTab !== ExchangeTabs.Liquidity || liquidityTab !== LiquidityTabs.Remove) &&
            !isEthereumBased(token)
        ) {
            return true;
        }

        const balance = this.getMaxInput(token);

        const tokenDetails = Tokens.get(token);
        if (!tokenDetails) {
            return false;
        }

        const amountBN = new BigNumber(amount).multipliedBy(new BigNumber(10).exponentiatedBy(tokenDetails.decimals));

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
        const { web3, networkID, exchangeTab, liquidityTab, orderInputs: { srcToken, dstToken, srcAmount }, tokenPrices, reserveBalances } = this.state;
        if (!web3 || srcToken === dstToken) {
            return;
        }

        try {
            const dstAmountBN = await calculateReceiveAmount(web3, networkID, exchangeTab, liquidityTab, { srcToken, dstToken, srcAmount }, tokenPrices, reserveBalances);
            await this.setState({ orderInputs: { ...this.state.orderInputs, dstAmount: dstAmountBN.toFixed() } });
        } catch (error) {
            _catchInteractionErr_(error, "Error in uiContainer: calculateReceiveAmount");
        }
    }

    public setLoggedOut = async (loggedOut?: string) => {
        return this.setState({ loggedOut: loggedOut || null });
    }

    // lookForLogout detects if 1) the user has changed or logged out of their Web3
    // wallet
    public lookForLogout = async () => {
        const { address, web3 } = this.state;

        if (!address || !web3) {
            return;
        }

        const accounts = (await web3.eth.getAccounts())
            .map((web3Address: string) => web3Address.toLowerCase());

        if (!accounts.includes(address.toLowerCase())) {
            await this.clearAddress();
            await this.setLoggedOut(address);
        }
    }

    private readonly updateHistory = async (): Promise<void> => {
        const { orderInputs: { srcToken, dstToken } } = this.state;
        history.replace(`/?send=${srcToken}&receive=${dstToken}`);
    }
}
