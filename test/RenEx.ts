import { ec } from "elliptic";
import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";

import {
    ERC20ShiftedInstance, RenExAdapterInstance, RenExInstance, RenExReserveInstance,
    ShifterInstance, TestTokenInstance,
} from "../types/truffle-contracts";
import { ETHEREUM_TOKEN_ADDRESS, NULL } from "./helper/testUtils";

const TestToken = artifacts.require("TestToken");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");
const Shifter = artifacts.require("Shifter");
const RenExReserve = artifacts.require("RenExReserve");
const RenEx = artifacts.require("RenEx");
const RenExAdapter = artifacts.require("RenExAdapter");

contract("RenEx", (accounts) => {
    let shifter1: ShifterInstance;
    let shifter2: ShifterInstance;
    let token1: ERC20ShiftedInstance;
    let token2: ERC20ShiftedInstance;
    let token3: TestTokenInstance;
    let renExReserve1: RenExReserveInstance;
    let renExReserve2: RenExReserveInstance;
    let renExReserve12: RenExReserveInstance;
    let renExReserve13: RenExReserveInstance;
    let renExReserve23: RenExReserveInstance;
    let renExReserve3: RenExReserveInstance;
    let renex: RenExInstance;
    let renexAdapter: RenExAdapterInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority;
    let privKey;

    const shifterFees = new BN(10);
    const renExFees = new BN(10);

    before(async () => {
        mintAuthority = web3.eth.accounts.create();
        privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex")

        token1 = await zBTC.new();
        shifter1 = await Shifter.new(NULL, token1.address, accounts[1], mintAuthority.address, shifterFees);
        await token1.transferOwnership(shifter1.address);
        await shifter1.claimTokenOwnership();

        token2 = await zZEC.new();
        shifter2 = await Shifter.new(NULL, token2.address, accounts[1], mintAuthority.address, shifterFees);
        await token2.transferOwnership(shifter2.address);
        await shifter2.claimTokenOwnership();

        token3 = await TestToken.new("TestToken1", "TST", 18);

        renExReserve1 = await RenExReserve.new();
        await renExReserve1.setShifter(token1.address, shifter1.address);
        renExReserve2 = await RenExReserve.new();
        await renExReserve2.setShifter(token2.address, shifter2.address)
        renExReserve12 = await RenExReserve.new();
        await renExReserve12.setShifter(token1.address, shifter1.address)
        await renExReserve12.setShifter(token2.address, shifter2.address)
        renExReserve13 = await RenExReserve.new();
        await renExReserve13.setShifter(token1.address, shifter1.address)
        renExReserve23 = await RenExReserve.new();
        await renExReserve23.setShifter(token2.address, shifter2.address)
        renExReserve3 = await RenExReserve.new();

        renex = await RenEx.new(renExFees);
        await renex.registerReserve(token1.address, ETHEREUM_TOKEN_ADDRESS, renExReserve1.address);
        await renex.registerReserve(token2.address, ETHEREUM_TOKEN_ADDRESS, renExReserve2.address);
        await renex.registerReserve(token1.address, token2.address, renExReserve12.address);
        await renex.registerReserve(token1.address, token3.address, renExReserve13.address);
        await renex.registerReserve(token2.address, token3.address, renExReserve23.address);
        await renex.registerReserve(token3.address, ETHEREUM_TOKEN_ADDRESS, renExReserve3.address);

        renexAdapter = await RenExAdapter.new(renex.address);
    });

    const removeFee = (value, bips) => value.sub(value.mul(new BN(bips)).div(new BN(10000)))

    const depositToReserve = async (token: ERC20ShiftedInstance, shifter: ShifterInstance, reserve: RenExReserveInstance) => {
        const value = new BN(200000000000);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        const hash = await shifter.hashForSignature(accounts[0], value.toNumber(), nHash, pHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await shifter.shiftIn(value.toNumber(), nHash, sigString, pHash, { from: accounts[0] });
        await token.transfer(reserve.address, removeFee(value, 10));
    };

    it("should deposit token1 to the reserve12", () => depositToReserve(token1, shifter1, renExReserve12));
    it("should deposit token1 to the reserve1", () => depositToReserve(token1, shifter1, renExReserve1));
    it("should deposit token2 to the reserve12", () => depositToReserve(token2, shifter2, renExReserve12));
    it("should deposit token2 to the reserve2", () => depositToReserve(token2, shifter2, renExReserve2));

    it("should transfer eth to reserve1, reserve2 and reserve3", async () => {
        await web3.eth.sendTransaction({ from: accounts[3], to: renExReserve1.address, value: 200000000000 });
        await web3.eth.sendTransaction({ from: accounts[3], to: renExReserve2.address, value: 200000000000 });
        await web3.eth.sendTransaction({ from: accounts[3], to: renExReserve3.address, value: 200000000000 });
    });

    it("should transfer token3 to reserve13, reserve23 and reserve3", async () => {
        await token3.transfer(renExReserve3.address, 200000000000);
        await token3.transfer(renExReserve13.address, 200000000000);
        await token3.transfer(renExReserve23.address, 200000000000);
    });

    it("should approve token1 and token2 from the wallet to RenEx", async () => {
        await renExReserve1.approve(token1.address, renex.address, 2000000000000);
        await renExReserve1.approve(ETHEREUM_TOKEN_ADDRESS, renex.address, 2000000000000);
        await renExReserve2.approve(token2.address, renex.address, 2000000000000);
        await renExReserve2.approve(ETHEREUM_TOKEN_ADDRESS, renex.address, 2000000000000);
        await renExReserve3.approve(token3.address, renex.address, 2000000000000);
        await renExReserve3.approve(ETHEREUM_TOKEN_ADDRESS, renex.address, 2000000000000);
        await renExReserve12.approve(token1.address, renex.address, 2000000000000);
        await renExReserve12.approve(token2.address, renex.address, 2000000000000);
        await renExReserve13.approve(token1.address, renex.address, 2000000000000);
        await renExReserve13.approve(token3.address, renex.address, 2000000000000);
        await renExReserve23.approve(token2.address, renex.address, 2000000000000);
        await renExReserve23.approve(token3.address, renex.address, 2000000000000);
    });

    it("should trade token1 to token2 on RenEx", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.hashPayload(
            token1.address, token2.address, 0, "0x002200220022",
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature(renexAdapter.address, value.toNumber(), nHash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, sigString,
            // Payload
            token1.address, token2.address, 0, "0x002200220022", 100000,
            "0x010101010101",
        );
    });

    it("should trade token2 to token1 on RenEx", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.hashPayload(
            token2.address, token1.address, 0, "0x002200220022",
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature(renexAdapter.address, value.toNumber(), nHash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, sigString,
            // Payload:
            token2.address, token1.address, 0, "0x002200220022", 100000,
            "0x010101010101",
        );
    });

    it("should trade eth to token1 on RenEx", async () => {
        const value = new BN(200);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, pHash,
            // Payload:
            ETHEREUM_TOKEN_ADDRESS, token1.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            { from: accounts[3], value },
        );
    });

    it("should trade eth to token2 on RenEx", async () => {
        const value = new BN(200);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, pHash,
            // Payload:
            ETHEREUM_TOKEN_ADDRESS, token2.address, 0, "0x002200220022",
            100000, "0x010101010101",
            { from: accounts[3], value },
        );
    });

    it("should trade eth to token3 on RenEx", async () => {
        const value = new BN(200);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, pHash,
            // Payload:
            ETHEREUM_TOKEN_ADDRESS, token3.address, 0, accounts[3],
            100000, accounts[3],
            { from: accounts[3], value },
        );
    });

    it("should trade token1 to eth on RenEx", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.hashPayload(
            token1.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature(renexAdapter.address, value.toNumber(), nHash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, sigString,
            // Payload:
            token1.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
        );
    });

    it("should trade token2 to eth on RenEx", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.hashPayload(
            token2.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature(renexAdapter.address, value.toNumber(), nHash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, sigString,
            // Payload:
            token2.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
        );
    });

    it("should trade token1 to token3 on RenEx", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.hashPayload(
            token1.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature(renexAdapter.address, value.toNumber(), nHash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, sigString,
            // Payload:
            token1.address, token3.address, 0, accounts[3], 100000,
            "0x010101010101",
        );
    });

    it("should trade token2 to token3 on RenEx", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.hashPayload(
            token2.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature(renexAdapter.address, value.toNumber(), nHash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            value.toNumber(), nHash, sigString,
            // Payload:
            token2.address, token3.address, 0, accounts[3], 100000,
            "0x010101010101",
        );
    });
});