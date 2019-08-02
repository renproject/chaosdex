/// <reference types="../types/truffle-contracts" />

const BN = require("bn.js");

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");

const BTC_DAI_Reserve = artifacts.require("BTC_DAI_Reserve");
const ZEC_DAI_Reserve = artifacts.require("ZEC_DAI_Reserve");
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
    DEX.address = DEX.address || addresses.DEX || "";
    DEXAdapter.address = DEXAdapter.address || addresses.DEXAdapter || "";
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

    const deployReserve = async (leftToken, rightToken, Reserve) => {
        await deployer.deploy(Reserve);
        const res = await Reserve.at(Reserve.address);
        await res.setShifter(leftToken.address, BTCShifter.address);
        await dex.registerReserve(leftToken.address, rightToken.address, Reserve.address);
        const maxApproval = new BN(2).pow(new BN(256)).sub(new BN(1)).toString();
        await res.approve(leftToken.address, dex.address, maxApproval);
        await res.approve(rightToken.address, dex.address, maxApproval);
        // const dai = await rightToken.at(rightToken.address);
        // await dai.transfer(Reserve.address, "100000000000000000000");
    }

    const btcDaiReserve = await dex.reserve(zBTC.address, DaiToken.address);
    if (btcDaiReserve === "0x0000000000000000000000000000000000000000") {
        await deployReserve(zBTC, DaiToken, BTC_DAI_Reserve);
        deployer.logger.log(`[${"BTC"}, ${"DAI"}]: ${BTC_DAI_Reserve.address}`);
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"BTC"}, ${"DAI"}]: ${btcDaiReserve}\n`);
    }

    const zecDaiReserve = await dex.reserve(zZEC.address, DaiToken.address);
    if (zecDaiReserve === "0x0000000000000000000000000000000000000000") {
        await deployReserve(zZEC, DaiToken, ZEC_DAI_Reserve);
        deployer.logger.log(`[${"ZEC"}, ${"DAI"}]: ${ZEC_DAI_Reserve.address}`);
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"ZEC"}, ${"DAI"}]: ${zecDaiReserve}\n`);
    }

    // await web3.eth.sendTransaction({ to: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66", from: accounts[0], value: web3.utils.toWei("1", "ether") });

    /** LOG *******************************************************************/

    deployer.logger.log(JSON.stringify({
        DEX: DEX.address,
        DEXAdapter: DEXAdapter.address,
        BTC_DAI_Reserve: BTC_DAI_Reserve.address,
        ZEC_DAI_Reserve: ZEC_DAI_Reserve.address,
    }, undefined, "    "));
}