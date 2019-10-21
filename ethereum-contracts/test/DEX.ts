import { ec } from "elliptic";
import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";

import {
    DEXAdapterInstance, DEXInstance, DEXReserveInstance, ERC20ShiftedInstance, ShifterInstance,
    TestTokenInstance, ShifterRegistryInstance, DaiTokenInstance, ERC20Instance,
} from "../types/truffle-contracts";
import { ETHEREUM_TOKEN_ADDRESS, NULL } from "./helper/testUtils";
import { format } from "url";

const TestToken = artifacts.require("TestToken");
const DAI = artifacts.require("DaiToken");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");
const Shifter = artifacts.require("Shifter");
const DEXReserve = artifacts.require("DEXReserve");
const DEX = artifacts.require("DEX");
const DEXAdapter = artifacts.require("DEXAdapter");
const ShifterRegistry = artifacts.require("ShifterRegistry");

contract("DEX", (accounts) => {
    let dai: DaiTokenInstance;
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
    let shifterRegistry: ShifterRegistryInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority;
    let privKey;
    const feeRecipeint = accounts[1];

    const shifterFees = new BN(10);
    const dexFees = new BN(10);
    const zBTCMinShiftOutAmount = new BN(10000);
    const zZECMinShiftOutAmount = new BN(10000);

    before(async () => {
        mintAuthority = web3.eth.accounts.create();
        privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex")

        dai = await DAI.new();
        token1 = await zBTC.new();
        shifter1 = await Shifter.new(token1.address, feeRecipeint, mintAuthority.address, shifterFees, zBTCMinShiftOutAmount);
        await token1.transferOwnership(shifter1.address);
        await shifter1.claimTokenOwnership();

        token2 = await zZEC.new();
        shifter2 = await Shifter.new(token2.address, feeRecipeint, mintAuthority.address, shifterFees, zZECMinShiftOutAmount);
        await token2.transferOwnership(shifter2.address);
        await shifter2.claimTokenOwnership();

        token3 = await TestToken.new("TestToken1", "TST", 18);

        dexReserve1 = await DEXReserve.new(dai.address, token1.address, dexFees);
        dexReserve2 = await DEXReserve.new(dai.address, token2.address, dexFees);
        dexReserve3 = await DEXReserve.new(dai.address, token3.address, dexFees);

        dex = await DEX.new(dai.address, dexFees);
        await dex.registerReserve(token1.address, dexReserve1.address);
        await dex.registerReserve(token2.address, dexReserve2.address);
        await dex.registerReserve(token3.address, dexReserve3.address);

        shifterRegistry = await ShifterRegistry.new();
        await shifterRegistry.setShifter(token1.address, shifter1.address);
        await shifterRegistry.setShifter(token2.address, shifter2.address);

        dexAdapter = await DEXAdapter.new(dex.address, shifterRegistry.address);
    });

    const removeFee = (value, bips) => value.sub(value.mul(new BN(bips)).div(new BN(10000)))

    const shiftIn = async (value: BN, shifter: ShifterInstance) => {
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        const hash = await shifter.hashForSignature(pHash, value.toNumber(), accounts[0], nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await shifter.shiftIn(pHash, value.toNumber(), nHash, sigString, { from: accounts[0] });
    }

    const depositToReserve = async (value: BN, token: ERC20Instance, reserve: DEXReserveInstance) => {
        await dai.approve(reserve.address, value);
        await token.approve(reserve.address, removeFee(value, shifterFees));
        await reserve.addLiquidity(accounts[0], value, removeFee(value, 10), 10000000000000);
    };

    const withdrawFromReserve = async (token: ERC20Instance, reserve: DEXReserveInstance) => {
        const liquidity = await reserve.balanceOf(accounts[0]);
        await reserve.removeLiquidity(accounts[0], liquidity);
    }

    it("should deposit token1 to the reserve1", async () => {
        const value = new BN(20000000000);
        await shiftIn(value, shifter1);
        await depositToReserve(value, token1, dexReserve1);
    });

    it("should deposit token2 to the reserve2", async () => {
        const value = new BN(20000000000);
        await shiftIn(value, shifter2);
        await depositToReserve(value, token2, dexReserve2);
    });

    it("should deposit token3 to the reserve3", async () => {
        const value = new BN(20000000000);
        await depositToReserve(value, token3, dexReserve3);
    });

    it("should trade dai to token1 on DEX", async () => {
        const value = new BN(225000);
        const amount = await dex.calculateReceiveAmount(dai.address, token1.address, value);

        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dai.approve(dexAdapter.address, value);
        await dexAdapter.trade(
            // Payload:
            dai.address, token1.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value, nHash, pHash,
        );
    });

    it("should trade dai to token2 on DEX", async () => {
        const value = new BN(22500);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dai.approve(dexAdapter.address, value);
        await dexAdapter.trade(
            // Payload:
            dai.address, token2.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, pHash,
        );
    });

    it("should trade dai to token3 on DEX", async () => {
        const value = new BN(22500);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dai.approve(dexAdapter.address, value);
        await dexAdapter.trade(
            // Payload:
            dai.address, token3.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, pHash,
        );
    });

    it("should trade token1 to token2 on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(22500);
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
        const value = new BN(22500);
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

    it("should trade token1 to dai on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(22500);
        const commitment = await dexAdapter.hashPayload(
            token1.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            token1.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        );
    });

    it("should trade token2 to eth on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(22500);
        const commitment = await dexAdapter.hashPayload(
            token2.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            token2.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        );
    });

    it("should trade token1 to token3 on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(22500);
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
        const value = new BN(22500);
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

    it("should withdraw dai and token1 from the reserve1", async () => await withdrawFromReserve(token1, dexReserve1));
    it("should withdraw dai and token2 from the reserve2", async () => await withdrawFromReserve(token2, dexReserve2));
    it("should withdraw dai and token3 from the reserve3", async () => await withdrawFromReserve(token3, dexReserve3));
});