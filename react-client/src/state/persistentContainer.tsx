import { ShiftInStatus } from "@renproject/gateway";
import { Chain, ShiftOutStatus, TxStatus } from "@renproject/ren-js-common";
import localForage from "localforage";
import { PersistContainer } from "unstated-persist";

import { OrderInputs } from "./uiContainer";

export interface OrderCommitment {
    type: CommitmentType.Trade;
    srcToken: string;
    dstToken: string;
    minDestinationAmount: number;
    srcAmount: number;
    toAddress: string;
    refundBlockNumber: number;
    refundAddress: string;
}

export interface AddLiquidityCommitment {
    type: CommitmentType.AddLiquidity;
    liquidityProvider: string;
    maxDAIAmount: string;
    token: string;
    amount: number;
    refundBlockNumber: number;
    refundAddress: string;
}

export interface RemoveLiquidityCommitment {
    type: CommitmentType.RemoveLiquidity;
    token: string;
    liquidity: number;
    nativeAddress: string;
}

export type Commitment = OrderCommitment | AddLiquidityCommitment | RemoveLiquidityCommitment;

export enum CommitmentType {
    Trade,
    AddLiquidity,
    RemoveLiquidity
}

export interface Tx {
    hash: string;
    chain: Chain.Ethereum | Chain.Bitcoin | Chain.Zcash | Chain.BitcoinCash;
}

export interface HistoryEventCommon {
    id: string;
    time: number; // Seconds since Unix epoch
    inTx: Tx | null;
    outTx: Tx | null;
    receivedAmount: string | null;
    orderInputs: OrderInputs;
    commitment: Commitment;
    renTxHash: string | null;
    nonce: string;
    renVMStatus: TxStatus | null;
}

export interface ShiftInEvent extends HistoryEventCommon {
    shiftIn: true;
    status: ShiftInStatus;
    commitment: Commitment;
}

export interface ShiftOutEvent extends HistoryEventCommon {
    shiftIn: false;
    status: ShiftOutStatus;
}

export type HistoryEvent = ShiftInEvent | ShiftOutEvent;

const initialState = {
    updateVersion: 0,
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

    public migrate = async () => {
        for (const item of Object.keys(this.state.historyItems)) {
            const shift = this.state.historyItems[item];
            // tslint:disable-next-line: no-any
            if (shift && (shift as any).commitment && !shift.commitment) {
                // tslint:disable-next-line: no-any
                shift.commitment = (shift as any).commitment;
                await this.updateHistoryItem(shift.id, shift).catch(console.error);
            }
        }
    }

    public getHistoryItems = async () => {
        await this.migrate();
        return this.state.historyItems;
    }

    public updateHistoryItem = async (key: string, item: Partial<HistoryEvent>) => {
        await this.setState({
            updateVersion: this.state.updateVersion + 1,
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
