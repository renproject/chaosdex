import { Container } from "unstated";

import { estimatePrice } from "../../lib/estimatePrice";
import { history } from "../../lib/history";
import { Token } from "../../store/types/general";
import { OrderData } from "../storeTypes";

const initialState: OrderData = {
    sendToken: Token.BTC,
    receiveToken: Token.ZEC,
    sendVolume: "0",
    receiveVolume: "0",
};

export class OrderContainer extends Container<OrderData> {
    public state = initialState;

    public updateSendToken = async (sendToken: Token): Promise<void> => {
        await this.setState({ sendToken });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateReceiveToken = async (receiveToken: Token): Promise<void> => {
        await this.setState({ receiveToken });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateSendVolume = async (sendVolume: string): Promise<void> => {
        await this.setState({ sendVolume });
        await this.updateReceiveValue();
    }

    public flipSendReceive = async (): Promise<void> => {
        const { sendToken, receiveToken } = this.state;
        await this.setState({ sendToken: receiveToken, receiveToken: sendToken });
        await this.updateHistory();
    }

    private updateReceiveValue = async (): Promise<void> => {
        const { sendToken, receiveToken, sendVolume } = this.state;
        const receiveVolume = await estimatePrice(sendToken, receiveToken, sendVolume);
        await this.setState({ receiveVolume: receiveVolume.toFixed() });
    }

    private updateHistory = async (): Promise<void> => {
        const { sendToken, receiveToken } = this.state;
        history.replace(`/?send=${sendToken}&receive=${receiveToken}`);
    }
}
