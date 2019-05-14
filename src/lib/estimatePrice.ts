import BigNumber from "bignumber.js";

import { Token } from "../state/generalTypes";

import { ReserveBalances } from "./shiftSDK";

export const estimatePrice = async (sendToken: Token, receiveToken: Token, amount: string, reserves: ReserveBalances | undefined): Promise<BigNumber> => {
    if (!reserves) {
        console.debug("no reserves");
        return new BigNumber(0);
    }
    const feeInBIPs = 20;

    const srcAmount = reserves.get(sendToken);
    const dstAmount = reserves.get(receiveToken);
    const sendAmount = new BigNumber(amount);

    if (srcAmount === undefined || dstAmount === undefined) {
        console.debug("srcAmount or dstAmount undefined");
        return new BigNumber(0);
    }

    const rcvAmount = dstAmount.minus((srcAmount.times(dstAmount).div(srcAmount.plus(sendAmount))));
    return (rcvAmount.times(new BigNumber(10000 - feeInBIPs)).div(new BigNumber(10000)));
};
