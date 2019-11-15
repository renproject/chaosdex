import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecrecover, ecsign, pubToAddress } from "ethereumjs-util";
import { Account } from "web3/eth/accounts";

import {
    DaiTokenInstance, DEXAdapterInstance, DEXChallengeInstance, DEXInstance, DEXReserveInstance, ERC20Instance,
    ERC20ShiftedInstance, ShifterInstance, ShifterRegistryInstance, TestTokenInstance,
} from "../types/truffle-contracts";
import { Ox, NULL, randomBytes as randomBytesString } from "./helper/testUtils";
import { log } from "./helper/logs";

const TestToken = artifacts.require("ERC20Shifted");
const DAI = artifacts.require("DaiToken");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");
const Shifter = artifacts.require("Shifter");
const DEXReserve = artifacts.require("DEXReserve");
const DEXChallenge = artifacts.require("DEXChallenge");
const DEX = artifacts.require("DEX");
const DEXAdapter = artifacts.require("DEXAdapter");
const ShifterRegistry = artifacts.require("ShifterRegistry");

contract("DEXChallenge", (accounts) => {
    let dai: DaiTokenInstance;
    let btcShifter: ShifterInstance;
    let zecShifter: ShifterInstance;
    let zBtcToken: ERC20ShiftedInstance;
    let zZecToken: ERC20ShiftedInstance;
    let token3: ERC20ShiftedInstance;
    let token3Shifter: ShifterInstance;
    let btcReserve: DEXReserveInstance;
    let zecReserve: DEXReserveInstance;
    let testTokenReserve: DEXReserveInstance;
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
    const token3MinShiftOutAmount = new BN(10000);

    const deadline = 10000000000000;

    const fundBtc = async (challenge: DEXChallengeInstance, value: number | BN, shiftID?: string) => {
        value = new BN(value);
        const nHash = randomBytesString(32);
        const pHash = NULL; // randomBytesString(32);

        const user = challenge.address;
        const hash = await btcShifter.hashForSignature.call(pHash, value, user, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
            .should.equal(mintAuthority.address.slice(2).toLowerCase());

        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const hashForSignature = await btcShifter.hashForSignature.call(pHash, value, user, nHash);
        (await btcShifter.verifySignature.call(hashForSignature, sigString))
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
        const hash = await zecShifter.hashForSignature.call(pHash, value, user, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
            .should.equal(mintAuthority.address.slice(2).toLowerCase());

        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const hashForSignature = await zecShifter.hashForSignature.call(pHash, value, user, nHash);
        (await zecShifter.verifySignature.call(hashForSignature, sigString))
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
        btcShifter = await Shifter.new(zBtcToken.address, feeRecipient, mintAuthority.address, shiftInFees, shiftOutFees, zBTCMinShiftOutAmount);
        await zBtcToken.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();

        zZecToken = await zZEC.new();
        zecShifter = await Shifter.new(zZecToken.address, feeRecipient, mintAuthority.address, shiftInFees, shiftOutFees, zZECMinShiftOutAmount);
        await zZecToken.transferOwnership(zecShifter.address);
        await zecShifter.claimTokenOwnership();

        token3 = await TestToken.new("TestToken1", "TST", 18);
        token3Shifter = await Shifter.new(token3.address, feeRecipient, mintAuthority.address, shiftInFees, shiftOutFees, token3MinShiftOutAmount);
        await token3.transferOwnership(token3Shifter.address);
        await token3Shifter.claimTokenOwnership();

        btcReserve = await DEXReserve.new("Bitcoin Liquidity Token", "BTCLT", 8, dai.address, zBtcToken.address, dexFees);
        zecReserve = await DEXReserve.new("ZCash Liquidity Token", "ZECLT", 8, dai.address, zZecToken.address, dexFees);
        testTokenReserve = await DEXReserve.new("TestToken1 Liquidity Token", "TSTLT", 18, dai.address, token3.address, dexFees);

        dex = await DEX.new(dai.address);
        await dex.registerReserve(zBtcToken.address, btcReserve.address);
        await dex.registerReserve(zZecToken.address, zecReserve.address);
        await dex.registerReserve(token3.address, testTokenReserve.address);

        shifterRegistry = await ShifterRegistry.new();
        await shifterRegistry.setShifter(zBtcToken.address, btcShifter.address);
        await shifterRegistry.setShifter(zZecToken.address, zecShifter.address);
        await shifterRegistry.setShifter(token3.address, token3Shifter.address);

        dexAdapter = await DEXAdapter.new(dex.address, shifterRegistry.address);

        // Add liquidity to token3's reserve.
        const daiValue = new BN(20000000000);
        const tokenValue = new BN(20000000000);
        await shiftToReserve(daiValue, tokenValue, zBtcToken, btcReserve);
        await shiftToReserve(daiValue, tokenValue, zZecToken, zecReserve);
        await shiftToReserve(daiValue, tokenValue, token3, testTokenReserve);
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

    const tradeShiftedTokens = async (srcToken: ERC20Instance, dstToken: ERC20Instance, value: BN, challenge: DEXChallengeInstance) => {
        let receivingValue, sigString, receivingValueAfterFees;
        const recipient = accounts[3];
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
            await challenge.trade(
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

    describe("when funding challenges", async () => {
        it("can add btc funds", async () => {
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(100000000);
            await fundChallenge(challenge, "btc", amount);
        });

        it("cannot fund with zero amounts", async () => {
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(0);
            const nHash = randomBytesString(32);
            const sigString = randomBytesString(32);
            await challenge.fundBTC(amount, nHash, sigString).should.be.rejectedWith(/amount must be greater than 0/);
            await challenge.fundZEC(amount, nHash, sigString).should.be.rejectedWith(/amount must be greater than 0/);
        });

        it("can remove btc funds", async () => {
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(100000000);
            await fundChallenge(challenge, "btc", amount);
            const shiftOutAddr = randomBytesString(35);
            const oldBalance = new BN(await zBtcToken.balanceOf.call(challenge.address));
            oldBalance.should.bignumber.gt(new BN(0));
            await challenge.shiftOutBtc(shiftOutAddr, oldBalance);
            const newBalance = new BN(await zBtcToken.balanceOf.call(challenge.address));
            newBalance.should.bignumber.lt(oldBalance);
            const btcRewardAmount = new BN(await challenge.btcRewardAmount.call());
            btcRewardAmount.should.bignumber.equal(0);
        });

        it("cannot remove funds if not owner", async () => {
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(100000000);
            await fundChallenge(challenge, "btc", amount);
            await fundChallenge(challenge, "zec", amount);
            const shiftOutAddr = randomBytesString(35);
            const oldBalance = new BN(await zBtcToken.balanceOf.call(challenge.address));
            oldBalance.should.bignumber.gt(new BN(0));
            await challenge.shiftOutBtc(shiftOutAddr, oldBalance, { from: accounts[2] }).should.be.rejectedWith(/caller is not the owner/);
            await challenge.shiftOutZec(shiftOutAddr, oldBalance, { from: accounts[2] }).should.be.rejectedWith(/caller is not the owner/);
        });

        it("can add zec funds", async () => {
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(100000000);
            await fundChallenge(challenge, "zec", amount);
        });

        it("can remove zec funds", async () => {
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(100000000);
            await fundChallenge(challenge, "zec", amount);
            const shiftOutAddr = randomBytesString(35);
            const oldBalance = new BN(await zZecToken.balanceOf.call(challenge.address));
            await challenge.shiftOutZec(shiftOutAddr, oldBalance);
            const newBalance = new BN(await zZecToken.balanceOf.call(challenge.address));
            newBalance.should.bignumber.lt(oldBalance);
            const zecRewardAmount = new BN(await challenge.zecRewardAmount.call());
            zecRewardAmount.should.bignumber.equal(0);
        });
    });

    describe("when claiming the reward", async () => {
        it("can claim the reward after a successful swap", async () => {
            // Fund the challenge
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(100000000);
            await fundChallenge(challenge, "btc", amount);
            await fundChallenge(challenge, "zec", amount);

            // Submit a swap that completes the challenge
            await tradeShiftedTokens(zBtcToken, zZecToken, amount, challenge);
            (await challenge.rewardClaimed.call()).should.be.true;
            new BN(await challenge.btcRewardAmount.call()).should.bignumber.zero;
            new BN(await challenge.zecRewardAmount.call()).should.bignumber.zero;
        });

        it("can claim an only BTC reward", async () => {
            // Fund the challenge
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(100000000);
            await fundChallenge(challenge, "btc", amount);

            // Submit a swap that completes the challenge
            await tradeShiftedTokens(zBtcToken, zZecToken, amount, challenge);
            (await challenge.rewardClaimed.call()).should.be.true;
            new BN(await challenge.btcRewardAmount.call()).should.bignumber.zero;
            new BN(await challenge.zecRewardAmount.call()).should.bignumber.zero;
        });

        it("can claim an only ZEC reward", async () => {
            // Fund the challenge
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(100000000);
            await fundChallenge(challenge, "zec", amount);

            // Submit a swap that completes the challenge
            await tradeShiftedTokens(zBtcToken, zZecToken, amount, challenge);
            (await challenge.rewardClaimed.call()).should.be.true;
            new BN(await challenge.btcRewardAmount.call()).should.bignumber.zero;
            new BN(await challenge.zecRewardAmount.call()).should.bignumber.zero;
        });

        it("won't give reward if the swap was not the right token", async () => {
            // Fund the challenge
            const challenge = await DEXChallenge.new(dexAdapter.address);
            const amount = new BN(1000000);
            await fundChallenge(challenge, "btc", amount);
            await fundChallenge(challenge, "zec", amount);

            // Submit a swap that succeeds but does not complete the challenge
            await tradeShiftedTokens(zBtcToken, token3, amount, challenge);
            (await challenge.rewardClaimed.call()).should.be.false;
            new BN(await challenge.btcRewardAmount.call()).should.bignumber.gt(new BN(0));
            new BN(await challenge.zecRewardAmount.call()).should.bignumber.gt(new BN(0));
        });

    });

    const fundChallenge = async (challenge: DEXChallengeInstance, token: string, amount: BN) => {
        const fundFunc = token === "btc" ? fundBtc : fundZec;
        const tokenContract = token === "btc" ? zBtcToken : zZecToken;
        const oldBalance = new BN(await tokenContract.balanceOf.call(challenge.address));
        const result = await fundFunc(challenge, amount);
        const newBalance = new BN(await tokenContract.balanceOf.call(challenge.address));
        removeFee(amount, shiftInFees).should.bignumber.equal(newBalance);
        newBalance.should.bignumber.gt(oldBalance);
        const rewardAmountFunc = token === "btc" ? challenge.btcRewardAmount : challenge.zecRewardAmount;
        const rewardAmount = new BN(await rewardAmountFunc.call());
        rewardAmount.should.bignumber.equal(newBalance);
        return result;
    };

});