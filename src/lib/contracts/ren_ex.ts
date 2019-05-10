/////////// WEB3 ///////////////////////////////////////////////////////////////

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
export interface RenExWeb3 extends Contract {
    methods: {
        reserves(index_0: string): Read<string>;
        feeinBIPs(): Read<BigNumber>;
        ethereum(): Read<string>;
        trade(_to: string, _src: string, _dst: string, _sendAmount: BigNumber): Write;
        registerReserve(_a: string, _b: string, _reserve: string): Write;
        calculateReceiveAmount(_src: string, _dst: string, _sendAmount: BigNumber): Read<BigNumber>;
        reserve(_a: string, _b: string): Read<string>;
        tokenPairID(_a: string, _b: string): Read<string>;
    }
}
