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
    promiEvent: PromiEvent<Transaction>;
    transactionHash: string | undefined;
    commitment: Commitment;
    swapError: Error | undefined;
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
    toAddress: null as string | null,
    refundAddress: null as string | null,
    commitment: null as Commitment | null,
    depositAddress: null as string | null,
    depositAddressToken: null as Token | null,
    utxos: null as UTXO[] | null,
    messageID: null as string | null,
    // tslint:disable-next-line: no-any
    signature: null as Signature | null,
    transactionHash: null as string | null,
    swapHistory: List<HistoryEvent>().push({
        commitment: {
            srcToken: "0x2a8368d2a983a0aeae8da0ebc5b7c03a0ea66b37",
            dstToken: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            minDestinationAmount: new BigNumber("0"),
            srcAmount: new BigNumber("10000"),
            toAddress: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66",
            refundBlockNumber: 11111762,
            refundAddress: "0x6fca15b7fa057863ee881130006817f12de46c3ad8ebe2d9de"
        },
        // tslint:disable-next-line: no-any
        promiEvent: undefined as any,
        transactionHash: undefined,
        swapError: undefined,
    }),
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
        // FIXME!!!
        const blockNumber = await dexSDK.web3.eth.getBlockNumber(); // 11152976;
        const commitment: Commitment = {
            srcToken: tokenAddresses(order.srcToken, "testnet"),
            dstToken: tokenAddresses(order.dstToken, "testnet"),
            minDestinationAmount: new BigNumber(0),
            srcAmount: new BigNumber(order.sendVolume).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals)),
            toAddress,
            refundBlockNumber: blockNumber + 100,
            refundAddress: btcAddressToHex(refundAddress),
        };
        console.log(`Commitment: ${JSON.stringify(commitment)}`);
        const depositAddress = await dexSDK.generateAddress(order.srcToken, commitment);
        const depositAddressToken = order.srcToken;
        await this.setState({ commitment, depositAddress, depositAddressToken });
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

    public submitSwap = async () => {
        const { swapHistory, address, dexSDK, commitment, signature } = this.state;
        if (!address || !commitment || !signature) {
            return;
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
        };

        await this.setState({ swapHistory: swapHistory.push(historyItem) });
    }

    public updateMessageStatus = async () => {
        const { dexSDK, messageID } = this.state;
        if (!messageID) {
            return;
        }
        try {
            const messageResponse = await dexSDK.shiftStatus(messageID);
            console.log(`messageResponse: ${messageResponse}`);
            await this.setState({ signature: messageResponse });
        } catch (error) {
            console.error(error);
        }
    }

    public cancelTrade = async () => {
        await this.setState({
            toAddress: null,
            refundAddress: null,
            commitment: null,
            depositAddress: null,
            depositAddressToken: null,
            utxos: null,
        });
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
