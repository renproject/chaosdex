import { Chain } from "@renproject/ren";
import localForage from "localforage";
import { PersistContainer } from "unstated-persist";

// import { Chain } from "@renproject/ren";
// import { Token } from "./generalTypes";
import { OrderInputs } from "./uiContainer";

export interface Commitment {
    srcToken: string;
    dstToken: string;
    minDestinationAmount: number;
    srcAmount: number;
    toAddress: string;
    refundBlockNumber: number;
    refundAddress: string;
}

export interface Tx {
    hash: string;
    chain: Chain;
}

export enum ShiftInStatus {
    Commited = "commited",
    Deposited = "deposited",
    SubmittedToRenVM = "submittedToRenVM",
    ReturnedFromRenVM = "returnedFromRenVM",
    SubmittedToEthereum = "submittedToEthereum",
    ConfirmedOnEthereum = "confirmedOnEthereum",
}

export enum ShiftOutStatus {
    Commited = "commited",
    SubmittedToEthereum = "submittedToEthereum",
    ConfirmedOnEthereum = "confirmedOnEthereum",
    SubmittedToRenVM = "submittedToRenVM",
    ReturnedFromRenVM = "returnedFromRenVM",
}

export interface HistoryEventCommon {
    id: string;
    time: number; // Seconds since Unix epoch
    inTx: Tx | null;
    outTx: Tx | null;
    receivedAmount: string | null;
    complete: boolean;
    orderInputs: OrderInputs;
    commitment: Commitment;
    messageID: string | null;
    nonce: string;
}

export interface ShiftInEvent extends HistoryEventCommon {
    shiftIn: true;
    status: ShiftInStatus;
}

export interface ShiftOutEvent extends HistoryEventCommon {
    shiftIn: false;
    status: ShiftOutStatus;
}

export type HistoryEvent = ShiftInEvent | ShiftOutEvent;

const initialState = {
    // tslint:disable-next-line: no-object-literal-type-assertion
    historyItems: {
        // [1]: {
        //     time: 0, // Seconds since Unix epoch
        //     outTx: {
        //         hash: "1234",
        //         chain: Chain.Ethereum,
        //     },
        //     receivedAmount: "1",
        //     orderInputs: {
        //         srcToken: Token.BTC,
        //         dstToken: Token.ETH,
        //         srcAmount: "1",
        //         dstAmount: "1",
        //     },
        //     complete: true,
        // }
    } as {
        [key: string]: HistoryEvent,
    },
    // _persist_version: undefined as undefined | number,
};

// @ts-ignore
export class PersistentContainer extends PersistContainer<typeof initialState> {
    public state = initialState;

    public persist = {
        key: "ren-order-history",
        version: 1,
        storage: localForage,
    };

    public updateHistoryItem = async (key: string, item: Partial<HistoryEvent>) => {
        { // tslint:disable: no-any
            await this.setState({
                historyItems: { ...this.state.historyItems, [key]: { ...this.state.historyItems[key], ...item } },
                _persist_version: (this.state as any)._persist_version || 1,
            } as any);
        } // tslint:enable: no-any
    }

    public removeHistoryItem = async (key: string) => {
        { // tslint:disable: no-any
            await this.setState({
                historyItems: { ...this.state.historyItems, [key]: undefined },
                _persist_version: (this.state as any)._persist_version || 1,
            } as any);
        } // tslint:enable: no-any
    }
}
