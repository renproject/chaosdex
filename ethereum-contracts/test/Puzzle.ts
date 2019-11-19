import BN from "bn.js";
import hashjs from "hash.js";

import { ecsign, ecrecover, pubToAddress } from "ethereumjs-util";

import {
    ZECShifterInstance, BTCShifterInstance, PuzzleInstance, ShiftInPuzzleInstance, SimplePuzzleInstance,
    ShifterRegistryInstance, zBTCInstance, zZECInstance,
} from "../types/truffle-contracts";
import { Ox, randomBytes, NULL } from "./helper/testUtils";
import { log } from "./helper/logs";

const BTCShifter = artifacts.require("BTCShifter");
const ZECShifter = artifacts.require("ZECShifter");
const ShifterRegistry = artifacts.require("ShifterRegistry");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");

const ShiftInPuzzle = artifacts.require("ShiftInPuzzle");
const SimplePuzzle = artifacts.require("SimplePuzzle");

contract("Puzzle", (accounts) => {
    let zecShifter: ZECShifterInstance;
    let zzec: zZECInstance;
    let btcShifter: BTCShifterInstance;
    let zbtc: zBTCInstance;
    let registry: ShifterRegistryInstance;

    const mintAuthority = web3.eth.accounts.create();
    const privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");
    const feeInBips = new BN(10);
    const feeRecipient = accounts[1];
    const maxGasPrice = new BN(web3.utils.toWei("21", "gwei"));
    const typicalGasLimit = new BN("6721975");

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    const randomAddress = accounts[7];

    const zBTCMinShiftOutAmount = new BN(10000);
    const zZECMinShiftOutAmount = new BN(10000);

    const removeFee = (value: BN, bips: BN | number) => value.sub(value.mul(new BN(bips)).div(new BN(10000)));

    before(async () => {
        // Setup the environment
        zbtc = await zBTC.new();

        btcShifter = await BTCShifter.new(
            zbtc.address,
            feeRecipient,
            mintAuthority.address,
            feeInBips,
            feeInBips,
            zBTCMinShiftOutAmount,
        );

        await zbtc.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();

        registry = await ShifterRegistry.new();
        await registry.setShifter(zbtc.address, btcShifter.address);

        zzec = await zZEC.new();
        zecShifter = await ZECShifter.new(zzec.address, feeRecipient, mintAuthority.address, feeInBips,
            feeInBips, zZECMinShiftOutAmount);
        await zzec.transferOwnership(zecShifter.address);
        await zecShifter.claimTokenOwnership();

        await registry.setShifter(zzec.address, zecShifter.address);
    });

    describe("when deploying puzzles", async () => {
        it("can successfully fund puzzles", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");

            let puzzle: ShiftInPuzzleInstance;
            // const tokenName = await zbtc.symbol.call();
            puzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            const x = await puzzle.registry.call();
            const rewardAmount = new BN("1000000");
            await fundBtc(puzzle, rewardAmount);
        });

        it("cannot fund if amount is zero", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");

            let puzzle: ShiftInPuzzleInstance;
            // const tokenName = await zbtc.symbol.call();
            puzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            const amount = new BN(0);
            const nHash = randomBytes(32);
            const sigString = randomBytes(32);
            await puzzle.fund(amount, nHash, sigString).should.be.rejectedWith(/amount must be greater than 0/);
        });

        it("can remove funds from the Puzzle", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");

            let puzzle: ShiftInPuzzleInstance;
            puzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            const rewardAmount = new BN("1000000");
            await fundBtc(puzzle, rewardAmount);

            const shiftOutAddr = randomBytes(35);
            const oldBalance = new BN(await zbtc.balanceOf.call(puzzle.address));
            oldBalance.should.bignumber.gt(new BN(0));
            await puzzle.shiftOut(shiftOutAddr, oldBalance);
            const newBalance = new BN(await zbtc.balanceOf.call(puzzle.address));
            newBalance.should.bignumber.lt(oldBalance);
            const btcRewardAmount = new BN(await puzzle.rewardAmount.call());
            btcRewardAmount.should.bignumber.equal(0);
        });

        it("cannot remove funds from the Puzzle if not owner", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");

            let puzzle: ShiftInPuzzleInstance;
            puzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            const rewardAmount = new BN("1000000");
            await fundBtc(puzzle, rewardAmount);

            const shiftOutAddr = randomBytes(35);
            const oldBalance = new BN(await zbtc.balanceOf.call(puzzle.address));
            oldBalance.should.bignumber.gt(new BN(0));
            await puzzle.shiftOut(shiftOutAddr, oldBalance, { from: accounts[2] }).should.be.rejectedWith(/caller is not the owner/);
        });

    });

    describe("when validating the secret message", async () => {
        it("can correctly validate the secret", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");

            let puzzle: ShiftInPuzzleInstance;
            puzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            (await puzzle.validateSecret.call(web3.utils.fromAscii(someSecret))).should.be.true;
            (await puzzle.validateSecret.call(web3.utils.fromAscii("asdfksajdsf"))).should.be.false;
            (await puzzle.validateSecret.call(web3.utils.fromAscii("notthesecret"))).should.be.false;
        });
    });

    describe("when claiming the reward", async () => {
        it("can successfully claim ShiftInPuzzles", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");

            const refundAddress = randomBytes(32);

            // ShiftInPuzzle
            const shiftInPuzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            (await shiftInPuzzle.rewardClaimed.call()).should.be.false;
            await fundBtc(shiftInPuzzle, rewardAmount);
            (await claimShiftInPuzzleReward(shiftInPuzzle, new BN(100000), refundAddress, someSecret) as any)
            .should.emit.logs([
                log(
                    "LogRewardClaimed",
                    {
                        _rewardAddress: web3.utils.fromAscii(refundAddress),
                        _secret: web3.utils.fromAscii(someSecret),
                        _rewardAmount: removeFee(rewardAmount, feeInBips),
                    },
                ),
            ]);
            (await shiftInPuzzle.rewardClaimed.call()).should.be.true;
            (await shiftInPuzzle.rewardAmount.call()).should.bignumber.zero;
        });

        it("can successfully claim SimplePuzzles", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");
            const refundAddress = randomBytes(32);
            // SimplePuzzle
            const simplePuzzle = await SimplePuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            (await simplePuzzle.rewardClaimed.call()).should.be.false;
            await fundBtc(simplePuzzle, rewardAmount);
            (await claimSimplePuzzleReward(simplePuzzle, refundAddress, someSecret) as any)
            .should.emit.logs([
                log(
                    "LogRewardClaimed",
                    {
                        _rewardAddress: web3.utils.fromAscii(refundAddress),
                        _secret: web3.utils.fromAscii(someSecret),
                        _rewardAmount: removeFee(rewardAmount, feeInBips),
                    },
                ),
            ]);
            (await simplePuzzle.rewardClaimed.call()).should.be.true;
            (await simplePuzzle.rewardAmount.call()).should.bignumber.zero;
            await claimSimplePuzzleReward(simplePuzzle, refundAddress, someSecret).should.be.rejectedWith(/reward already claimed/);
        });

        it("rejects ShiftInPuzzles claim when the amount is zero", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");

            const refundAddress = randomBytes(32);
            const nonce = randomBytes(32);
            const sigString = randomBytes(32);

            const shiftInPuzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            (await shiftInPuzzle.rewardClaimed.call()).should.be.false;
            await fundBtc(shiftInPuzzle, rewardAmount);
            const encRefundAddress = web3.utils.fromAscii(refundAddress);
            const encSecret = web3.utils.fromAscii(someSecret);
            await shiftInPuzzle.claimReward(
                // Payload
                encRefundAddress, encSecret,
                // Required
                new BN(0), nonce, sigString,

            ).should.be.rejectedWith(/amount must be greater than 0/);
        });

        it("rejects ShiftInPuzzle claims with the wrong secret", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");
            const refundAddress = randomBytes(32);
            const shiftInPuzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            (await shiftInPuzzle.rewardClaimed.call()).should.be.false;

            // ShiftInPuzzle
            await fundBtc(shiftInPuzzle, rewardAmount);
            await claimShiftInPuzzleReward(shiftInPuzzle, new BN(100000), refundAddress, "kshjfeheskfjsfjehk");
            (await shiftInPuzzle.rewardClaimed.call()).should.be.false;
            await claimShiftInPuzzleReward(shiftInPuzzle, new BN(100000), refundAddress, "abcdefgh");
            (await shiftInPuzzle.rewardClaimed.call()).should.be.false;
            await claimShiftInPuzzleReward(shiftInPuzzle, new BN(100000), refundAddress, "not the secret");
            (await shiftInPuzzle.rewardClaimed.call()).should.be.false;
        });

        it("rejects SimplePuzzle claims with the wrong secret", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");
            const refundAddress = randomBytes(32);

            // SimplePuzzle
            const simplePuzzle = await SimplePuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            (await simplePuzzle.rewardClaimed.call()).should.be.false;
            await fundBtc(simplePuzzle, rewardAmount);
            await claimSimplePuzzleReward(simplePuzzle, refundAddress, "kshjfeheskfjsfjehk").should.be.rejectedWith(/invalid secret/);
            await claimSimplePuzzleReward(simplePuzzle, refundAddress, "abcdefgh").should.be.rejectedWith(/invalid secret/);
            await claimSimplePuzzleReward(simplePuzzle, refundAddress, "not the secret").should.be.rejectedWith(/invalid secret/);
        });

        it("rejects SimplePuzzle claims when the gas price is too high", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");
            const refundAddress = randomBytes(32);

            // SimplePuzzle
            const simplePuzzle = await SimplePuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            (await simplePuzzle.rewardClaimed.call()).should.be.false;
            await fundBtc(simplePuzzle, rewardAmount);

            const encRefundAddress = web3.utils.fromAscii(refundAddress);
            const encSecret = web3.utils.fromAscii(someSecret);
            let testGasPrice = new BN(web3.utils.toWei("61", "gwei"));
            testGasPrice.should.bignumber.gt(maxGasPrice);

            // Manually overwrite the gas limit as well as gasPrice since it sometimes breaks coverage
            await simplePuzzle.claimReward(encRefundAddress, encSecret, {
                gasPrice: new BN(web3.utils.toWei("61", "gwei")),
                gas: typicalGasLimit,
            }).should.be.rejectedWith(/gas price is too high/);
            await simplePuzzle.claimReward(encRefundAddress, encSecret, {
                gasPrice: new BN(web3.utils.toWei("25", "gwei")),
                gas: typicalGasLimit,
            }).should.be.rejectedWith(/gas price is too high/);
            await simplePuzzle.claimReward(encRefundAddress, encSecret, {
                gasPrice: new BN(web3.utils.toWei("22", "gwei")),
                gas: typicalGasLimit,
            }).should.be.rejectedWith(/gas price is too high/);
            await simplePuzzle.claimReward(encRefundAddress, encSecret, {
                gasPrice: new BN(web3.utils.toWei("21", "gwei")),
                gas: typicalGasLimit,

            });
        });

        it("rejects ShiftInPuzzle claims when the gas price is too high", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");
            const refundAddress = randomBytes(32);

            // ShiftInPuzzle
            const shiftInPuzzle = await ShiftInPuzzle.new(registry.address, "zBTC", Ox(hash), maxGasPrice);
            (await shiftInPuzzle.rewardClaimed.call()).should.be.false;
            await fundBtc(shiftInPuzzle, rewardAmount);
            const encRefundAddress = web3.utils.fromAscii(refundAddress);
            const encSecret = web3.utils.fromAscii(someSecret);
            const nonce = randomBytes(32);
            const sigString = randomBytes(32);

            // Manually overwrite the gas limit as well as gasPrice since it sometimes breaks coverage
            await shiftInPuzzle.claimReward(encRefundAddress, encSecret, rewardAmount, nonce, sigString, {
                gasPrice: new BN(web3.utils.toWei("61", "gwei")),
                gas: typicalGasLimit,
            }).should.be.rejectedWith(/gas price is too high/);
            await shiftInPuzzle.claimReward(encRefundAddress, encSecret, rewardAmount, nonce, sigString, {
                gasPrice: new BN(web3.utils.toWei("30", "gwei")),
                gas: typicalGasLimit,
            }).should.be.rejectedWith(/gas price is too high/);
            await shiftInPuzzle.claimReward(encRefundAddress, encSecret, rewardAmount, nonce, sigString, {
                gasPrice: new BN(web3.utils.toWei("25", "gwei")),
                gas: typicalGasLimit,
            }).should.be.rejectedWith(/gas price is too high/);
            await shiftInPuzzle.claimReward(encRefundAddress, encSecret, rewardAmount, nonce, sigString, {
                gasPrice: new BN(web3.utils.toWei("22", "gwei")),
                gas: typicalGasLimit,
            }).should.be.rejectedWith(/gas price is too high/);
        });
    });

    const claimSimplePuzzleReward = async (simplePuzzleInstance: SimplePuzzleInstance, refundAddress: string, secret: string) => {
        const encRefundAddress = web3.utils.fromAscii(refundAddress);
        const encSecret = web3.utils.fromAscii(secret);
        return simplePuzzleInstance.claimReward(encRefundAddress, encSecret);
    };

    const claimShiftInPuzzleReward = async (ShiftInPuzzleInstance: ShiftInPuzzleInstance, amount: BN, refundAddress: string, secret: string) => {
        const encRefundAddress = web3.utils.fromAscii(refundAddress);
        const encSecret = web3.utils.fromAscii(secret);
        const nonce = randomBytes(32);
        const pHash = await (ShiftInPuzzleInstance.hashPayload as any).call(encRefundAddress, encSecret);

        const hashForSignature = await btcShifter.hashForSignature.call(
            Ox(pHash),
            amount.toNumber(),
            ShiftInPuzzleInstance.address,
            nonce,
        );
        const sig = ecsign(Buffer.from(hashForSignature.slice(2), "hex"), privKey);
        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        return ShiftInPuzzleInstance.claimReward(
            // Payload
            encRefundAddress, encSecret,
            // Required
            amount, nonce, sigString,
        );
    };

    const generateSecretMessage = (secret: string): string => {
        return `Secret(${secret})`;
    };

    const fundBtc = async (puzzle: PuzzleInstance, value: number | BN, shiftID?: string) => {
        value = new BN(value);
        const nHash = randomBytes(32);
        const pHash = NULL; // randomBytesString(32);

        const user = puzzle.address;
        const hash = await btcShifter.hashForSignature.call(pHash, value, user, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
            .should.equal(mintAuthority.address.slice(2).toLowerCase());

        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const hashForSignature = await btcShifter.hashForSignature.call(pHash, value, user, nHash);
        (await btcShifter.verifySignature.call(hashForSignature, sigString))
            .should.be.true;

        const balanceBefore = new BN((await zbtc.balanceOf.call(user)).toString());
        (await puzzle.fund(value, nHash, sigString) as any);
        (await zbtc.balanceOf.call(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, feeInBips)));
        new BN(await puzzle.rewardAmount.call()).should.bignumber.equal(removeFee(value, feeInBips));
        return [pHash, nHash];
    };

});
