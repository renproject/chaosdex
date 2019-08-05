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

    const renNetwork = addresses.renNetwork || networks.config.renNetwork;

    deployer.logger.log("Using:");
    deployer.logger.log(`BTCShifter: ${renNetwork.addresses.shifter.BTCShifter.address}`);
    deployer.logger.log(`ZECShifter: ${renNetwork.addresses.shifter.ZECShifter.address}`);
    deployer.logger.log(`zZEC: ${renNetwork.addresses.shifter.zZEC.address}`);
    deployer.logger.log(`zBTC: ${renNetwork.addresses.shifter.zBTC.address}`);
    deployer.logger.log(`DAI: ${renNetwork.addresses.tokens.DAI.address}`);

    BTCShifter.address = renNetwork.addresses.shifter.BTCShifter.address || "";
    ZECShifter.address = renNetwork.addresses.shifter.ZECShifter.address || "";
    zZEC.address = renNetwork.addresses.shifter.zZEC.address || "";
    zBTC.address = renNetwork.addresses.shifter.zBTC.address || "";
    DEX.address = addresses.DEX || "";
    DEXAdapter.address = addresses.DEXAdapter || "";
    DaiToken.address = renNetwork.addresses.tokens.DAI.address || "";




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

    const deployReserve = async (leftToken, rightToken, Reserve, shifter) => {
        await deployer.deploy(Reserve);
        const res = await Reserve.at(Reserve.address);
        await res.setShifter(leftToken.address, shifter.address);
        await dex.registerReserve(leftToken.address, rightToken.address, Reserve.address);
        const maxApproval = new BN(2).pow(new BN(256)).sub(new BN(1)).toString();
        await res.approve(leftToken.address, dex.address, maxApproval);
        await res.approve(rightToken.address, dex.address, maxApproval);
        // const dai = await rightToken.at(rightToken.address);
        // await dai.transfer(Reserve.address, "100000000000000000000");
    }

    BTC_DAI_Reserve.address = await dex.reserve(zBTC.address, DaiToken.address);
    if (BTC_DAI_Reserve.address === "0x0000000000000000000000000000000000000000") {
        await deployReserve(zBTC, DaiToken, BTC_DAI_Reserve, BTCShifter);
        deployer.logger.log(`[${"BTC"}, ${"DAI"}]: ${BTC_DAI_Reserve.address}`);
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"BTC"}, ${"DAI"}]: ${BTC_DAI_Reserve.address}\n`);
    }

    ZEC_DAI_Reserve.address = await dex.reserve(zZEC.address, DaiToken.address);
    if (ZEC_DAI_Reserve.address === "0x0000000000000000000000000000000000000000") {
        await deployReserve(zZEC, DaiToken, ZEC_DAI_Reserve, ZECShifter);
        deployer.logger.log(`[${"ZEC"}, ${"DAI"}]: ${ZEC_DAI_Reserve.address}`);
    } else {
        deployer.logger.log(`\nUsing existing reserve for [${"ZEC"}, ${"DAI"}]: ${ZEC_DAI_Reserve.address}\n`);
    }

    // await web3.eth.sendTransaction({ to: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66", from: accounts[0], value: web3.utils.toWei("1", "ether") });

    /** LOG *******************************************************************/

    deployer.logger.log({
        DEX: DEX.address,
        DEXAdapter: DEXAdapter.address,
        BTC_DAI_Reserve: BTC_DAI_Reserve.address,
        ZEC_DAI_Reserve: ZEC_DAI_Reserve.address,
    });
}