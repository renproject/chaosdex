/// <reference types="../types/truffle-contracts" />

const NULL = "0x0000000000000000000000000000000000000000";

const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");
const BTCShifter = artifacts.require("BTCShifter");
const ZECShifter = artifacts.require("ZECShifter");
const RenExReserve = artifacts.require("RenExReserve");
const RenExAdapter = artifacts.require("RenExAdapter");
const RenEx = artifacts.require("RenEx");
const DaiToken = artifacts.require("DaiToken");
const RenToken = artifacts.require("RenToken");

let owner, vault, renShiftFees, renExFees;
let btc, zec, dai, ren;

const eth = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

module.exports = async function (deployer, network, accounts) {

    if (network.match("kovan")) {
        owner = "0xe02cabac3a62655335b1227dfdecfff27b5f6111"; // Darknode public key
        vault = "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66"; // Fee recipient
        renShiftFees = 0;
        renExFees = 0;

        btc = "";
        zec = "";
        dai = "0xc4375b7de8af5a38a93548eb8453a498222c4ff2";
        ren = "0x2cd647668494c1b15743ab283a0f980d90a87394";

        RenExAdapter.address = "";
        RenEx.address = "";
    } else if (network.match("development") || network.match("develop")) {
        owner = "0xe02cabac3a62655335b1227dfdecfff27b5f6111"; // Darknode public key
        vault = accounts[1]; // Fee recipient
        renShiftFees = 0;
        renExFees = 0;

        btc = "";
        zec = "";
        await deployer.deploy(DaiToken);
        dai = DaiToken.address;
        await deployer.deploy(RenToken);
        ren = RenToken.address;

        BTCShifter.address = "";
        ZECShifter.address = "";
        RenExAdapter.address = "";
        RenEx.address = "";
    } else {
        throw new Error(`Unsupported network ${network}`);
    }

    // For verifying ERC20Shifted source code
    // if (!btc) {
    //     await deployer.deploy(ERC20Shifted, "Shifted Bitcoin", "zBTC", 8);
    // }
    // return;

    if (!btc) {
        await deployer.deploy(zBTC)
        btc = (await zBTC.at(zBTC.address)).address;
        console.log(`[BTC]: ${btc}`);
    }
    if (!BTCShifter.address) {
        await deployer.deploy(
            BTCShifter,
            NULL,
            btc,
            owner, // address _owner
            vault, // address _vault
            renShiftFees, // uint16 _fee
        );
    }

    if (!zec) {
        await deployer.deploy(zZEC);
        zec = (await zZEC.at(zZEC.address)).address;
        console.log(`[ZEC]: ${zec}`);
    }
    if (!ZECShifter.address) {
        await deployer.deploy(
            ZECShifter,
            NULL,
            zec,
            owner, // address _owner
            vault, // address _vault
            renShiftFees, // uint16 _fee
        );
    }

    if (!RenEx.address) {
        await deployer.deploy(
            RenEx,
            renExFees, // uint256 _feeinBIPs
        );
    }
    const renEx = await RenEx.at(RenEx.address);

    if (!RenExAdapter.address) {
        await deployer.deploy(
            RenExAdapter,
            RenEx.address, // RenEx _renex
        );
    }

    const tokenMap = {
        btc,
        zec,
        dai,
        eth,
        ren
    };
    const shifterMap = {
        btc: BTCShifter.address,
        zec: ZECShifter.address,
    }
    const tokens = ["btc", "zec", "dai", "eth", "ren"]
    console.log(`Deploying reserves:`);
    for (let i = 0; i < tokens.length - 1; i++) {
        for (let j = i + 1; j < tokens.length; j++) {
            console.log(`[${tokens[i]}, ${tokens[j]}]`);
            console.log(tokenMap[tokens[i]]);
            console.log(tokenMap[tokens[j]]);

            const current = await renEx.reserve(tokenMap[tokens[i]], tokenMap[tokens[j]]);
            if (current === "0x0000000000000000000000000000000000000000") {
                await deployer.deploy(
                    RenExReserve
                );
                const res = await RenExReserve.at(RenExReserve.address);
                for (tok in [tokens[i], tokens[j]]) {
                    if (Object.keys(shifterMap).includes(tok)) {
                        res.setShifter(tokenMap[tok], shifterMap[tok]);
                    }
                }
                console.log(`[${tokens[i]}, ${tokens[j]}]: ${RenExReserve.address}`);
                await renEx.registerReserve(tokenMap[tokens[i]], tokenMap[tokens[j]], RenExReserve.address);
            } else {
                console.log(`\nUsing existing reserve for [${tokens[i]}, ${tokens[j]}]: ${current}\n`);
            }

        }
    }
}
