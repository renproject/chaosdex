import BigNumber from "bignumber.js";

import { Token } from "../store/types/general";

export const estimatePrice = async (sendToken: Token, receiveToken: Token, amount: string): Promise<BigNumber> => {
    return new BigNumber(10).times(amount);
};
