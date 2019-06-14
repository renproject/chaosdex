/// <reference types="../types/truffle-contracts" />

const ERC20Shifted = artifacts.require("ERC20Shifted");
const Shifter = artifacts.require("Shifter");
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

        Shifter.address = "";
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

        Shifter.address = "";
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

    if (!Shifter.address) {
        await deployer.deploy(
            Shifter,
            NULL,
            owner, // address _owner
            vault, // address _vault
            renShiftFees, // uint16 _fee
        );
    }
    const renShift = await Shifter.at(Shifter.address);

    if (!btc) {
        await renShift.newShiftedToken("Shifted Bitcoin", "zBTC", 8);
        btc = await renShift.shiftedTokens("zBTC");
        console.log(`[BTC]: ${btc}`);
    }

    if (!zec) {
        await renShift.newShiftedToken("Shifted ZCash", "zZEC", 8);
        zec = await renShift.shiftedTokens("zZEC");
        console.log(`[ZEC]: ${zec}`);
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
            Shifter.address, // Shifter _renshift
        );
    }

    const tokenMap = {
        btc,
        zec,
        dai,
        eth,
        ren
    };
    const tokens = ["btc", "zec", "dai", "eth", "ren"]
    console.log(`Deploying reserves:`);
    for (let i = 0; i < tokens.length - 1; i++) {
        for (let j = i + 1; j < tokens.length; j++) {
            console.log(`[${tokens[i]}, ${tokens[j]}]`);
            const current = await renEx.reserve(tokenMap[tokens[i]], tokenMap[tokens[j]]);
            if (current === "0x0000000000000000000000000000000000000000") {
                await deployer.deploy(
                    RenExReserve,
                    Shifter.address,
                );
                console.log(`[${tokens[i]}, ${tokens[j]}]: ${RenExReserve.address}`);
                await renEx.registerReserve(tokenMap[tokens[i]], tokenMap[tokens[j]], RenExReserve.address);
            } else {
                console.log(`\nUsing existing reserve for [${tokens[i]}, ${tokens[j]}]: ${current}\n`);
            }
        }
    }
}
