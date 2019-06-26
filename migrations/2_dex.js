/// <reference types="../types/truffle-contracts" />

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");

const RenExReserve = artifacts.require("RenExReserve");
const RenExAdapter = artifacts.require("RenExAdapter");
const RenEx = artifacts.require("RenEx");
const DaiToken = artifacts.require("DaiToken");

const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network}...`);

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;

    BTCShifter.address = addresses.BTCShifter || BTCShifter.address;
    ZECShifter.address = addresses.ZECShifter || ZECShifter.address;
    zZEC.address = addresses.zZEC || zBTC.address;
    zBTC.address = addresses.zBTC || zBTC.address;
    RenEx.address = addresses.RenEx || "";
    RenExAdapter.address = addresses.RenExAdapter || "";
    DaiToken.address = (addresses.tokens || {}).DAI || "";

    if (!DaiToken.address) {
        await deployer.deploy(DaiToken)
    }

    if (!RenEx.address) {
        await deployer.deploy(
            RenEx,
            config.renExFees, // uint256 _feeinBIPs
        );
    }
    const renEx = await RenEx.at(RenEx.address);

    if (!RenExAdapter.address) {
        await deployer.deploy(
            RenExAdapter,
            RenEx.address, // RenEx _renex
        );
    }

    const current = await renEx.reserve(zBTC.address, DaiToken.address);
    if (current === "0x0000000000000000000000000000000000000000") {
        await deployer.deploy(
            RenExReserve
        );
        const res = await RenExReserve.at(RenExReserve.address);
        res.setShifter(zBTC.address, BTCShifter.address);
        deployer.logger.log(`[${"BTC"}, ${"DAI"}]: ${RenExReserve.address}`);
        deployer.logger.log(`[${zBTC.address}, ${DaiToken.address}]`);
        deployer.logger.log(RenExReserve.address);
        await renEx.registerReserve(zBTC.address, DaiToken.address, RenExReserve.address);
        // const dai = await DaiToken.at(DaiToken.address);
        // await dai.transfer(RenExReserve.address, "100000000000000000000");
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"BTC"}, ${"DAI"}]: ${current}\n`);
    }

    // await web3.eth.sendTransaction({ to: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66", from: accounts[0], value: web3.utils.toWei("1", "ether") });

    /** LOG *******************************************************************/

    deployer.logger.log(JSON.stringify({
        RenEx: RenEx.address,
        RenExAdapter: RenExAdapter.address,
        BTCDAIReserve: RenExReserve.address,
    }, undefined, "    "));
}