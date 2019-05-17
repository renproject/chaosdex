// tslint:disable

import BN from "bn.js";
import { Log, PromiEvent, TransactionReceipt } from "web3-core";
import { Contract, SendOptions } from "web3-eth-contract";

export interface Transaction { receipt: TransactionReceipt; tx: string; logs: Log[]; }

type BigNumber = string | number | BN;


export interface Read<T> {
    call: (options?: SendOptions) => Promise<T>;
}
export interface Write {
    send: (options?: SendOptions) => PromiEvent<Transaction>;
}
export interface RenExAdapterWeb3 extends Contract {
    methods: {
        renshift(): Read<string>;
        renex(): Read<string>;
        renounceOwnership(): Write;
        owner(): Read<string>;
        isOwner(): Read<boolean>;
        transferOwnership(newOwner: string): Write;
        updateRenShift(_renshift: string): Write;
        updateRenEx(_renex: string): Write;
        trade(_src: string, _dst: string, _minDstAmt: BigNumber, _to: string, _refundBN: BigNumber, _refundAddress: string, _amount: BigNumber, _hash: string, _sig: string): Write;
        commitment(_src: string, _dst: string, _minDstAmt: BigNumber, _to: string, _refundBN: BigNumber, _refundAddress: string): Read<string>;
    }
}
