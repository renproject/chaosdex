import { Currency } from "@renex/react-components";
import BigNumber from "bignumber.js";
import { List, Map } from "immutable";
import { Container } from "unstated";
import { PromiEvent } from "web3-core";

import { tokenAddresses } from "../../lib/contractAddresses";
import { Transaction } from "../../lib/contracts/ren_ex_adapter";
import { Commitment, DexSDK, ReserveBalances } from "../../lib/dexSDK";
import { estimatePrice } from "../../lib/estimatePrice";
import { history } from "../../lib/history";
import { getMarket, getTokenPricesInCurrencies } from "../../lib/market";
import { btcAddressToHex } from "../../lib/shiftSDK/blockchain/btc";
import { Signature } from "../../lib/shiftSDK/darknode/darknodeGroup";
import { Chain, UTXO } from "../../lib/shiftSDK/shiftSDK";
import { MarketPair, Token, Tokens } from "../generalTypes";

export interface HistoryEvent {
    commitment: Commitment;
    srcToken: Token;
    dstToken: Token;
    srcAmount: BigNumber; // Normal units
    dstAmount: BigNumber; // Normal units
    time: number; // Seconds since Unix epoch

    promiEvent?: PromiEvent<Transaction>;
    transactionHash?: string;
    swapError?: Error;
}

const initialState = {
    address: null as string | null,
    tokenPrices: Map<Token, Map<Currency, number>>(),
    balanceReserves: Map<MarketPair, ReserveBalances>(),
    dexSDK: new DexSDK(),
    order: {
        srcToken: Token.BTC,
        dstToken: Token.DAI,
        sendVolume: "0.0001",
        receiveVolume: "0",
    },
    submitting: false,
    toAddress: null as string | null,
    refundAddress: null as string | null,
    commitment: null as Commitment | null,
    depositAddress: null as string | null,
    depositAddressToken: null as Token | null,
    utxos: null as UTXO[] | null,
    messageID: null as string | null,
    // tslint:disable-next-line: no-any
    signature: null as Signature | null,
};

export type OrderData = typeof initialState.order;

export class AppContainer extends Container<typeof initialState> {
    public state = initialState;

    public connect = async (): Promise<void> => {
        const { dexSDK } = this.state;
        await dexSDK.connect();

        const addresses = await dexSDK.web3.eth.getAccounts();
        await this.setState({ address: addresses.length > 0 ? addresses[0] : null });
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
        await this.setState({ order: { ...this.state.order, srcToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateDstToken = async (dstToken: Token): Promise<void> => {
        await this.setState({ order: { ...this.state.order, dstToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateSendVolume = async (sendVolume: string): Promise<void> => {
        await this.setState({ order: { ...this.state.order, sendVolume } });
        await this.updateReceiveValue();
    }

    public flipSendReceive = async (): Promise<void> => {
        const { order: { srcToken, dstToken } } = this.state;
        await this.setState({ order: { ...this.state.order, srcToken: dstToken, dstToken: srcToken } });
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
        const { order, dexSDK, toAddress, refundAddress } = this.state;
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
            srcAmount: new BigNumber(order.sendVolume).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals)),
            toAddress: hexToAddress,
            refundBlockNumber: blockNumber + 360, // 360 blocks (assuming 0.1bps, equals 1 hour)
            refundAddress: hexRefundAddress,
            originals: {
                srcToken: order.srcToken,
                dstToken: order.dstToken,
                dstAmount: new BigNumber(order.receiveVolume),
                srcAmount: new BigNumber(order.sendVolume),
            }
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
        await this.setState({ utxos });
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
        if (!address || !commitment || !signature) {
            return null;
        }

        const promiEvent = dexSDK.submitSwap(address, commitment, signature);

        let transactionHash: string | undefined;
        let swapError: Error | undefined;
        try {
            transactionHash = await new Promise((resolve, reject) => promiEvent.on("transactionHash", resolve));
        } catch (error) {
            swapError = error;
        }

        const historyItem: HistoryEvent = {
            promiEvent,
            transactionHash,
            commitment,
            swapError,
            time: Date.now() / 1000,
            srcToken: commitment.originals.srcToken,
            dstToken: commitment.originals.dstToken,
            srcAmount: commitment.originals.srcAmount,
            dstAmount: commitment.originals.dstAmount,
        };

        // await this.setState({ swapHistory: swapHistory.push(historyItem) });
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
            console.error(error);
        }
    }

    public setSubmitting = async (submitting: boolean) => {
        await this.setState({
            submitting,
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
        });
    }

    public shiftERC20 = async () => {
        const { address, dexSDK, commitment } = this.state;
        if (!address || !commitment) {
            return;
        }
        await dexSDK.shiftERC20(address, commitment);
    }

    private readonly updateReceiveValue = async (): Promise<void> => {
        const { order: { srcToken, dstToken, sendVolume } } = this.state;
        const market = getMarket(srcToken, dstToken);
        if (market) {
            const reserves = this.state.balanceReserves.get(market);

            const receiveVolume = await estimatePrice(srcToken, dstToken, sendVolume, reserves);
            await this.setState({ order: { ...this.state.order, receiveVolume: receiveVolume.toFixed() } });
        }
    }

    private readonly updateHistory = async (): Promise<void> => {
        const { order: { srcToken, dstToken } } = this.state;
        history.replace(`/?send=${srcToken}&receive=${dstToken}`);
    }
}
