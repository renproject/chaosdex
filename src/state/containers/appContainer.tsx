import { Currency } from "@renex/react-components";
import BigNumber from "bignumber.js";
import { List, Map } from "immutable";
import { Container } from "unstated";

import { tokenAddresses } from "../../lib/contractAddresses";
import { Commitment, DexSDK, OrderInputs, ReserveBalances } from "../../lib/dexSDK";
import { estimatePrice } from "../../lib/estimatePrice";
import { history } from "../../lib/history";
import { getMarket, getTokenPricesInCurrencies } from "../../lib/market";
import { btcAddressToHex } from "../../lib/shiftSDK/blockchain/btc";
import { Signature } from "../../lib/shiftSDK/darknode/darknodeGroup";
import { Chain, UTXO } from "../../lib/shiftSDK/shiftSDK";
import { MarketPair, Token, Tokens } from "../generalTypes";

export interface HistoryEvent {
    time: number; // Seconds since Unix epoch
    transactionHash: string;
    orderInputs: OrderInputs;
}

const initialOrder: OrderInputs = {
    srcToken: Token.BTC,
    dstToken: Token.DAI,
    srcAmount: "0.01",
    dstAmount: "0",
};

const initialState = {
    address: null as string | null,
    tokenPrices: Map<Token, Map<Currency, number>>(),
    accountBalances: Map<Token, BigNumber>(),
    balanceReserves: Map<MarketPair, ReserveBalances>(),
    dexSDK: new DexSDK(),

    orderInputs: initialOrder,
    confirmedOrderInputs: null as null | OrderInputs,

    submitting: false,
    toAddress: null as string | null,
    refundAddress: null as string | null,
    commitment: null as Commitment | null,
    depositAddress: null as string | null,
    depositAddressToken: null as Token | null,
    utxos: null as List<UTXO> | null,
    messageID: null as string | null,
    signature: null as Signature | null,
};

export type OrderData = typeof initialState.orderInputs;

export class AppContainer extends Container<typeof initialState> {
    public state = initialState;

    public connect = async (): Promise<void> => {
        const { dexSDK } = this.state;
        await dexSDK.connect();

        const addresses = await dexSDK.web3.eth.getAccounts();
        await this.setState({ address: addresses.length > 0 ? addresses[0] : null });
        await this.updateAccountBalances();
    }

    public clearAddress = async (): Promise<void> => {
        await this.setState({ address: null });
    }

    // Token prices ////////////////////////////////////////////////////////////

    public updateTokenPrices = async (): Promise<void> => {
        const tokenPrices = await getTokenPricesInCurrencies();
        await this.setState({ tokenPrices });
    }

    public updateBalanceReserves = async (): Promise<void> => {
        const { balanceReserves,
            dexSDK } = this.state;
        let newBalanceReserves = balanceReserves;
        const marketPairs = [MarketPair.DAI_BTC, MarketPair.ETH_BTC, MarketPair.REN_BTC, MarketPair.ZEC_BTC];
        const res = await dexSDK.getReserveBalance(marketPairs); // Promise<Array<Map<Token, BigNumber>>> => {
        marketPairs.forEach((value, index) => {
            newBalanceReserves = newBalanceReserves.set(value, res[index]);
        });
        await this.setState({ balanceReserves: newBalanceReserves });
        await this.updateReceiveValue();
    }

    // Swap inputs /////////////////////////////////////////////////////////////

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

    public updateToAddress = async (toAddress: string) => {
        await this.setState({ toAddress });
    }
    public updateRefundAddress = async (refundAddress: string) => {
        await this.setState({ refundAddress });
    }

