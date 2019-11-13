import BN from "bn.js";
import hashjs from "hash.js";

import { rawEncode } from "ethereumjs-abi";
import { ecsign, keccak256, ecrecover, pubToAddress } from "ethereumjs-util";

import {
    ZECShifterInstance, BTCShifterInstance, PuzzleInstance, ShifterRegistryInstance,
    zBTCInstance, zZECInstance,
} from "../types/truffle-contracts";
import { Ox, randomBytes, NULL } from "./helper/testUtils";

const BTCShifter = artifacts.require("BTCShifter");
const ZECShifter = artifacts.require("ZECShifter");
const ShifterRegistry = artifacts.require("ShifterRegistry");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");

const Puzzle = artifacts.require("Puzzle");

contract.only("Puzzle", (accounts) => {
    let zecShifter: ZECShifterInstance;
    let zzec: zZECInstance;
    let btcShifter: BTCShifterInstance;
    let zbtc: zBTCInstance;
    let registry: ShifterRegistryInstance;

    const mintAuthority = web3.eth.accounts.create();
    const privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");
    const feeInBips = new BN(10);
    const feeRecipient = accounts[1];

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

    describe("when deploying Puzzle", async () => {
        it("can successfully fund the Puzzle", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");

            let puzzle: PuzzleInstance;
            // const tokenName = await zbtc.symbol.call();
            puzzle = await Puzzle.new(registry.address, "zBTC", Ox(hash));
            const x = await puzzle.registry.call();
            const rewardAmount = new BN("1000000");
            await fundBtc(puzzle, rewardAmount);
        });
    });

    describe("when validating the secret message", async () => {
        it("can correctly validate the secret", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");

            let puzzle: PuzzleInstance;
            puzzle = await Puzzle.new(registry.address, "zBTC", Ox(hash));
            (await puzzle.validateSecret.call(web3.utils.fromAscii(someSecret))).should.be.true;
            (await puzzle.validateSecret.call(web3.utils.fromAscii("asdfksajdsf"))).should.be.false;
            (await puzzle.validateSecret.call(web3.utils.fromAscii("notthesecret"))).should.be.false;
        });
    });

    describe("when claiming the reward", async () => {
        it("can successfully claim", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");

            const refundAddress = randomBytes(32);

            let puzzle: PuzzleInstance;
            puzzle = await Puzzle.new(registry.address, "zBTC", Ox(hash));
            (await puzzle.rewardClaimed.call()).should.be.false;

            await fundBtc(puzzle, rewardAmount);
            await claimReward(puzzle, new BN(100000), refundAddress, someSecret);
            (await puzzle.rewardClaimed.call()).should.be.true;
        });

        it("rejects claim with the wrong secret", async () => {
            const someSecret = "thequickbrownfoxjumpsoverthelazydog";
            const msg = generateSecretMessage(someSecret);
            const hash = hashjs.sha256().update(msg).digest("hex");
            const rewardAmount = new BN("10000000");

            const refundAddress = randomBytes(32);

            let puzzle: PuzzleInstance;
            puzzle = await Puzzle.new(registry.address, "zBTC", Ox(hash));
            (await puzzle.rewardClaimed.call()).should.be.false;

            await fundBtc(puzzle, rewardAmount);
            await claimReward(puzzle, new BN(100000), refundAddress, "kshjfeheskfjsfjehk");
            (await puzzle.rewardClaimed.call()).should.be.false;
            await claimReward(puzzle, new BN(100000), refundAddress, "abcdefgh");
            (await puzzle.rewardClaimed.call()).should.be.false;
            await claimReward(puzzle, new BN(100000), refundAddress, "not the secret");
            (await puzzle.rewardClaimed.call()).should.be.false;
        });
    });

    const claimReward = async (puzzleInstance: PuzzleInstance, amount: BN, refundAddress: string, secret: string) => {
        const nonce = randomBytes(32);
        const pHash = keccak256(rawEncode(
            ["bytes", "bytes"],
            [refundAddress, secret],
        )).toString("hex");

        const hashForSignature = await btcShifter.hashForSignature.call(
            Ox(pHash),
            amount.toNumber(),
            puzzleInstance.address,
            nonce,
        );
        const sig = ecsign(Buffer.from(hashForSignature.slice(2), "hex"), privKey);
        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const encRefundAddress = web3.utils.fromAscii(refundAddress);
        const encSecret = web3.utils.fromAscii(secret);

        await puzzleInstance.claimReward(
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
        return [pHash, nHash];
    };

});
