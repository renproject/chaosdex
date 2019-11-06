/// <reference types="../types/truffle-contracts" />

const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");
const zBCH = artifacts.require("zBCH");
const ShifterRegistry = artifacts.require("ShifterRegistry");

const BTC_DAI_Reserve = artifacts.require("BTC_DAI_Reserve");
const ZEC_DAI_Reserve = artifacts.require("ZEC_DAI_Reserve");
const BCH_DAI_Reserve = artifacts.require("BCH_DAI_Reserve");
const DEXAdapter = artifacts.require("DEXAdapter");
const DEX = artifacts.require("DEX");
const DaiToken = artifacts.require("DaiToken");

const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network}...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;

    const renNetwork = addresses.renNetwork || networks.config.renNetwork;

    DEX.address = addresses.DEX || "";
    DEXAdapter.address = addresses.DEXAdapter || "";
    DaiToken.address = renNetwork.addresses.tokens.DAI.address || "";

    if (!DaiToken.address) {
        await deployer.deploy(DaiToken)
    }

    if (!DEX.address) {
        await deployer.deploy(
            DEX,
            DaiToken.address,
        );
    }
    const dex = await DEX.at(DEX.address);

    if (!DEXAdapter.address) {
        await deployer.deploy(
            DEXAdapter,
            DEX.address,
            ShifterRegistry.address,
        );
    }

    deployer.logger.log("Deploying reserves...");

    const deployReserve = async (quoteToken, baseToken, Reserve) => {
        await deployer.deploy(Reserve, baseToken.address, quoteToken.address, config.dexFees);
        const res = await Reserve.at(Reserve.address);
        await dex.registerReserve(quoteToken.address, Reserve.address);
        // const dai = await rightToken.at(rightToken.address);
        // await dai.transfer(Reserve.address, "100000000000000000000");
    }

    BTC_DAI_Reserve.address = await dex.reserves(zBTC.address);
    if (BTC_DAI_Reserve.address === "0x0000000000000000000000000000000000000000") {
        await deployReserve(zBTC, DaiToken, BTC_DAI_Reserve);
        deployer.logger.log(`[${"BTC"}, ${"DAI"}]: ${BTC_DAI_Reserve.address}`);
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"BTC"}, ${"DAI"}]: ${BTC_DAI_Reserve.address}\n`);
    }

    ZEC_DAI_Reserve.address = await dex.reserves(zZEC.address);
    if (ZEC_DAI_Reserve.address === "0x0000000000000000000000000000000000000000") {
        await deployReserve(zZEC, DaiToken, ZEC_DAI_Reserve);
        deployer.logger.log(`[${"ZEC"}, ${"DAI"}]: ${ZEC_DAI_Reserve.address}`);
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"ZEC"}, ${"DAI"}]: ${ZEC_DAI_Reserve.address}\n`);
    }

    BCH_DAI_Reserve.address = await dex.reserves(zBCH.address);
    if (BCH_DAI_Reserve.address === "0x0000000000000000000000000000000000000000") {
        await deployReserve(zBCH, DaiToken, BCH_DAI_Reserve);
        deployer.logger.log(`[${"BCH"}, ${"DAI"}]: ${BCH_DAI_Reserve.address}`);
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"BCH"}, ${"DAI"}]: ${BCH_DAI_Reserve.address}\n`);
    }

    // await web3.eth.sendTransaction({ to: "", from: accounts[0], value: web3.utils.toWei("1", "ether") });

    /** LOG *******************************************************************/

    deployer.logger.log({
        DEX: DEX.address,
        DEXAdapter: DEXAdapter.address,
        BTC_DAI_Reserve: BTC_DAI_Reserve.address,
        ZEC_DAI_Reserve: ZEC_DAI_Reserve.address,
        BCH_DAI_Reserve: BCH_DAI_Reserve.address,
    });
}