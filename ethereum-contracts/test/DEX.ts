import { ec } from "elliptic";
import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";
import { format } from "url";

import {
    DaiTokenInstance, DEXAdapterInstance, DEXInstance, DEXReserveInstance, ERC20Instance,
    ERC20ShiftedInstance, ShifterInstance, ShifterRegistryInstance, TestTokenInstance,
} from "../types/truffle-contracts";
import { ETHEREUM_TOKEN_ADDRESS, NULL } from "./helper/testUtils";

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
        shifter1 = await Shifter.new(token1.address, feeRecipeint, mintAuthority.address, shifterFees.toNumber(), zBTCMinShiftOutAmount.toNumber());
        await token1.transferOwnership(shifter1.address);
        await shifter1.claimTokenOwnership();

        token2 = await zZEC.new();
        shifter2 = await Shifter.new(token2.address, feeRecipeint, mintAuthority.address, shifterFees.toNumber(), zZECMinShiftOutAmount.toNumber());
        await token2.transferOwnership(shifter2.address);
        await shifter2.claimTokenOwnership();

        token3 = await TestToken.new("TestToken1", "TST", 18);

        dexReserve1 = await DEXReserve.new(dai.address, token1.address, dexFees.toNumber());
        dexReserve2 = await DEXReserve.new(dai.address, token2.address, dexFees.toNumber());
        dexReserve3 = await DEXReserve.new(dai.address, token3.address, dexFees.toNumber());

        dex = await DEX.new(dai.address, dexFees.toNumber());
        await dex.registerReserve(token1.address, dexReserve1.address);
        await dex.registerReserve(token2.address, dexReserve2.address);
        await dex.registerReserve(token3.address, dexReserve3.address);

        shifterRegistry = await ShifterRegistry.new();
        await shifterRegistry.setShifter(token1.address, shifter1.address);
        await shifterRegistry.setShifter(token2.address, shifter2.address);

        dexAdapter = await DEXAdapter.new(dex.address, shifterRegistry.address);
    });

    const removeFee = (value, bips) => value.sub(value.mul(new BN(bips)).div(new BN(10000)))

    const depositToReserve = async (value: BN, token: ERC20Instance, reserve: DEXReserveInstance) => {
        await dai.approve(reserve.address, value.toNumber());
        await token.approve(reserve.address, removeFee(value, shifterFees.toNumber()));
        await reserve.addLiquidity(accounts[0], value.toNumber(), removeFee(value, 10), 10000000000000);
    };

    const shiftToReserve = async (value: BN, token: ERC20Instance, reserve: DEXReserveInstance, shifter: ShifterInstance) => {
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = await dexAdapter.hashLiquidityPayload.call(accounts[0], value, token.address, value, 10000000000000, "0x002002002");
        // const types = ["address", "uint256", "address", "uint256", "uint256", "bytes"];
        // const pHash = web3.utils.keccak256(web3.eth.abi.encodeParameters(types, [accounts[0], value.toString(), token.address, value.toString(), 10000000000000, "0x002002002"]));
        const hash = await shifter.hashForSignature.call(pHash, value, dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dai.approve(reserve.address, value.toNumber());
        await dexAdapter.addLiquidity(accounts[0], value.toNumber(), token.address, 10000000000000, "0x002002002", value.toNumber(), nHash, sigString);
    };

    const shiftFromReserve = async (token: ERC20Instance, reserve: DEXReserveInstance) => {
        const liquidity = await reserve.balanceOf.call(accounts[0]);
        await reserve.approve(dexAdapter.address, liquidity);
        await dexAdapter.removeLiquidity(token.address, liquidity, "0x0011001100110011");
    }

    const withdrawFromReserve = async (reserve: DEXReserveInstance) => {
        const liquidity = await reserve.balanceOf.call(accounts[0]);
        await reserve.removeLiquidity(liquidity);
    }

    it("should fail when trying to trade dai to token1 on DEX before funding the reserve", async () => {
        const value = new BN(225000);
        const amount = await dex.calculateReceiveAmount.call(dai.address, token1.address, value);

        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dai.approve(dexAdapter.address, value.toNumber());
        await dexAdapter.trade(
            // Payload:
            dai.address, token1.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, pHash,
        ).should.be.rejectedWith(/reserve has no funds/);
    });

    it("should fail when trying to trade token1 to dai on DEX before funding the reserv", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(22500);
        const commitment = await dexAdapter.hashTradePayload.call(
            token1.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature.call(commitment, value.toNumber(), dexAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await dexAdapter.trade(
            // Payload:
            token1.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
            // Required
            value.toNumber(), nHash, sigString,
        ).should.be.rejectedWith(/reserve has no funds/);
    });

    it("should deposit token1 to the reserve1", async () => {
        const value = new BN(20000000000);
        await shiftToReserve(value, token1, dexReserve1, shifter1);
    });

    it("should deposit token2 to the reserve2", async () => {
        const value = new BN(20000000000);
        await shiftToReserve(value, token2, dexReserve2, shifter2);
    });

    it("should deposit token3 to the reserve3", async () => {
        const value = new BN(20000000000);
        await depositToReserve(value, token3, dexReserve3);
    });

    it("should trade dai to token1 on DEX", async () => {
        const value = new BN(225000);
        const amount = await dex.calculateReceiveAmount.call(dai.address, token1.address, value);

        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dai.approve(dexAdapter.address, value.toNumber());
        await dexAdapter.trade(
            // Payload:
            dai.address, token1.address, 0, "0x002200220022", 100000,
            "0x010101010101",
            // Required
            value.toNumber(), nHash, pHash,
        );
    });

    it("should trade dai to token2 on DEX", async () => {
        const value = new BN(22500);
        const nHash = `0x${randomBytes(32).toString("hex")}`;
        const pHash = `0x${randomBytes(32).toString("hex")}`;
        await dai.approve(dexAdapter.address, value.toNumber());
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
        await dai.approve(dexAdapter.address, value.toNumber());
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
        const commitment = await dexAdapter.hashTradePayload.call(
            token1.address, token2.address, 0, "0x002200220022",
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature.call(commitment, value.toNumber(), dexAdapter.address, nHash);
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
        const commitment = await dexAdapter.hashTradePayload.call(
            token2.address, token1.address, 0, "0x002200220022",
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature.call(commitment, value.toNumber(), dexAdapter.address, nHash);
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
        const commitment = await dexAdapter.hashTradePayload.call(
            token1.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature.call(commitment, value.toNumber(), dexAdapter.address, nHash);
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

    it("should trade token2 to dai on DEX", async () => {
        const nHash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(22500);
        const commitment = await dexAdapter.hashTradePayload.call(
            token2.address, dai.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature.call(commitment, value.toNumber(), dexAdapter.address, nHash);
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
        const commitment = await dexAdapter.hashTradePayload.call(
            token1.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter1.hashForSignature.call(commitment, value.toNumber(), dexAdapter.address, nHash);
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
        const commitment = await dexAdapter.hashTradePayload.call(
            token2.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await shifter2.hashForSignature.call(commitment, value.toNumber(), dexAdapter.address, nHash);
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

    it("should withdraw dai and token1 from the reserve1", async () => await shiftFromReserve(token1, dexReserve1));
    it("should withdraw dai and token2 from the reserve2", async () => await shiftFromReserve(token2, dexReserve2));
    it("should withdraw dai and token3 from the reserve3", async () => await withdrawFromReserve(dexReserve3));
});