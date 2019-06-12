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
export interface ERC20DetailedWeb3 extends Contract {
    methods: {
        approve(spender: string, value: BigNumber): Write;
        totalSupply(): Read<BigNumber>;
        transferFrom(from: string, to: string, value: BigNumber): Write;
        balanceOf(who: string): Read<BigNumber>;
        transfer(to: string, value: BigNumber): Write;
        allowance(owner: string, spender: string): Read<BigNumber>;
        name(): Read<string>;
        symbol(): Read<string>;
        decimals(): Read<BigNumber>;
    }
}
