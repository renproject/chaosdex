import BN from "bn.js";
import BigNumber from "bignumber.js";

import {
    DaiTokenInstance, DEXInstance, DEXReserveInstance, ERC20Instance, RenTokenInstance,
    TestTokenInstance,
} from "../types/truffle-contracts";
import { advanceBlocks, NULL } from "./helper/testUtils";

const TestToken = artifacts.require("TestToken");
const DAI = artifacts.require("DaiToken");
const DEXReserve = artifacts.require("DEXReserve");
const Ren = artifacts.require("RenToken");
const DEX = artifacts.require("DEX");

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

    it("can't deposit without approving base token", async () => {
        const value = new BN(20000000000);
        await token3.approve(dexReserve3.address, value);
        await dexReserve3.addLiquidity(accounts[0], value, value, deadline).should.be.rejectedWith(/SafeERC20: low-level call failed/);
    });

    it("can't deposit without approving quote token", async () => {
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

contract("DEXReserve - share token", (accounts) => {
    let dai: DaiTokenInstance;
    let token: TestTokenInstance;
    let reserve: DEXReserveInstance;
    let dex: DEXInstance;

    const dexFees = new BN(10);

    const deadline = 10000000000000;

    before(async () => {
        dai = await DAI.new();
        token = await TestToken.new("TestToken1", "TST", 18);
        reserve = await DEXReserve.new("Token Liquidity Token", "TOKLT", 18, dai.address, token.address, dexFees);

        dex = await DEX.new(dai.address);
        await dex.registerReserve(token.address, reserve.address);

        for (const account of [accounts[1], accounts[2], accounts[3]]) {
            await dai.transfer(account, new BN(2000000000));
            await token.transfer(account, new BN(30000000000));
        }
    });

    const depositToReserve = async (from: string, tokenValue: BN, baseValue?: BN) => {
        baseValue = baseValue || new BN(await reserve.expectedBaseTokenAmount(tokenValue));

        await dai.approve(reserve.address, baseValue, { from });
        await token.approve(reserve.address, tokenValue, { from });
        await reserve.addLiquidity(from, baseValue, tokenValue, deadline, { from });

        return baseValue.mul(new BN(100)).div(new BN(await dai.balanceOf(reserve.address)));
    };

    const withdrawFromReserve = async (from: string, amount: BN): Promise<{ tokenBalance: string, daiBalance: string }> => {
        const tokenBalanceBefore = new BN(await token.balanceOf(from));
        const daiBalanceBefore = new BN(await dai.balanceOf(from));
        await reserve.removeLiquidity(amount, { from });
        const tokenBalanceAfter = new BN(await token.balanceOf(from));
        const daiBalanceAfter = new BN(await dai.balanceOf(from));
        return { tokenBalance: new BN(tokenBalanceAfter.sub(tokenBalanceBefore)).toString(), daiBalance: new BN(daiBalanceAfter.sub(daiBalanceBefore)).toString() };
    };

    const tradeTokens = async (srcToken: ERC20Instance, dstToken: ERC20Instance, srcValue: BN) => {
        const srcReserve = await dex.reserves.call(srcToken.address);
        const dstReserve = await dex.reserves.call(dstToken.address);

        await srcToken.approve(srcReserve === NULL ? dstReserve : srcReserve, srcValue);

        await dex.trade(
            accounts[0], srcToken.address, dstToken.address, srcValue,
        );
    }

    const share = async (from: string) => {
        return new BN(await reserve.balanceOf(from)).mul(new BN(100)).div(new BN(await reserve.totalSupply()));
    }

    it("liquidity token should be fair", async () => {
        const tokenProportion1 = await depositToReserve(accounts[1], new BN(15000000000) /* token1 */, new BN(200000000) /* DAI */);
        (await share(accounts[1])).should.bignumber.equal(tokenProportion1);
        const tokenProportion2 = await depositToReserve(accounts[2], new BN(15000000000) /* token1 */);
        (await share(accounts[2])).should.bignumber.equal(tokenProportion2);

        const newTokenProportion1 = tokenProportion1.mul(new BN(100).sub(tokenProportion2)).div(new BN(100));
        (await share(accounts[1])).should.bignumber.equal(newTokenProportion1);

        // await tradeTokens(token, dai, new BN(15000000000));
        await tradeTokens(dai, token, new BN(400000000));

        (await share(accounts[1])).should.bignumber.equal(newTokenProportion1);
        (await share(accounts[2])).should.bignumber.equal(tokenProportion2);

        const tokenProportion3 = await depositToReserve(accounts[3], new BN(15000000000) /* token1 */);
        (await share(accounts[3])).should.bignumber.equal(tokenProportion3);

        const newNewTokenProportion1 = newTokenProportion1.mul(new BN(100).sub(tokenProportion3)).div(new BN(100));
        const newTokenProportion2 = tokenProportion2.mul(new BN(100).sub(tokenProportion3)).div(new BN(100));

        (await share(accounts[1])).should.bignumber.equal(newNewTokenProportion1);
        (await share(accounts[2])).should.bignumber.equal(newTokenProportion2);

        // Do a few more trades
        await tradeTokens(token, dai, new BN(100000000));
        await tradeTokens(token, dai, new BN(40000000));
        await tradeTokens(dai, token, new BN(200000000));

        (await share(accounts[1])).should.bignumber.equal(newNewTokenProportion1);
        (await share(accounts[2])).should.bignumber.equal(newTokenProportion2);
        (await share(accounts[3])).should.bignumber.equal(tokenProportion3);

        const totalTokenBalance = new BN(await token.balanceOf(reserve.address));
        const totalDaiBalance = new BN(await dai.balanceOf(reserve.address));

        // .should.bignumber.equal(15367680000);
        {
            const { daiBalance, tokenBalance } = (await withdrawFromReserve(accounts[1], new BN(await reserve.balanceOf(accounts[1]))));
            isApproximately(daiBalance, totalDaiBalance.mul(newNewTokenProportion1).div(new BN(100)));
            isApproximately(tokenBalance, totalTokenBalance.mul(newNewTokenProportion1).div(new BN(100)));
        }
        {
            const { daiBalance, tokenBalance } = (await withdrawFromReserve(accounts[2], new BN(await reserve.balanceOf(accounts[2]))));
            isApproximately(daiBalance, totalDaiBalance.mul(newTokenProportion2).div(new BN(100)));
            isApproximately(tokenBalance, totalTokenBalance.mul(newTokenProportion2).div(new BN(100)));
        }
        {
            const { daiBalance, tokenBalance } = (await withdrawFromReserve(accounts[3], new BN(await reserve.balanceOf(accounts[3]))));
            isApproximately(daiBalance, totalDaiBalance.mul(tokenProportion3).div(new BN(100)));
            isApproximately(tokenBalance, totalTokenBalance.mul(tokenProportion3).div(new BN(100)));
        }

        (await token.balanceOf(reserve.address)).toString();
    });
});

const isApproximately = (actual: BN | string | number, expected: BN | string | number) => {
    actual.should.bignumber.least(expected);
    actual.should.bignumber.most(new BN(expected).mul(new BN(105)).div(new BN(100)));
}