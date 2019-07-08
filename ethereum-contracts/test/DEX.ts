import { ec } from "elliptic";
import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";

import {
    DEXAdapterInstance, DEXInstance, DEXReserveInstance, ERC20ShiftedInstance, ShifterInstance,
    TestTokenInstance,
} from "../types/truffle-contracts";
import { ETHEREUM_TOKEN_ADDRESS, NULL } from "./helper/testUtils";

const TestToken = artifacts.require("TestToken");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");
const Shifter = artifacts.require("Shifter");
const DEXReserve = artifacts.require("DEXReserve");
const DEX = artifacts.require("DEX");
const DEXAdapter = artifacts.require("DEXAdapter");

contract("DEX", (accounts) => {
    let shifter1: ShifterInstance;
    let shifter2: ShifterInstance;
    let token1: ERC20ShiftedInstance;
    let token2: ERC20ShiftedInstance;
    let token3: TestTokenInstance;
    let dexReserve1: DEXReserveInstance;
    let dexReserve2: DEXReserveInstance;
    let dexReserve12: DEXReserveInstance;
    let dexReserve13: DEXReserveInstance;
    let dexReserve23: DEXReserveInstance;
    let dexReserve3: DEXReserveInstance;
    let dex: DEXInstance;
    let dexAdapter: DEXAdapterInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority;
    let privKey;

    const shifterFees = new BN(10);
    const dexFees = new BN(10);

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

        dexReserve1 = await DEXReserve.new();
        await dexReserve1.setShifter(token1.address, shifter1.address);
        dexReserve2 = await DEXReserve.new();
        await dexReserve2.setShifter(token2.address, shifter2.address)
        dexReserve12 = await DEXReserve.new();
        await dexReserve12.setShifter(token1.address, shifter1.address)
        await dexReserve12.setShifter(token2.address, shifter2.address)
        dexReserve13 = await DEXReserve.new();
        await dexReserve13.setShifter(token1.address, shifter1.address)
        dexReserve23 = await DEXReserve.new();
        await dexReserve23.setShifter(token2.address, shifter2.address)
        dexReserve3 = await DEXReserve.new();

        dex = await DEX.new(dexFees);
        await dex.registerReserve(token1.address, ETHEREUM_TOKEN_ADDRESS, dexReserve1.address);
        await dex.registerReserve(token2.address, ETHEREUM_TOKEN_ADDRESS, dexReserve2.address);
        await dex.registerReserve(token1.address, token2.address, dexReserve12.address);
        await dex.registerReserve(token1.address, token3.address, dexReserve13.address);
        await dex.registerReserve(token2.address, token3.address, dexReserve23.address);
        await dex.registerReserve(token3.address, ETHEREUM_TOKEN_ADDRESS, dexReserve3.address);

        dexAdapter = await DEXAdapter.new(dex.address);
    });

    const removeFee = (value, bips) => value.sub(value.mul(new BN(bips)).div(new BN(10000)))

    const depositToReserve = async (token: ERC20ShiftedInstance, shifter: ShifterInstance, reserve: DEXReserveInstance) => {
        const value = new BN(200000000000);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        const hash = await shifter.hashForSignature(pHash, value.toNumber(), accounts[0], nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await shifter.shiftIn(pHash, value.toNumber(), nHash, sigString, { from: accounts[0] });
        await token.transfer(reserve.address, removeFee(value, 10));
    };

    it("should deposit token1 to the reserve12", () => depositToReserve(token1, shifter1, dexReserve12));
    it("should deposit token1 to the reserve1", () => depositToReserve(token1, shifter1, dexReserve1));
    it("should deposit token2 to the reserve12", () => depositToReserve(token2, shifter2, dexReserve12));
    it("should deposit token2 to the reserve2", () => depositToReserve(token2, shifter2, dexReserve2));

    it("should transfer eth to reserve1, reserve2 and reserve3", async () => {
        await web3.eth.sendTransaction({ from: accounts[3], to: dexReserve1.address, value: 200000000000 });
        await web3.eth.sendTransaction({ from: accounts[3], to: dexReserve2.address, value: 200000000000 });
        await web3.eth.sendTransaction({ from: accounts[3], to: dexReserve3.address, value: 200000000000 });
    });

    it("should transfer token3 to reserve13, reserve23 and reserve3", async () => {
        await token3.transfer(dexReserve3.address, 200000000000);
        await token3.transfer(dexReserve13.address, 200000000000);
        await token3.transfer(dexReserve23.address, 200000000000);
    });

    it("should approve token1 and token2 from the wallet to DEX", async () => {
        await dexReserve1.approve(token1.address, dex.address, 2000000000000);
        await dexReserve1.approve(ETHEREUM_TOKEN_ADDRESS, dex.address, 2000000000000);
        await dexReserve2.approve(token2.address, dex.address, 2000000000000);
        await dexReserve2.approve(ETHEREUM_TOKEN_ADDRESS, dex.address, 2000000000000);
        await dexReserve3.approve(token3.address, dex.address, 2000000000000);
        await dexReserve3.approve(ETHEREUM_TOKEN_ADDRESS, dex.address, 2000000000000);
        await dexReserve12.approve(token1.address, dex.address, 2000000000000);
        await dexReserve12.approve(token2.address, dex.address, 2000000000000);
        await dexReserve13.approve(token1.address, dex.address, 2000000000000);
        await dexReserve13.approve(token3.address, dex.address, 2000000000000);
        await dexReserve23.approve(token2.address, dex.address, 2000000000000);
        await dexReserve23.approve(token3.address, dex.address, 2000000000000);
    });

    it("should trade token1 to token2 on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await dexAdapter.hashPayload(
            token1.address, token2.address, 0, "0x002200220022",
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload
            token1.address, token2.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        );
    });

    it("should trade token2 to token1 on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await dexAdapter.hashPayload(
            token2.address, token1.address, 0, "0x002200220022",
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            token2.address, token1.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        );
    });

    it("should trade eth to token1 on DEX", async () => {
        const value = new BN(200);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dexAdapter.trade(
            // Payload:
            ETHEREUM_TOKEN_ADDRESS, token1.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, pHash,
            { from: accounts[3], value },
        );
    });

    it("should trade eth to token2 on DEX", async () => {
        const value = new BN(200);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dexAdapter.trade(
            // Payload:
            ETHEREUM_TOKEN_ADDRESS, token2.address, 0, "0x002200220022",
            100000, "0x010101010101",
            // Required
            value.toNumber(), nHash, pHash,
            { from: accounts[3], value },
        );
    });

    it("should trade eth to token3 on DEX", async () => {
        const value = new BN(200);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dexAdapter.trade(
            // Payload:
            ETHEREUM_TOKEN_ADDRESS, token3.address, 0, accounts[3],
            100000, accounts[3],
            // Required
            value.toNumber(), nHash, pHash,
            { from: accounts[3], value },
        );
    });

    it("should trade token1 to eth on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await dexAdapter.hashPayload(
            token1.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            token1.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        );
    });

    it("should trade token2 to eth on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await dexAdapter.hashPayload(
            token2.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            token2.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        );
    });

    it("should trade token1 to token3 on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await dexAdapter.hashPayload(
            token1.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            token1.address, token3.address, 0, accounts[3], 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        );
    });

    it("should trade token2 to token3 on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await dexAdapter.hashPayload(
            token2.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            token2.address, token3.address, 0, accounts[3], 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        );
    });
});