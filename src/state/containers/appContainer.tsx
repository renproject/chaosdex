import { Currency } from "@renex/react-components";
import { Map } from "immutable";
import { Container } from "unstated";

import { estimatePrice } from "../../lib/estimatePrice";
import { getTokenPricesInCurrencies } from "../../lib/market";
import { Token } from "../../store/types/general";
import { ApplicationData } from "../storeTypes";

const initialState: ApplicationData = {
    order: {
        sendToken: Token.BTC,
        receiveToken: Token.ZEC,
        sendVolume: "0",
        receiveVolume: "0",
    },
    tokenPrices: Map<Token, Map<Currency, number>>(),
    popup: {
        dismissible: true,
        onCancel: () => null,
        popup: null,
        overlay: false,
    }
};

export class AppContainer extends Container<ApplicationData> {
    public state = initialState;

    public updateTokenPrices = async (): Promise<void> => {
        const tokenPrices = await getTokenPricesInCurrencies();
        await this.setState({ tokenPrices });
    }

    public updateSendToken = async (sendToken: Token): Promise<void> => {
        await this.setState({ order: { ...this.state.order, sendToken } });
        await this.updateReceiveValue();
    }

    public updateReceiveToken = async (receiveToken: Token): Promise<void> => {
        await this.setState({ order: { ...this.state.order, receiveToken } });
        await this.updateReceiveValue();
    }

    public updateSendVolume = async (sendVolume: string): Promise<void> => {
        await this.setState({ order: { ...this.state.order, sendVolume } });
        await this.updateReceiveValue();
    }

    private updateReceiveValue = async (): Promise<void> => {
        const { order: { sendToken, receiveToken, sendVolume } } = this.state;
        const receiveVolume = await estimatePrice(sendToken, receiveToken, sendVolume);
        await this.setState({ order: {...this.state.order, receiveVolume: receiveVolume.toFixed()}});
    }
}
