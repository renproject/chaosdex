import * as chai from "chai";
import * as crypto from "crypto";

import chaiAsPromised from "chai-as-promised";
import chaiBigNumber from "chai-bignumber";
import BigNumber from "bignumber.js";
import BN from "bn.js";

// Import chai log helper
import "./logs";

chai.use(chaiAsPromised);
chai.use((chaiBigNumber)(BigNumber, BN));
chai.should();

export const ETHEREUM_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const NULL = "0x0000000000000000000000000000000000000000";
export const NULL20 = NULL;
export const NULL32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const randomBytes = (bytes: number): string => {
    return `0x${crypto.randomBytes(bytes).toString("hex")}`;
};

export const advanceBlock = () => {
    return new Promise((resolve, reject) => {
        (web3.currentProvider.send as any)({
            jsonrpc: '2.0',
            method: 'evm_mine',
            id: new Date().getTime(),
        }, ((err: Error, result: any) => {
            if (err) { return reject(err); }
            return resolve()
        }) as any)
    })
}

export const advanceBlocks = async (blocks: number) => {
    for (let i = 0; i < blocks; i++) {
        await advanceBlock();
    }
}