import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";

import {
    DaiTokenInstance, DEXAdapterInstance, DEXInstance, DEXReserveInstance, ERC20Instance,
    ERC20ShiftedInstance, ShifterInstance, ShifterRegistryInstance, TestTokenInstance,
} from "../types/truffle-contracts";
import { NULL } from "./helper/testUtils";

const TestToken = artifacts.require("TestToken");
const DAI = artifacts.require("DaiToken");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");
const Shifter = artifacts.require("Shifter");
const DEXReserve = artifacts.require("DEXReserve");
const DEX = artifacts.require("DEX");
const DEXAdapter = artifacts.require("DEXAdapter");
const ShifterRegistry = artifacts.require("ShifterRegistry");

contract("DEXAdapter", (accounts) => {
    let dai: DaiTokenInstance;
    let shifter1: ShifterInstance;
    let shifter2: ShifterInstance;
    let zToken1: ERC20ShiftedInstance;
    let zToken2: ERC20ShiftedInstance;
    let token3: TestTokenInstance;
    let dexReserve1: DEXReserveInstance;
    let dexReserve2: DEXReserveInstance;
    let dexReserve3: DEXReserveInstance;
    let dex: DEXInstance;
    let dexAdapter: DEXAdapterInstance;
    let shifterRegistry: ShifterRegistryInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority;
    let privKey;
    const feeRecipient = accounts[1];
    const randomAddress = accounts[7];

    const shifterFees = new BN(5);
    const dexFees = new BN(10);
    const zBTCMinShiftOutAmount = new BN(10000);
    const zZECMinShiftOutAmount = new BN(10000);

    const deadline = 10000000000000;

    before(async () => {
        mintAuthority = web3.eth.accounts.create();
        privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex")

        dai = await DAI.new();
        zToken1 = await zBTC.new();
        shifter1 = await Shifter.new(zToken1.address, feeRecipient, mintAuthority.address, shifterFees, zBTCMinShiftOutAmount);
        await zToken1.transferOwnership(shifter1.address);
        await shifter1.claimTokenOwnership();

        zToken2 = await zZEC.new();
        shifter2 = await Shifter.new(zToken2.address, feeRecipient, mintAuthority.address, shifterFees, zZECMinShiftOutAmount);
        await zToken2.transferOwnership(shifter2.address);
        await shifter2.claimTokenOwnership();

        token3 = await TestToken.new("TestToken1", "TST", 18);

        dexReserve1 = await DEXReserve.new(dai.address, zToken1.address, dexFees);
        dexReserve2 = await DEXReserve.new(dai.address, zToken2.address, dexFees);
        dexReserve3 = await DEXReserve.new(dai.address, token3.address, dexFees);

        dex = await DEX.new(dai.address);
        await dex.registerReserve(zToken1.address, dexReserve1.address);
        await dex.registerReserve(zToken2.address, dexReserve2.address);
        await dex.registerReserve(token3.address, dexReserve3.address);

        shifterRegistry = await ShifterRegistry.new();
        await shifterRegistry.setShifter(zToken1.address, shifter1.address);
        await shifterRegistry.setShifter(zToken2.address, shifter2.address);

        dexAdapter = await DEXAdapter.new(dex.address, shifterRegistry.address);

        // Add liquidity to token3's reserve.
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(20000000000);
        await shiftToReserve(daiValue, tokenValue, token3, dexReserve3);
    });

    const removeFee = (value: BN, bips: BN | number) => value.sub(value.mul(new BN(bips)).div(new BN(10000)))

    const shiftToReserve = async (baseValue: BN, tokenValue: BN, token: ERC20Instance, reserve: DEXReserveInstance) => {
        await dai.approve(reserve.address, baseValue);

        const shifter = await shifterRegistry.getShifterByToken(token.address);
        if (shifter === NULL) {
            await token.approve(reserve.address, removeFee(tokenValue, shifterFees));
            await reserve.addLiquidity(accounts[0], baseValue, removeFee(tokenValue, shifterFees), deadline);
        } else {
            const nHash = `0x${randomBytes(32).toString("hex")}`;
            const pHash = await dexAdapter.hashLiquidityPayload.call(accounts[0], baseValue, token.address, deadline, "0x002002002");
            // const types = ["address", "uint256", "address", "uint256", "uint256", "bytes"];
            // const pHash = web3.utils.keccak256(web3.eth.abi.encodeParameters(types, [accounts[0], value.toString(), token.address, value.toString(), deadline, "0x002002002"]));
            const hash = await (await Shifter.at(shifter)).hashForSignature.call(pHash, tokenValue, dexAdapter.address, nHash);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
            const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
            await dexAdapter.addLiquidity(accounts[0], baseValue, token.address, deadline, "0x002002002", tokenValue, nHash, sigString);
        }
    };

    const shiftToReserveExpired = async (value: BN, token: ERC20Instance, reserve: DEXReserveInstance, shifter: ShifterInstance) => {
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = await dexAdapter.hashLiquidityPayload.call(accounts[0], value, token.address, 0, "0x002002002");
        // const types = ["address", "uint256", "address", "uint256", "uint256", "bytes"];
        // const pHash = web3.utils.keccak256(web3.eth.abi.encodeParameters(types, [accounts[0], value.toString(), token.address, value.toString(), 0, "0x002002002"]));
        const hash = await shifter.hashForSignature.call(pHash, value, dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dai.approve(reserve.address, value);
        await dexAdapter.addLiquidity(accounts[0], value, token.address, 0, "0x002002002", value, nHash, sigString);
    };

    const removeShiftedLiquidity = async (token: ERC20Instance, reserve: DEXReserveInstance) => {
        const liquidity = await reserve.balanceOf.call(accounts[0]);
        await reserve.approve(dexAdapter.address, liquidity);
        await dexAdapter.removeLiquidity(token.address, liquidity, "0x0011001100110011");
    }

    const tradeShiftedTokensExpired = async (srcToken: ERC20Instance, srcShifter: ShifterInstance, dstToken: ERC20Instance) => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(22500);
        const commitment = await dexAdapter.hashTradePayload.call(
            srcToken.address, dstToken.address, 0, accounts[3],
            0, "0x010101010101",
        );
        const hash = await srcShifter.hashForSignature.call(commitment, value, dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        const reserve = await dex.reserves.call(dstToken.address);
        const initialBalance = new BN((await dstToken.balanceOf.call(reserve)).toString());
        await dexAdapter.trade(
            // Payload:
            srcToken.address, dstToken.address, 0, accounts[3],
            0, "0x010101010101",
            // Required
            value, nHash, sigString,
        );
        const finalBalance = new BN((await dstToken.balanceOf.call(reserve)).toString());
        initialBalance.sub(finalBalance).should.bignumber.equal(0);
    }

    const tradeShiftedTokens = async (srcToken: ERC20Instance, dstToken: ERC20Instance) => {
        let amount, sigString;
        const value = new BN(22500);
        const nHash = `0x${randomBytes(32).toString("hex")}`

        const shifter = await shifterRegistry.getShifterByToken(srcToken.address);
        if (shifter === NULL) {
            amount = await dexAdapter.calculateReceiveAmount.call(srcToken.address, dstToken.address, value);
            await srcToken.approve(dexAdapter.address, value);
            sigString = `0x${randomBytes(32).toString("hex")}`;
        } else {
            amount = await dexAdapter.calculateReceiveAmount.call(srcToken.address, dstToken.address, removeFee(value, shifterFees));

            const commitment = await dexAdapter.hashTradePayload.call(
                srcToken.address, dstToken.address, 0, accounts[3],
                100000, "0x010101010101",
            );

            const hash = await (await Shifter.at(shifter)).hashForSignature.call(commitment, value, dexAdapter.address, nHash);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
            sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        }

        // Get balances before
        const srcReserve = await dex.reserves.call(srcToken.address);
        const dstReserve = await dex.reserves.call(dstToken.address);
        // Src Reserve
        const srcReserveSrcBalanceBefore = new BN((await srcToken.balanceOf.call(srcReserve)).toString());
        const srcReserveBaseBalanceBefore = new BN((await dai.balanceOf.call(srcReserve)).toString());
        const srcReserveDstBalanceBefore = new BN((await dstToken.balanceOf.call(srcReserve)).toString());
        // Dst Reserve
        const dstReserveDstBalanceBefore = new BN((await dstToken.balanceOf.call(dstReserve)).toString());
        const dstReserveBaseBalanceBefore = new BN((await dai.balanceOf.call(dstReserve)).toString());
        const dstReserveSrcBalanceBefore = new BN((await srcToken.balanceOf.call(dstReserve)).toString());

        { // Perform trade
            await dexAdapter.trade(
                // Payload:
                srcToken.address, dstToken.address, 0, accounts[3],
                100000, "0x010101010101",
                // Required
                value, nHash, sigString,
            );
        }

        // Get balances after
        // Src Reserve
        const srcReserveSrcBalanceAfter = new BN((await srcToken.balanceOf.call(srcReserve)).toString());
        const srcReserveBaseBalanceAfter = new BN((await dai.balanceOf.call(srcReserve)).toString());
        const srcReserveDstBalanceAfter = new BN((await dstToken.balanceOf.call(srcReserve)).toString());
        // Dst Reserve
        const dstReserveDstBalanceAfter = new BN((await dstToken.balanceOf.call(dstReserve)).toString());
        const dstReserveBaseBalanceAfter = new BN((await dai.balanceOf.call(dstReserve)).toString());
        const dstReserveSrcBalanceAfter = new BN((await srcToken.balanceOf.call(dstReserve)).toString());

        if (srcReserve !== NULL && dstReserve !== NULL) {
            // If the trade goes across two reserves, check that the base
            // token's amount has changed by the same value across both.
            srcReserveBaseBalanceBefore.sub(srcReserveBaseBalanceAfter).should.bignumber.gt(0);
            dstReserveBaseBalanceAfter.sub(dstReserveBaseBalanceBefore).should.bignumber.equal(srcReserveBaseBalanceBefore.sub(srcReserveBaseBalanceAfter));
        }

        if (srcReserve !== NULL) {
            // Check that the src reserve's balances have changed correctly.
            let expectedSrcDifference = shifter === NULL ? value : removeFee(value, shifterFees);
            srcReserveSrcBalanceAfter.sub(srcReserveSrcBalanceBefore).should.bignumber.equal(expectedSrcDifference);
            if (dstReserve === NULL) {
                srcReserveDstBalanceBefore.sub(srcReserveDstBalanceAfter).should.bignumber.equal(amount);
            }
        }

        if (dstReserve !== NULL) {
            // Check that the dst reserve's balances have changed correctly.
            dstReserveDstBalanceBefore.sub(dstReserveDstBalanceAfter).should.bignumber.equal(amount);
            if (srcReserve === NULL) {
                dstReserveSrcBalanceAfter.sub(dstReserveSrcBalanceBefore).should.bignumber.equal(value);
            }
        }
    }

    it("should fail when trying to trade dai to token1 on DEX before funding the reserve", async () => {
        const value = new BN(225000);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dai.approve(dexAdapter.address, value);
        await dexAdapter.trade(
            // Payload:
            dai.address, zToken1.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value, nHash, pHash,
        ).should.be.rejectedWith(/reserve has no funds/);
    });

    it("should fail when trying to trade token1 to dai on DEX before funding the reserve", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(22500);
        const commitment = await dexAdapter.hashTradePayload.call(
            zToken1.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature.call(commitment, value, dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            zToken1.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
            // Required
            value, nHash, sigString,
        ).should.be.rejectedWith(/reserve has no funds/);
    });

    it("should fail to overwrite an existing reserve", async () => {
        await dex.registerReserve(zToken1.address, accounts[3]).should.be.rejectedWith(/token reserve already registered/);
    });

    it("should fail to calculate the base token value", async () => {
        const value = new BN(20000000000);
        await dexReserve1.calculateBaseTokenValue(value).should.be.rejectedWith(/division by zero/);
    });

    it("should fail to calculate the base token value", async () => {
        const value = new BN(20000000000);
        await dexReserve1.calculateQuoteTokenValue(value).should.be.rejectedWith(/division by zero/);
    });

    it("should fail to trade unsupported tokens", async () => {
        await dex.trade(accounts[0], dai.address, randomAddress, 1000).should.be.rejectedWith(/unsupported token/);
    });

    it("should fail to trade unsupported tokens", async () => {
        await dex.trade(accounts[0], randomAddress, dai.address, 1000).should.be.rejectedWith(/unsupported token/);
    });

    it("should fail to trade unsupported tokens", async () => {
        await dex.trade(accounts[0], randomAddress, randomAddress, 1000).should.be.rejectedWith(/unsupported token/);
    });

    it("should fail to add liquidity unsupported tokens", async () => {
        await dexAdapter.addLiquidity(accounts[0], 0, randomAddress, 10000000, "0x20220200202020", 1000, `0x${randomBytes(32).toString("hex")}`, "0x0000").should.be.rejectedWith(/unsupported token/);
    });

    it("should fail to remove liquidity unsupported tokens", async () => {
        await dexAdapter.removeLiquidity(randomAddress, 0, "0x22020202020020202").should.be.rejectedWith(/unsupported token/);
    });

    it("should deposit token1 to the reserve1", async () => {
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(30000000000);
        await shiftToReserve(daiValue, tokenValue, zToken1, dexReserve1);
    });

    it("should deposit token2 to the reserve2", async () => {
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(15000000000);
        await shiftToReserve(daiValue, tokenValue, zToken2, dexReserve2);
    });

    it("should fail to deposit token1 to the reserve1 after expiry", async () => {
        const value = new BN(20000000000);
        await shiftToReserveExpired(value, zToken1, dexReserve1, shifter1);
    });

    it("should fail to deposit token2 to the reserve2 after expiry", async () => {
        const value = new BN(20000000000);
        await shiftToReserveExpired(value, zToken2, dexReserve2, shifter2);
    });

    it("should deposit token1 to the reserve1 when it has liquidity", async () => {
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(30000000000);
        await shiftToReserve(daiValue, tokenValue, zToken1, dexReserve1);
    });

    it("should deposit token2 to the reserve2 when it has liquidity", async () => {
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(15000000000);
        await shiftToReserve(daiValue, tokenValue, zToken2, dexReserve2);
    });

    it("should trade dai to token1 on DEX", async () => tradeShiftedTokens(dai, zToken1));
    it("should trade dai to token2 on DEX", async () => tradeShiftedTokens(dai, zToken2));
    it("should trade token1 to token2 on DEX", async () => tradeShiftedTokens(zToken1, zToken2));
    it("should trade token2 to token1 on DEX", async () => tradeShiftedTokens(zToken2, zToken1));
    it("should trade token1 to dai on DEX", async () => tradeShiftedTokens(zToken1, dai));
    it("should trade token2 to dai on DEX", async () => tradeShiftedTokens(zToken2, dai));
    it("should trade token2 to token3 on DEX", async () => tradeShiftedTokens(zToken2, token3));
    it("should trade token3 to token2 on DEX", async () => tradeShiftedTokens(token3, zToken2));
    it("should trade token1 to token3 on DEX", async () => tradeShiftedTokens(zToken1, token3));
    it("should trade token3 to token1 on DEX", async () => tradeShiftedTokens(token3, zToken1));

    it("should fail to trade token1 to dai on DEX after expiry", async () => {
        await tradeShiftedTokensExpired(zToken1, shifter1, dai)
    });

    it("should fail to trade token2 to dai on DEX after expiry", async () => {
        await tradeShiftedTokensExpired(zToken2, shifter2, dai)
    });

    it("should fail to trade token1 to token3 on DEX after expiry", async () => {
        await tradeShiftedTokensExpired(zToken1, shifter1, token3)
    });

    it("should fail to trade token2 to token3 on DEX after expiry", async () => {
        await tradeShiftedTokensExpired(zToken2, shifter2, token3)
    });

    it("should withdraw dai and token1 from the reserve1", async () => await removeShiftedLiquidity(zToken1, dexReserve1));
    it("should withdraw dai and token2 from the reserve2", async () => await removeShiftedLiquidity(zToken2, dexReserve2));

    it("should be able to withdraw funds that are mistakenly sent to dex adapter", async () => {
        await dai.transfer(dexAdapter.address, 1000);
        const initialBalance = new BN((await dai.balanceOf.call(accounts[1])).toString());
        await dexAdapter.recoverTokens(dai.address, { from: accounts[1] });
        const finalBalance = new BN((await dai.balanceOf.call(accounts[1])).toString());
        finalBalance.sub(initialBalance).should.bignumber.equal(1000);
    });
});