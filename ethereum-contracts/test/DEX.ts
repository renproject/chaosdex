import BN from "bn.js";

import {
    DaiTokenInstance, DEXInstance, DEXReserveInstance, ERC20Instance, TestTokenInstance,
} from "../types/truffle-contracts";
import "./helper/testUtils";

const TestToken = artifacts.require("TestToken");
const DAI = artifacts.require("DaiToken");
const DEXReserve = artifacts.require("DEXReserve");
const DEX = artifacts.require("DEX");

contract("DEX", (accounts) => {
    let dai: DaiTokenInstance;
    let token3: TestTokenInstance;
    let dexReserve3: DEXReserveInstance;
    let dex: DEXInstance;

    const randomAddress = accounts[7];

    const dexFees = new BN(10);

    const deadline = 10000000000000;

    before(async () => {
        dai = await DAI.new();
        token3 = await TestToken.new("TestToken1", "TST", 18);
        dexReserve3 = await DEXReserve.new(dai.address, token3.address, dexFees);
        dex = await DEX.new(dai.address);
        await dex.registerReserve(token3.address, dexReserve3.address);

        await depositToReserve(new BN(20000000000) /* DAI */, new BN(20000000000) /* token3 */, token3, dexReserve3);
    });

    const depositToReserve = async (baseValue: BN, tokenValue: BN, token: ERC20Instance, reserve: DEXReserveInstance) => {
        await dai.approve(reserve.address, baseValue);
        await token.approve(reserve.address, tokenValue);
        await reserve.addLiquidity(accounts[0], baseValue, tokenValue, deadline);
    };

    const tradeTokens = async (srcToken: ERC20Instance, dstToken: ERC20Instance) => {
        const value = new BN(225000);
        const reserve = await dex.reserves.call(dstToken.address);
        const amount = await dex.calculateReceiveAmount.call(srcToken.address, dstToken.address, value);
        await srcToken.approve(reserve, value);
        const initialBalance = new BN((await dstToken.balanceOf.call(reserve)).toString());
        await dex.trade(
            accounts[0], srcToken.address, dstToken.address, value,
        );
        const finalBalance = new BN((await dstToken.balanceOf.call(reserve)).toString());
        initialBalance.sub(finalBalance).should.bignumber.equal(amount);
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

    it("should trade dai to token3 on DEX", async () => {
        await tradeTokens(dai, token3);
    });

    it("should be able to withdraw funds that are mistakenly sent to dex", async () => {
        await dai.transfer(dex.address, 1000);
        const initialBalance = new BN((await dai.balanceOf.call(accounts[0])).toString());
        await dex.recoverTokens(dai.address, { from: accounts[0] });
        const finalBalance = new BN((await dai.balanceOf.call(accounts[0])).toString());
        finalBalance.sub(initialBalance).should.bignumber.equal(1000);
    });
});
