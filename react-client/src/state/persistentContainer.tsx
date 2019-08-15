import { Chain } from "@renproject/ren";
import { TxStatus } from "@renproject/ren/dist/renVM/transaction";
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
    Committed = "shiftIn_committed",
    Deposited = "shiftIn_deposited",
    SubmittedToRenVM = "shiftIn_submittedToRenVM",
    ReturnedFromRenVM = "shiftIn_returnedFromRenVM",
    SubmittedToEthereum = "shiftIn_submittedToEthereum",
    ConfirmedOnEthereum = "shiftIn_confirmedOnEthereum",
    RefundedOnEthereum = "shiftIn_refundedOnEthereum",
}

export enum ShiftOutStatus {
    Committed = "shiftOut_committed",
    SubmittedToEthereum = "shiftOut_submittedToEthereum",
    ConfirmedOnEthereum = "shiftOut_confirmedOnEthereum",
    SubmittedToRenVM = "shiftOut_submittedToRenVM",
    ReturnedFromRenVM = "shiftOut_returnedFromRenVM",
    RefundedOnEthereum = "shiftOut_refundedOnEthereum",
}

export interface HistoryEventCommon {
    id: string;
    time: number; // Seconds since Unix epoch
    inTx: Tx | null;
    outTx: Tx | null;
    receivedAmount: string | null;
    orderInputs: OrderInputs;
    commitment: Commitment;
    messageID: string | null;
    nonce: string;
    renVMStatus: TxStatus | null;
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
        key: "ren-order-history-v2",
        version: 1,
        storage: localForage,
    };

    public updateHistoryItem = async (key: string, item: Partial<HistoryEvent>) => {
        await this.setState({
            historyItems: { ...this.state.historyItems, [key]: { ...this.state.historyItems[key], ...item } },
            // tslint:disable-next-line: no-any
            _persist_version: (this.state as any)._persist_version || 1,
            // tslint:disable-next-line: no-any
        } as any);
    }

    public removeHistoryItem = async (key: string) => {
        await this.setState({
            historyItems: { ...this.state.historyItems, [key]: undefined },
            // tslint:disable-next-line: no-any
            _persist_version: (this.state as any)._persist_version || 1,
            // tslint:disable-next-line: no-any
        } as any);
    }
}