    public updateCommitment = async () => {
        const { orderInputs: order, dexSDK, toAddress, refundAddress } = this.state;
        const srcTokenDetails = Tokens.get(order.srcToken);
        if (!toAddress || !refundAddress || !srcTokenDetails) {
            throw new Error(`Required info is undefined (${toAddress}, ${refundAddress}, ${srcTokenDetails})`);
        }
        const blockNumber = await dexSDK.web3.eth.getBlockNumber();
        let hexRefundAddress = refundAddress;
        if (order.srcToken === Token.BTC) {
            hexRefundAddress = btcAddressToHex(refundAddress);
        }
        let hexToAddress = toAddress;
        if (order.dstToken === Token.BTC) {
            hexToAddress = btcAddressToHex(toAddress);
        }
        const commitment: Commitment = {
            srcToken: tokenAddresses(order.srcToken, "testnet"),
            dstToken: tokenAddresses(order.dstToken, "testnet"),
            minDestinationAmount: new BigNumber(0),
            srcAmount: new BigNumber(order.srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals)),
            toAddress: hexToAddress,
            refundBlockNumber: blockNumber + 360, // 360 blocks (assuming 0.1bps, equals 1 hour)
            refundAddress: hexRefundAddress,
            orderInputs: order,
        };
        if ([Token.ETH, Token.DAI, Token.REN].includes(order.srcToken)) {
            await this.setState({ commitment });
        } else {
            const depositAddress = await dexSDK.generateAddress(order.srcToken, commitment);
            const depositAddressToken = order.srcToken;
            await this.setState({ commitment, depositAddress, depositAddressToken });
        }
    }

    public updateDeposits = async () => {
        const { dexSDK, depositAddress, depositAddressToken } = this.state;
        if (!depositAddressToken || !depositAddress) {
            return;
        }
        const utxos = await dexSDK.retrieveDeposits(depositAddressToken, depositAddress);
        if (!this.state.utxos || (utxos.length >= this.state.utxos.size)) {
            await this.setState({ utxos: List(utxos) });
        }
    }

    public submitDeposit = async () => {
        const { dexSDK, commitment, /* utxos, */ depositAddressToken } = this.state;
        const utxos: UTXO[] = [{
            chain: Chain.Bitcoin, utxo: {
                txHash: "",
                amount: 9000,
                scriptPubKey: "",
                vout: 1,
            }
        }];
        if (!commitment || !depositAddressToken || !utxos || utxos.length === 0) {
            return;
        }
        const messageID = await dexSDK.submitDeposit(depositAddressToken, utxos[0], commitment);
        await this.setState({ messageID });
    }

    public submitSwap = async (): Promise<HistoryEvent | null> => {
        const { address, dexSDK, commitment, signature } = this.state;
        if (!address || !commitment) {
            return null;
        }

        const promiEvent = dexSDK.submitSwap(address, commitment, signature);
        const transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));

        const historyItem: HistoryEvent = {
            transactionHash,
            orderInputs: commitment.orderInputs,
            time: Date.now() / 1000,
        };

        await this.resetTrade();
        return historyItem;
    }

    public updateMessageStatus = async () => {
        const { dexSDK, messageID } = this.state;
        if (!messageID) {
            return;
        }
        try {
            const messageResponse = await dexSDK.shiftStatus(messageID);
            await this.setState({ signature: messageResponse });
        } catch (error) {
            if (`${error}`.match("Signature not available")) {
                return;
            }
            console.error(error);
        }
    }

    public setSubmitting = async (submitting: boolean) => {
        await this.setState({
            submitting,
            confirmedOrderInputs: { ...this.state.orderInputs },
        });
    }

    public resetTrade = async () => {
        await this.setState({
            submitting: false,
            toAddress: null,
            refundAddress: null,
            commitment: null,
            depositAddress: null,
            depositAddressToken: null,
            utxos: null,
            messageID: null,
            signature: null,
        });
    }

    public sufficientBalance = (): boolean => {
        const { orderInputs: { srcToken, srcAmount }, accountBalances } = this.state;
        const srcTokenDetails = Tokens.get(srcToken);
        if (![Token.ETH, Token.DAI, Token.REN].includes(srcToken)) {
            return true;
        }
        if (!srcTokenDetails) {
            return true;
        }
        const srcAmountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
        const balance = accountBalances.get(srcToken) || new BigNumber(0);
        console.log(srcAmountBN.toString());
        console.log(balance.toString());
        return srcAmountBN.lte(balance);
    }

    public updateAccountBalances = async (): Promise<void> => {
        const { dexSDK, address } = this.state;
        if (!address) {
            return;
        }
        let accountBalances = this.state.accountBalances;
        const ethTokens = [Token.ETH, Token.DAI, Token.REN];
        const promises = ethTokens.map(token => dexSDK.fetchEthereumTokenBalance(token, address));
        const balances = await Promise.all(promises);
        balances.forEach((bal, index) => {
            accountBalances = accountBalances.set(ethTokens[index], bal);
        });

        await this.setState({ accountBalances });
    }

    public setAllowance = async (): Promise<boolean> => {
        const { orderInputs: { srcToken, srcAmount }, dexSDK, address } = this.state;
        const srcTokenDetails = Tokens.get(srcToken);
        if (!address || !srcTokenDetails) {
            return false;
        }
        const srcAmountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
        const allowance = await dexSDK.setTokenAllowance(srcAmountBN, srcToken, address);
        return allowance.gte(srcAmountBN);
    }

    private readonly updateReceiveValue = async (): Promise<void> => {
        const { orderInputs: { srcToken, dstToken, srcAmount } } = this.state;
        const market = getMarket(srcToken, dstToken);
        if (market) {
            const reserves = this.state.balanceReserves.get(market);

            const dstAmount = await estimatePrice(srcToken, dstToken, srcAmount, reserves);
            await this.setState({ orderInputs: { ...this.state.orderInputs, dstAmount: dstAmount.toFixed() } });
        }
    }

    private readonly updateHistory = async (): Promise<void> => {
        const { orderInputs: { srcToken, dstToken } } = this.state;
        history.replace(`/?send=${srcToken}&receive=${dstToken}`);
    }
}
