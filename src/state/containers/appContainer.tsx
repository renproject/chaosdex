import { Currency } from "@renex/react-components";
import { Map } from "immutable";
import { Container } from "unstated";

import { getTokenPricesInCurrencies, getMarket } from "../../lib/market";
import { MarketPair, Token } from "../../store/types/general";
import { ApplicationData } from "../storeTypes";

import { ReserveBalances, sdk } from "../../lib/shiftSDK";

import { estimatePrice } from "../../lib/estimatePrice";
import { history } from "../../lib/history";

const initialState: ApplicationData = {
    tokenPrices: Map<Token, Map<Currency, number>>(),
    balanceReserves: Map<MarketPair, ReserveBalances>(),
    popup: {
        dismissible: true,
        onCancel: () => null,
        popup: null,
        overlay: false,
    },
    order: {
        sendToken: Token.BTC,
        receiveToken: Token.ZEC,
        sendVolume: "0",
        receiveVolume: "0",
    }
};

export class AppContainer extends Container<ApplicationData> {
    public state = initialState;

    public updateTokenPrices = async (): Promise<void> => {
        const tokenPrices = await getTokenPricesInCurrencies();
        await this.setState({ tokenPrices });
    }

    public updateBalanceReserves = async (): Promise<void> => {
        let { balanceReserves } = this.state;
        const marketPairs = [MarketPair.DAI_BTC, MarketPair.ETH_BTC, MarketPair.REN_BTC, MarketPair.ZEC_BTC];
        const res = await sdk.getReserveBalance(marketPairs); // Promise<Array<Map<Token, BigNumber>>> => {
        marketPairs.forEach((value, index) => {
            balanceReserves = balanceReserves.set(value, res[index]);
        });
        await this.setState({ balanceReserves} );
    }

    public updateSendToken = async (sendToken: Token): Promise<void> => {
        await this.setState({ order: { ...this.state.order, sendToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateReceiveToken = async (receiveToken: Token): Promise<void> => {
        await this.setState({ order: { ...this.state.order, receiveToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateSendVolume = async (sendVolume: string): Promise<void> => {
        await this.setState({ order: { ...this.state.order, sendVolume } });
        await this.updateReceiveValue();
    }

    public flipSendReceive = async (): Promise<void> => {
        const { order: { sendToken, receiveToken } } = this.state;
        await this.setState({ order: { ...this.state.order, sendToken: receiveToken, receiveToken: sendToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    private updateReceiveValue = async (): Promise<void> => {
        const { order: { sendToken, receiveToken, sendVolume } } = this.state;
        const market = getMarket(sendToken, receiveToken);
        if (market) {
            const reserves = this.state.balanceReserves.get(market);

            const receiveVolume = await estimatePrice(sendToken, receiveToken, sendVolume, reserves);
            console.log(`rcv: ${receiveVolume.toFixed()}`);
            await this.setState({ order: { ...this.state.order, receiveVolume: receiveVolume.toFixed() } });
        }
    }

    private updateHistory = async (): Promise<void> => {
        const { order: { sendToken, receiveToken } } = this.state;
        history.replace(`/?send=${sendToken}&receive=${receiveToken}`);
    }
}
