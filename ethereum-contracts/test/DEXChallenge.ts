import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecrecover, ecsign, pubToAddress } from "ethereumjs-util";
import { Account } from "web3/eth/accounts";

import {
    DaiTokenInstance, DEXAdapterInstance, DEXChallengeInstance, DEXInstance, DEXReserveInstance, ERC20Instance,
    ERC20ShiftedInstance, ShifterInstance, ShifterRegistryInstance, TestTokenInstance,
} from "../types/truffle-contracts";
import { Ox, NULL, randomBytesString } from "./helper/testUtils";
import { log } from "./helper/logs";

const TestToken = artifacts.require("TestToken");
const DAI = artifacts.require("DaiToken");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");
const Shifter = artifacts.require("Shifter");
const DEXReserve = artifacts.require("DEXReserve");
const DEXChallenge = artifacts.require("DEXChallenge");
const DEX = artifacts.require("DEX");
const DEXAdapter = artifacts.require("DEXAdapter");
const ShifterRegistry = artifacts.require("ShifterRegistry");

contract.only("DEXChallenge", (accounts) => {
    let dai: DaiTokenInstance;
    let shifter1: ShifterInstance;
    let shifter2: ShifterInstance;
    let zBtcToken: ERC20ShiftedInstance;
    let zZecToken: ERC20ShiftedInstance;
    let token3: TestTokenInstance;
    let dexReserve1: DEXReserveInstance;
    let dexReserve2: DEXReserveInstance;
    let dexReserve3: DEXReserveInstance;
    let dex: DEXInstance;
    let dexAdapter: DEXAdapterInstance;
    let shifterRegistry: ShifterRegistryInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority: Account;
    let privKey: Buffer;
    const feeRecipient = accounts[1];
    const randomAddress = accounts[7];

    const shiftInFees = new BN(5);
    const shiftOutFees = new BN(15);
    const dexFees = new BN(10);
    const zBTCMinShiftOutAmount = new BN(10000);
    const zZECMinShiftOutAmount = new BN(10000);

    const deadline = 10000000000000;

    const fundBtc = async (challenge: DEXChallengeInstance, value: number | BN, shiftID?: string) => {
        value = new BN(value);
        const nHash = randomBytesString(32);
        const pHash = NULL; // randomBytesString(32);

        const user = challenge.address;
        const hash = await shifter1.hashForSignature.call(pHash, value, user, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
            .should.equal(mintAuthority.address.slice(2).toLowerCase());

        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const hashForSignature = await shifter1.hashForSignature.call(pHash, value, user, nHash);
        (await shifter1.verifySignature.call(hashForSignature, sigString))
            .should.be.true;

        const balanceBefore = new BN((await zBtcToken.balanceOf.call(user)).toString());
        (await challenge.fundBTC(value, nHash, sigString) as any);
        (await zBtcToken.balanceOf.call(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, shiftInFees)));
        return [pHash, nHash];
    };

    const fundZec = async (challenge: DEXChallengeInstance, value: number | BN, shiftID?: string) => {
        value = new BN(value);
        const nHash = randomBytesString(32);
        const pHash = NULL; // randomBytesString(32);

        const user = challenge.address;
        const hash = await shifter2.hashForSignature.call(pHash, value, user, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
            .should.equal(mintAuthority.address.slice(2).toLowerCase());

        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const hashForSignature = await shifter2.hashForSignature.call(pHash, value, user, nHash);
        (await shifter2.verifySignature.call(hashForSignature, sigString))
            .should.be.true;

        const balanceBefore = new BN((await zZecToken.balanceOf.call(user)).toString());
        (await challenge.fundZEC(value, nHash, sigString) as any);
        (await zZecToken.balanceOf.call(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, shiftInFees)));
        return [pHash, nHash];
    };

    const mintTest = async (user: string, token: { balanceOf: any }, shifter: ShifterInstance, value: number | BN, shiftID?: string) => {
        value = new BN(value);
        const nHash = randomBytesString(32);
        const pHash = randomBytesString(32);

        const hash = await shifter.hashForSignature.call(pHash, value, user, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
            .should.equal(mintAuthority.address.slice(2).toLowerCase());

        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const hashForSignature = await shifter.hashForSignature.call(pHash, value, user, nHash);
        (await shifter.verifySignature.call(hashForSignature, sigString))
            .should.be.true;

        const balanceBefore = new BN((await token.balanceOf.call(user)).toString());
        const _shiftID = await shifter.nextShiftID.call();
        (await shifter.shiftIn(pHash, value, nHash, sigString, { from: user }) as any)
            .should.emit.logs([
                log(
                    "LogShiftIn",
                    {
                        _to: user,
                        _amount: removeFee(value, shiftInFees),
                        _shiftID: shiftID !== undefined ? shiftID : _shiftID,
                    },
                ),
            ]);
        (await token.balanceOf.call(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, shiftInFees)));

        return [pHash, nHash];
    };

    before(async () => {
        mintAuthority = web3.eth.accounts.create();
        privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex")

        dai = await DAI.new();
        zBtcToken = await zBTC.new();
        shifter1 = await Shifter.new(zBtcToken.address, feeRecipient, mintAuthority.address, shiftInFees, shiftOutFees, zBTCMinShiftOutAmount);
        await zBtcToken.transferOwnership(shifter1.address);
        await shifter1.claimTokenOwnership();

        zZecToken = await zZEC.new();
        shifter2 = await Shifter.new(zZecToken.address, feeRecipient, mintAuthority.address, shiftInFees, shiftOutFees, zZECMinShiftOutAmount);
        await zZecToken.transferOwnership(shifter2.address);
        await shifter2.claimTokenOwnership();

        token3 = await TestToken.new("TestToken1", "TST", 18);

        dexReserve1 = await DEXReserve.new("Bitcoin Liquidity Token", "BTCLT", 8, dai.address, zBtcToken.address, dexFees);
        dexReserve2 = await DEXReserve.new("ZCash Liquidity Token", "ZECLT", 8, dai.address, zZecToken.address, dexFees);
        dexReserve3 = await DEXReserve.new("TestToken1 Liquidity Token", "TSTLT", 18, dai.address, token3.address, dexFees);

        dex = await DEX.new(dai.address);
        await dex.registerReserve(zBtcToken.address, dexReserve1.address);
        await dex.registerReserve(zZecToken.address, dexReserve2.address);
        await dex.registerReserve(token3.address, dexReserve3.address);

        shifterRegistry = await ShifterRegistry.new();
        await shifterRegistry.setShifter(zBtcToken.address, shifter1.address);
        await shifterRegistry.setShifter(zZecToken.address, shifter2.address);

        dexAdapter = await DEXAdapter.new(dex.address, shifterRegistry.address);

        // Add liquidity to token3's reserve.
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(20000000000);
        await shiftToReserve(daiValue, tokenValue, token3, dexReserve3);
    });

    const removeFee = (value: BN, bips: BN | number) => value.sub(value.mul(new BN(bips)).div(new BN(10000)))

    const shiftToReserve = async (baseValue: BN, tokenValue: BN, token: ERC20Instance, reserve: DEXReserveInstance) => {
        await dai.approve(reserve.address, baseValue);

        const shifter = await shifterRegistry.getShifterByToken.call(token.address);
        if (shifter === NULL) {
            await token.approve(reserve.address, removeFee(tokenValue, shiftInFees));
            await reserve.addLiquidity(accounts[0], baseValue, removeFee(tokenValue, shiftInFees), deadline);
        } else {
            const nHash = `0x${randomBytes(32).toString("hex")}`;
            const pHash = await (dexAdapter.hashLiquidityPayload as any).call(accounts[0], baseValue, token.address, deadline, "0x002002002");
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
        const pHash = await (dexAdapter.hashLiquidityPayload as any).call(accounts[0], value, token.address, 0, "0x002002002");
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
        let receivingValue, sigString, receivingValueAfterFees;
        const recipient = accounts[3];
        const value = new BN(22500);
        const nHash = `0x${randomBytes(32).toString("hex")}`

        const dstShifter = await shifterRegistry.getShifterByToken.call(dstToken.address);
        const srcShifter = await shifterRegistry.getShifterByToken.call(srcToken.address);
        if (srcShifter === NULL) {
            receivingValue = new BN(await dex.calculateReceiveAmount.call(srcToken.address, dstToken.address, value));
            receivingValueAfterFees = await dexAdapter.calculateReceiveAmount.call(srcToken.address, dstToken.address, value);
            await srcToken.approve(dexAdapter.address, value);
            sigString = `0x${randomBytes(32).toString("hex")}`;
        } else {
            receivingValue = new BN(await dex.calculateReceiveAmount.call(srcToken.address, dstToken.address, removeFee(value, shiftInFees)));
            receivingValueAfterFees = await dexAdapter.calculateReceiveAmount.call(srcToken.address, dstToken.address, value);
            const commitment = await dexAdapter.hashTradePayload.call(
                srcToken.address, dstToken.address, 0, recipient,
                100000, "0x010101010101",
            );
            const srcShifterContract = await Shifter.at(srcShifter);
            const hash = await srcShifterContract.hashForSignature.call(commitment, value, dexAdapter.address, nHash);
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
        // Recipient
        const recipientDstBalanceBefore = new BN((await dstToken.balanceOf.call(recipient)).toString());

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
        // Recipient
        const recipientDstBalanceAfter = new BN((await dstToken.balanceOf.call(recipient)).toString());

        if (srcReserve !== NULL && dstReserve !== NULL) {
            // If the trade goes across two reserves, check that the base
            // token's amount has changed by the same value across both.
            srcReserveBaseBalanceBefore.sub(srcReserveBaseBalanceAfter).should.bignumber.gt(0);
            dstReserveBaseBalanceAfter.sub(dstReserveBaseBalanceBefore).should.bignumber.equal(srcReserveBaseBalanceBefore.sub(srcReserveBaseBalanceAfter));
        }

        if (srcReserve !== NULL) {
            // Check that the src reserve's balances have changed correctly.
            let expectedSrcDifference = srcShifter === NULL ? value : removeFee(value, shiftInFees);
            srcReserveSrcBalanceAfter.sub(srcReserveSrcBalanceBefore).should.bignumber.equal(expectedSrcDifference);
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

        // If the token is shifted, the receiving address would be off-chain.
        let expectedReceivedValue = dstShifter === NULL ? receivingValue : 0;
        recipientDstBalanceAfter.sub(recipientDstBalanceBefore).should.bignumber.equal(expectedReceivedValue);
    }

    it("can deploy a challenge contract", async () => {
        const challenge = await DEXChallenge.new(dexAdapter.address);
        (await challenge.btcAddr.call()).should.equal(zBtcToken.address);
        (await challenge.zecAddr.call()).should.equal(zZecToken.address);
    });

    it("can mint tokens", async () => {
        const user = accounts[4];
        const amount = new BN(100000);
        await mintTest(user, zBtcToken, shifter1, amount);
        const newBalance = new BN(await zBtcToken.balanceOf.call(user));
        removeFee(amount, shiftInFees).should.bignumber.equal(newBalance);
    });

    describe("when funding challenges", async () => {
        it("can add btc funds", async () => {
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const oldBalance = new BN(await zBtcToken.balanceOf.call(challenge.address));
            const amount = new BN(100000000);
            await fundBtc(challenge, amount);
            const newBalance = new BN(await zBtcToken.balanceOf.call(challenge.address));
            removeFee(amount, shiftInFees).should.bignumber.equal(newBalance);
            newBalance.gt(oldBalance).should.be.true;
            const btcRewardAmount = new BN(await challenge.btcRewardAmount.call());
            btcRewardAmount.should.bignumber.equal(newBalance);
        });

        it("can add zec funds", async () => {
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const oldBalance = new BN(await zZecToken.balanceOf.call(challenge.address));
            const amount = new BN(100000000);
            await fundZec(challenge, amount);
            const newBalance = new BN(await zZecToken.balanceOf.call(challenge.address));
            removeFee(amount, shiftInFees).should.bignumber.equal(newBalance);
            newBalance.gt(oldBalance).should.be.true;
            const zecRewardAmount = new BN(await challenge.zecRewardAmount.call());
            zecRewardAmount.should.bignumber.equal(newBalance);
        });
    });
});