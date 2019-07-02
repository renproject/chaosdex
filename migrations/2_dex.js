/// <reference types="../types/truffle-contracts" />

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");

const DEXReserve = artifacts.require("DEXReserve");
const DEXAdapter = artifacts.require("DEXAdapter");
const DEX = artifacts.require("DEX");
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
    DEX.address = addresses.DEX || "";
    DEXAdapter.address = addresses.DEXAdapter || "";
    DaiToken.address = (addresses.tokens || {}).DAI || "";

    if (!DaiToken.address) {
        await deployer.deploy(DaiToken)
    }

    if (!DEX.address) {
        await deployer.deploy(
            DEX,
            config.dexFees, // uint256 _feeinBIPs
        );
    }
    const dex = await DEX.at(DEX.address);

    if (!DEXAdapter.address) {
        await deployer.deploy(
            DEXAdapter,
            DEX.address,
        );
    }

    const current = await dex.reserve(zBTC.address, DaiToken.address);
    if (current === "0x0000000000000000000000000000000000000000") {
        await deployer.deploy(
            DEXReserve
        );
        const res = await DEXReserve.at(DEXReserve.address);
        res.setShifter(zBTC.address, BTCShifter.address);
        deployer.logger.log(`[${"BTC"}, ${"DAI"}]: ${DEXReserve.address}`);
        deployer.logger.log(`[${zBTC.address}, ${DaiToken.address}]`);
        deployer.logger.log(DEXReserve.address);
        await dex.registerReserve(zBTC.address, DaiToken.address, DEXReserve.address);
        await res.approve(zBTC.address, dex.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
        await res.approve(DaiToken.address, dex.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
        // const dai = await DaiToken.at(DaiToken.address);
        // await dai.transfer(DEXReserve.address, "100000000000000000000");
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"BTC"}, ${"DAI"}]: ${current}\n`);
    }

    // await web3.eth.sendTransaction({ to: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66", from: accounts[0], value: web3.utils.toWei("1", "ether") });

    /** LOG *******************************************************************/

    deployer.logger.log(JSON.stringify({
        DEX: DEX.address,
        DEXAdapter: DEXAdapter.address,
        BTCDAIReserve: DEXReserve.address,
    }, undefined, "    "));
}