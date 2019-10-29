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
