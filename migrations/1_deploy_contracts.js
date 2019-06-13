/// <reference types="../types/truffle-contracts" />

const ERC20 = artifacts.require("ERC20");
const RenShift = artifacts.require("RenShift");
const RenExReserve = artifacts.require("RenExReserve");
const RenExAdapter = artifacts.require("RenExAdapter");
const RenEx = artifacts.require("RenEx");
const DaiToken = artifacts.require("DaiToken");
const RenToken = artifacts.require("RenToken");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");

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

        RenShift.address = "";
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

        RenShift.address = "";
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

    if (!RenShift.address) {
        await deployer.deploy(
            RenShift,
            owner, // address _owner
            vault, // address _vault
            renShiftFees, // uint16 _fee
        );
    }
    const renShift = await RenShift.at(RenShift.address);

    if (!btc) {
        await deployer.deploy(zBTC);
        const zbtcInstance = await zBTC.at(zBTC.address);
        await zbtcInstance.mint(accounts[0], "98765432123456789");
        await zbtcInstance.transferOwnership(RenShift.address);
        await renShift.setShiftedToken(zBTC.address, "zBTC");
        btc = await renShift.shiftedTokens("zBTC");
        console.log(`[BTC]: ${btc}`);
    }
    const btcInst = await ERC20.at(btc);
    const ownerBtcBal = await btcInst.balanceOf(accounts[0]);
    console.log(`btc owner bal: ${ownerBtcBal.toString()}`);

    if (!zec) {
        await deployer.deploy(zZEC);
        const zzecInstance = await zZEC.at(zZEC.address);
        await zzecInstance.mint(accounts[0], "98765432123456789");
        await zzecInstance.transferOwnership(RenShift.address);
        await renShift.setShiftedToken(zZEC.address, "zZEC");
        // await renShift.newShiftedToken("Shifted ZCash", "zZEC", 8);
        zec = await renShift.shiftedTokens("zZEC");
        console.log(`[ZEC]: ${zec}`);
    }
    const zecInst = await ERC20.at(zec);
    const ownerZecBal = await zecInst.balanceOf(accounts[0]);
    console.log(`Zec owner bal: ${ownerZecBal.toString()}`);


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
            RenShift.address, // RenShift _renshift
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
                    RenShift.address,
                );
                if (tokenMap[tokens[i]] !== eth) {
                    const ercInstanceI = await ERC20.at(tokenMap[tokens[i]]);
                    const ownerBalI = await ercInstanceI.balanceOf(accounts[0]);
                    console.log(`owner balance of ${tokens[i]}: ${ownerBalI.toString()}`);
                    await ercInstanceI.transfer(RenExReserve.address, "3000000000000000");
                    const ercBalanceI = await ercInstanceI.balanceOf(RenExReserve.address);
                    console.log(`balance of ${tokens[i]}: ${ercBalanceI.toString()}`);
                }
                if (tokenMap[tokens[j]] !== eth) {
                    const ercInstanceJ = await ERC20.at(tokenMap[tokens[j]]);
                    const ownerBalJ = await ercInstanceJ.balanceOf(accounts[0]);
                    console.log(`owner balance of ${tokens[i]}: ${ownerBalJ.toString()}`);
                    await ercInstanceJ.transfer(RenExReserve.address, "3000000000000000");
                    const ercBalanceJ = await ercInstanceJ.balanceOf(RenExReserve.address);
                    console.log(`balance of ${tokens[j]}: ${ercBalanceJ.toString()}`);
                }
                console.log(`[${tokens[i]}, ${tokens[j]}]: ${RenExReserve.address}`);
                console.log(`[${tokenMap[tokens[i]]}, ${tokenMap[tokens[j]]}]`);
                console.log(RenExReserve.address);
                await renEx.registerReserve(tokenMap[tokens[i]], tokenMap[tokens[j]], RenExReserve.address);
            } else {
                console.log(`\nUsing existing reserve for [${tokens[i]}, ${tokens[j]}]: ${current}\n`);
            }
        }
    }
}
