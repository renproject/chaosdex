import BN from "bn.js";

import {
    DaiTokenInstance, DEXInstance, DEXReserveInstance, ERC20Instance, TestTokenInstance,
} from "../types/truffle-contracts";
import { NULL } from "./helper/testUtils";

const TestToken = artifacts.require("TestToken");
const DAI = artifacts.require("DaiToken");
const DEXReserve = artifacts.require("DEXReserve");
const DEX = artifacts.require("DEX");

contract("DEX", (accounts) => {
    let dai: DaiTokenInstance;
    let token1: TestTokenInstance;
    let dexReserve1: DEXReserveInstance;
    let token2: TestTokenInstance;
    let dexReserve2: DEXReserveInstance;
    let dex: DEXInstance;

    const randomAddress = accounts[7];

    const dexFees = new BN(10);

    const deadline = 10000000000000;

    before(async () => {
        dai = await DAI.new();
        token1 = await TestToken.new("TestToken1", "TST1", 18);
        dexReserve1 = await DEXReserve.new("TestToken1 Liquidity Token", "TST1LT", 18, dai.address, token1.address, dexFees);

        token2 = await TestToken.new("TestToken2", "TST2", 8);
        dexReserve2 = await DEXReserve.new("TestToken2 Liquidity Token", "TST2LT", 8, dai.address, token2.address, dexFees);

        dex = await DEX.new(dai.address);
        await dex.registerReserve(token1.address, dexReserve1.address);
        await dex.registerReserve(token2.address, dexReserve2.address);

        await depositToReserve(new BN(20000000000) /* DAI */, new BN(15000000000) /* token1 */, token1, dexReserve1);
        await depositToReserve(new BN(20000000000) /* DAI */, new BN(200000000) /* token2 */, token2, dexReserve2);
    });

    const depositToReserve = async (baseValue: BN, tokenValue: BN, token: ERC20Instance, reserve: DEXReserveInstance) => {
        await dai.approve(reserve.address, baseValue);
        await token.approve(reserve.address, tokenValue);
        await reserve.addLiquidity(accounts[0], baseValue, tokenValue, deadline);
    };

    const tradeTokens = async (srcToken: ERC20Instance, dstToken: ERC20Instance) => {
        const value = new BN(225000);
        const srcReserve = await dex.reserves.call(srcToken.address);
        const dstReserve = await dex.reserves.call(dstToken.address);

        const receivingValue = await dex.calculateReceiveAmount.call(srcToken.address, dstToken.address, value);
        await srcToken.approve(srcReserve === NULL ? dstReserve : srcReserve, value);

        // Balances before
        const srcReserveSrcBalanceBefore = new BN((await srcToken.balanceOf.call(srcReserve)).toString());
        const srcReserveBaseBalanceBefore = new BN((await dai.balanceOf.call(srcReserve)).toString());
        const srcReserveDstBalanceBefore = new BN((await dstToken.balanceOf.call(srcReserve)).toString());
        const dstReserveSrcBalanceBefore = new BN((await srcToken.balanceOf.call(dstReserve)).toString());
        const dstReserveBaseBalanceBefore = new BN((await dai.balanceOf.call(dstReserve)).toString());
        const dstReserveDstBalanceBefore = new BN((await dstToken.balanceOf.call(dstReserve)).toString());

        await dex.trade(
            accounts[0], srcToken.address, dstToken.address, value,
        );

        // Balances after
        const srcReserveSrcBalanceAfter = new BN((await srcToken.balanceOf.call(srcReserve)).toString());
        const srcReserveBaseBalanceAfter = new BN((await dai.balanceOf.call(srcReserve)).toString());
        const srcReserveDstBalanceAfter = new BN((await dstToken.balanceOf.call(srcReserve)).toString());
        const dstReserveSrcBalanceAfter = new BN((await srcToken.balanceOf.call(dstReserve)).toString());
        const dstReserveBaseBalanceAfter = new BN((await dai.balanceOf.call(dstReserve)).toString());
        const dstReserveDstBalanceAfter = new BN((await dstToken.balanceOf.call(dstReserve)).toString());


        if (srcReserve !== NULL && dstReserve !== NULL) {
            // If the trade goes across two reserves, check that the base
            // token's amount has changed by the same value across both.
            srcReserveBaseBalanceBefore.sub(srcReserveBaseBalanceAfter).should.bignumber.gt(0);
            dstReserveBaseBalanceAfter.sub(dstReserveBaseBalanceBefore).should.bignumber.equal(srcReserveBaseBalanceBefore.sub(srcReserveBaseBalanceAfter));
        }

        if (srcReserve !== NULL) {
            // Check that the src reserve's balances have changed correctly.
            srcReserveSrcBalanceAfter.sub(srcReserveSrcBalanceBefore).should.bignumber.equal(value);
            // Only one shifter involved
            if (dstReserve === NULL) {
                srcReserveDstBalanceBefore.sub(srcReserveDstBalanceAfter).should.bignumber.equal(receivingValue);
            }
        }

        if (dstReserve !== NULL) {
            // Check that the dst reserve's balances have changed correctly.
            dstReserveDstBalanceBefore.sub(dstReserveDstBalanceAfter).should.bignumber.equal(receivingValue);
            // Only one shifter involved
            if (srcReserve === NULL) {
                dstReserveSrcBalanceAfter.sub(dstReserveSrcBalanceBefore).should.bignumber.equal(value);
            }
        }
    }

    it("should fail to trade unsupported tokens", async () => {
        await dex.trade(accounts[0], dai.address, randomAddress, 1000).should.be.rejectedWith(/unsupported token/);
    });

    it("should fail to trade unsupported tokens", async () => {
        await dex.trade(accounts[0], randomAddress, dai.address, 1000).should.be.rejectedWith(/unsupported token/);
    });

    it("should fail to trade unsupported tokens", async () => {
        await dex.trade(accounts[0], randomAddress, randomAddress, 1000).should.be.rejectedWith(/unsupported token/);
    });

    it("should trade dai to token1 on DEX", async () => tradeTokens(dai, token1));
    it("should trade token1 to dai on DEX", async () => tradeTokens(token1, dai));
    it("should trade dai to token2 on DEX", async () => tradeTokens(dai, token2));
    it("should trade token1 to token2 on DEX", async () => tradeTokens(token1, token2));
    it("should trade token2 to token1 on DEX", async () => tradeTokens(token2, token1));

    it("should be able to withdraw funds that are mistakenly sent to dex", async () => {
        await dai.transfer(dex.address, 1000);
        const initialBalance = new BN((await dai.balanceOf.call(accounts[0])).toString());
        await dex.recoverTokens(dai.address, { from: accounts[0] });
        const finalBalance = new BN((await dai.balanceOf.call(accounts[0])).toString());
        finalBalance.sub(initialBalance).should.bignumber.equal(1000);
    });
});
