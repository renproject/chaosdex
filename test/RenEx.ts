import { ec } from "elliptic";
import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";

import {
    ERC20ShiftedInstance, RenExAdapterInstance, RenExInstance, RenExReserveInstance,
    RenShiftInstance, TestTokenInstance,
} from "../types/truffle-contracts";
import { ETHEREUM_TOKEN_ADDRESS } from "./helper/testUtils";

const TestToken = artifacts.require("TestToken");
const ERC20Shifted = artifacts.require("ERC20Shifted");
const RenShift = artifacts.require("RenShift");
const RenExReserve = artifacts.require("RenExReserve");
const RenEx = artifacts.require("RenEx");
const RenExAdapter = artifacts.require("RenExAdapter");
const secp256k1 = new ec("secp256k1");

contract("RenEx", (accounts) => {
    let renshift: RenShiftInstance;
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

    const ownerAccount = web3.eth.accounts.create();
    const privKey = Buffer.from(ownerAccount.privateKey.slice(2), "hex");
    const renShiftFees = new BN(10);
    const renExFees = new BN(10);

    before(async () => {
        renshift = await RenShift.new(ownerAccount.address, accounts[1], renShiftFees);
        await renshift.newShiftedToken("TestShifter1", "ts1", 8);
        await renshift.newShiftedToken("TestShifter2", "ts2", 8);
        const token1Address = await renshift.shiftedTokens("ts1");
        const token2Address = await renshift.shiftedTokens("ts2");
        token1 = await ERC20Shifted.at(token1Address);
        token2 = await ERC20Shifted.at(token2Address);
        token3 = await TestToken.new("TestToken1", "tst1", 18);
        renExReserve1 = await RenExReserve.new(renshift.address);
        renExReserve2 = await RenExReserve.new(renshift.address);
        renExReserve12 = await RenExReserve.new(renshift.address);
        renExReserve13 = await RenExReserve.new(renshift.address);
        renExReserve23 = await RenExReserve.new(renshift.address);
        renExReserve3 = await RenExReserve.new(renshift.address);
        renex = await RenEx.new(renExFees);
        await renex.registerReserve(token1.address, ETHEREUM_TOKEN_ADDRESS, renExReserve1.address);
        await renex.registerReserve(token2.address, ETHEREUM_TOKEN_ADDRESS, renExReserve2.address);
        await renex.registerReserve(token1.address, token2.address, renExReserve12.address);
        await renex.registerReserve(token1.address, token3.address, renExReserve13.address);
        await renex.registerReserve(token2.address, token3.address, renExReserve23.address);
        await renex.registerReserve(token3.address, ETHEREUM_TOKEN_ADDRESS, renExReserve3.address);
        renexAdapter = await RenExAdapter.new(renex.address, renshift.address);
    });

    it("should deposit token1 to the wallet", async () => {
        const value = new BN(200000000000);
        const txhash = `0x${randomBytes(32).toString("hex")}`;
        const hash = await renshift.sigHash(token1.address, renExReserve12.address, value.toNumber(), txhash, "0x00");
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renshift.shiftIn(token1.address, renExReserve12.address, value.toNumber(), txhash, "0x00", sigString);
    });

    it("should deposit token1 to the wallet (1)", async () => {
        const value = new BN(200000000000);
        const txhash = `0x${randomBytes(32).toString("hex")}`;
        const hash = await renshift.sigHash(token1.address, renExReserve1.address, value.toNumber(), txhash, "0x00");
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renshift.shiftIn(token1.address, renExReserve1.address, value.toNumber(), txhash, "0x00", sigString);
    });

    it("should deposit token2 to the wallet", async () => {
        const value = new BN(200000000000);
        const txhash = `0x${randomBytes(32).toString("hex")}`;
        const hash = await renshift.sigHash(token2.address, renExReserve12.address, value.toNumber(), txhash, "0x00");
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renshift.shiftIn(token2.address, renExReserve12.address, value.toNumber(), txhash, "0x00", sigString);
    });

    it("should deposit token2 to the wallet (2)", async () => {
        const value = new BN(200000000000);
        const txhash = `0x${randomBytes(32).toString("hex")}`;
        const hash = await renshift.sigHash(token2.address, renExReserve2.address, value.toNumber(), txhash, "0x00");
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renshift.shiftIn(token2.address, renExReserve2.address, value.toNumber(), txhash, "0x00", sigString);
    });

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
        const txhash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.commitment(
            token1.address, token2.address, 0, "0x002200220022",
            100000, "0x010101010101",
        );
        const hash = await renshift.sigHash(token1.address, renexAdapter.address, value.toNumber(), txhash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            token1.address, token2.address, 0, "0x002200220022",
            100000, "0x010101010101",
            value.toNumber(), txhash, sigString,
        );
    });

    it("should trade token2 to token1 on RenEx", async () => {
        const txhash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.commitment(
            token2.address, token1.address, 0, "0x002200220022",
            100000, "0x010101010101",
        );
        const hash = await renshift.sigHash(token2.address, renexAdapter.address, value.toNumber(), txhash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            token2.address, token1.address, 0, "0x002200220022",
            100000, "0x010101010101",
            value.toNumber(), txhash, sigString,
        );
    });

    it("should trade eth to token1 on RenEx", async () => {
        const value = new BN(200);
        await renexAdapter.trade(
            ETHEREUM_TOKEN_ADDRESS, token1.address, 0, "0x002200220022",
            100000, "0x010101010101",
            value.toNumber(), "0x00", "0x00",
            { from: accounts[3], value: value.toNumber() },
        );
    });

    it("should trade eth to token2 on RenEx", async () => {
        const value = new BN(200);
        await renexAdapter.trade(
            ETHEREUM_TOKEN_ADDRESS, token2.address, 0, "0x002200220022",
            100000, "0x010101010101",
            value.toNumber(), "0x00", "0x00",
            { from: accounts[3], value: value.toNumber() },
        );
    });

    it("should trade eth to token3 on RenEx", async () => {
        const value = new BN(200);
        await renexAdapter.trade(
            ETHEREUM_TOKEN_ADDRESS, token3.address, 0, accounts[3],
            100000, accounts[3],
            value.toNumber(), "0x00", "0x00",
            { from: accounts[3], value: value.toNumber() },
        );
    });

    it("should trade token1 to eth on RenEx", async () => {
        const txhash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.commitment(
            token1.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await renshift.sigHash(token1.address, renexAdapter.address, value.toNumber(), txhash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            token1.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
            value.toNumber(), txhash, sigString,
        );
    });

    it("should trade token2 to eth on RenEx", async () => {
        const txhash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.commitment(
            token2.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await renshift.sigHash(token2.address, renexAdapter.address, value.toNumber(), txhash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            token2.address, ETHEREUM_TOKEN_ADDRESS, 0, accounts[3],
            100000, "0x010101010101",
            value.toNumber(), txhash, sigString,
        );
    });

    it("should trade token1 to token3 on RenEx", async () => {
        const txhash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.commitment(
            token1.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await renshift.sigHash(token1.address, renexAdapter.address, value.toNumber(), txhash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            token1.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
            value.toNumber(), txhash, sigString,
        );
    });

    it("should trade token2 to token3 on RenEx", async () => {
        const txhash = `0x${randomBytes(32).toString("hex")}`
        const value = new BN(200);
        const commitment = await renexAdapter.commitment(
            token2.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
        );
        const hash = await renshift.sigHash(token2.address, renexAdapter.address, value.toNumber(), txhash, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;
        await renexAdapter.trade(
            token2.address, token3.address, 0, accounts[3],
            100000, "0x010101010101",
            value.toNumber(), txhash, sigString,
        );
    });
});