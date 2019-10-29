import BN from "bn.js";

import {
    DaiTokenInstance, DEXReserveInstance, ERC20Instance, RenTokenInstance, TestTokenInstance,
} from "../types/truffle-contracts";
import { advanceBlocks } from "./helper/testUtils";

const TestToken = artifacts.require("TestToken");
const DAI = artifacts.require("DaiToken");
const DEXReserve = artifacts.require("DEXReserve");
const Ren = artifacts.require("RenToken");

contract("DEXReserve", (accounts) => {
    let dai: DaiTokenInstance;
    let token3: TestTokenInstance;
    let dexReserve3: DEXReserveInstance;
    let ren: RenTokenInstance;

    const dexFees = new BN(10);

    const deadline = 10000000000000;

    before(async () => {
        dai = await DAI.new();
        token3 = await TestToken.new("TestToken1", "TST", 18);
        dexReserve3 = await DEXReserve.new("TesrToken1 Liquidity Token", "TSTLT", 18, dai.address, token3.address, dexFees);
        ren = await Ren.new();
    });

    const depositToReserve = async (baseValue: BN, tokenValue: BN, token: ERC20Instance, reserve: DEXReserveInstance) => {
        await dai.approve(reserve.address, baseValue);
        await token.approve(reserve.address, tokenValue);
        await reserve.addLiquidity(accounts[0], baseValue, tokenValue, deadline);
    };

    const depositToReserveExpired = async (value: BN, token: ERC20Instance, reserve: DEXReserveInstance) => {
        await dai.approve(reserve.address, value);
        await token.approve(reserve.address, value);
        await reserve.addLiquidity(accounts[0], value, value, 0).should.be.rejectedWith(/addLiquidity request expired/);
    };

    const withdrawFromReserve = async (reserve: DEXReserveInstance) => {
        const liquidity = await reserve.balanceOf.call(accounts[0]);
        await reserve.removeLiquidity(liquidity);
    }

    const maliciousWithdrawFromReserve = async (reserve: DEXReserveInstance) => {
        const liquidity = await reserve.balanceOf.call(accounts[0]);
        await reserve.removeLiquidity(liquidity, { from: accounts[1] }).should.be.rejectedWith(/insufficient balance/);
    }

    it("should fail to calculate the base token value", async () => {
        const value = new BN(20000000000);
        await dexReserve3.calculateBaseTokenValue(value).should.be.rejectedWith(/division by zero/);
    });

    it("should fail to calculate the base token value", async () => {
        const value = new BN(20000000000);
        await dexReserve3.calculateQuoteTokenValue(value).should.be.rejectedWith(/division by zero/);
    });

    it("should deposit token3 to the reserve3", async () => {
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(20000000000);
        await depositToReserve(daiValue, tokenValue, token3, dexReserve3);
    });

    it("should deposit token3 to the reserve3", async () => {
        const value = new BN(20000000000);
        await token3.approve(dexReserve3.address, value);
        await dexReserve3.addLiquidity(accounts[0], value, value, deadline).should.be.rejectedWith(/SafeERC20: low-level call failed/);
    });

    it("should deposit token3 to the reserve3", async () => {
        const value = new BN(20000000000);
        await dai.approve(dexReserve3.address, value);
        await dexReserve3.addLiquidity(accounts[0], value, 0, deadline).should.be.rejectedWith(/token amount is less than allowed min amount/);
    });

    it("should deposit token3 to the reserve3 when it has liquidity", async () => {
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(20000000000);
        await depositToReserve(daiValue, tokenValue, token3, dexReserve3);
    });

    it("should deposit token3 to the reserve3 when it has liquidity", async () => {
        const value = new BN(20000000000);
        await depositToReserveExpired(value, token3, dexReserve3);
    });

    it("should not withdraw dai and token3 from the reserve3 if the user does not have liquidity tokens", async () => await maliciousWithdrawFromReserve(dexReserve3));

    it("should withdraw dai and token3 from the reserve3", async () => await withdrawFromReserve(dexReserve3));

    it("should be able to withdraw funds that are mistakenly sent to dex reserve", async () => {
        await dai.transfer(dexReserve3.address, 1000);
        await ren.transfer(dexReserve3.address, 1000);

        const initialDaiBalance = new BN((await dai.balanceOf.call(accounts[0])).toString());
        const initialTokenBalance = new BN((await ren.balanceOf.call(accounts[0])).toString());

        // Can't recover DAI
        await dexReserve3.recoverTokens(dai.address, { from: accounts[0] })
            .should.be.rejectedWith(/not allowed to recover reserve tokens/);

        // Can't recover quote token
        await dexReserve3.recoverTokens(token3.address, { from: accounts[0] })
            .should.be.rejectedWith(/not allowed to recover reserve tokens/);

        // Only the owner can recover tokens
        await dexReserve3.recoverTokens(ren.address, { from: accounts[1] })
            .should.be.rejectedWith(/caller is not the owner/);

        // Can recover unrelated token
        await dexReserve3.recoverTokens(ren.address, { from: accounts[0] });
        const finalDaiBalance = new BN((await dai.balanceOf.call(accounts[0])).toString());
        const finalTokenBalance = new BN((await ren.balanceOf.call(accounts[0])).toString());
        finalDaiBalance.should.bignumber.equal(initialDaiBalance);
        finalTokenBalance.sub(initialTokenBalance).should.bignumber.equal(1000);
    });

    it("should be able to change the reserve fees as the owner", async () => {
        const fee = await dexReserve3.feeInBIPS();

        // Fee is too high
        await dexReserve3.updateFee(1000)
            .should.be.rejectedWith(/fee must not exceed hard-coded limit/);

        // Signal fee update
        await dexReserve3.updateFee(0);

        // Before waiting 100 blocks
        await dexReserve3.updateFee(0)
            .should.be.rejectedWith(/must wait 100 blocks before updating the fee/);
        (await dexReserve3.feeInBIPS()).should.bignumber.equal(fee);

        // Wait 100 blocks
        await advanceBlocks(100);
        (await dexReserve3.feeInBIPS()).should.bignumber.equal(fee);
        await dexReserve3.updateFee(0);
        (await dexReserve3.feeInBIPS()).should.bignumber.equal(0);

        await dexReserve3.updateFee(1, { from: accounts[1] })
            .should.be.rejectedWith(/caller is not the owner/);
    })
});
