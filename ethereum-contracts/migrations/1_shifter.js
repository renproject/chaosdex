/// <reference types="../types/truffle-contracts" />

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve, reject) => {
        rl.question(question, (input) => resolve(input));
    });
}

const NULL = "0x0000000000000000000000000000000000000000";

const ShifterRegistry = artifacts.require("ShifterRegistry");

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");


const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const _mintAuthority = config.mintAuthority || accounts[0];
    const _feeRecipient = accounts[0];
    const renNetwork = addresses.renNetwork || networks.config.renNetwork;

    BTCShifter.address = renNetwork.addresses.shifter.BTCShifter.address || "";
    ZECShifter.address = renNetwork.addresses.shifter.ZECShifter.address || "";
    ShifterRegistry.address = renNetwork.addresses.shifter.ShifterRegistry.address || "";
    zZEC.address = renNetwork.addresses.shifter.zZEC.address || "";
    zBTC.address = renNetwork.addresses.shifter.zBTC.address || "";

    deployer.logger.log("Using:");
    deployer.logger.log(`BTCShifter: ${BTCShifter.address}`);
    deployer.logger.log(`ZECShifter: ${ZECShifter.address}`);
    deployer.logger.log(`ShifterRegistry: ${ShifterRegistry.address}`);
    deployer.logger.log(`zZEC: ${zZEC.address}`);
    deployer.logger.log(`zBTC: ${zBTC.address}`);

    /** Registry **************************************************************/

    if (!ShifterRegistry.address) {
        await deployer.deploy(
            ShifterRegistry,
        );
    }
    const registry = await ShifterRegistry.at(ShifterRegistry.address);

    /** BTC *******************************************************************/

    if (!zBTC.address) {
        await deployer.deploy(zBTC, "Shifted Bitcoin", "zBTC", 8);
    }
    const zbtc = await zBTC.at(zBTC.address);

    if (!BTCShifter.address) {
        await deployer.deploy(
            BTCShifter,
            zBTC.address,
            _feeRecipient,
            _mintAuthority,
            config.shifterFees,
            config.zBTCMinShiftOutAmount,
        );
    }
    const btcShifter = await BTCShifter.at(BTCShifter.address);

    if (await zbtc.owner() !== BTCShifter.address) {
        deployer.logger.log(`Transferring ownership of BTCShifter`);
        await zbtc.transferOwnership(BTCShifter.address);
        deployer.logger.log(`Claiming token ownership in BTCShifter`);
        await btcShifter.claimTokenOwnership();
    }

    if ((await registry.getShifterByToken(zBTC.address)) === NULL) {
        deployer.logger.log(`Registering BTC shifter`);
        await registry.setShifter(zBTC.address, BTCShifter.address);
    } else {
        deployer.logger.log(`BTC shifter is already registered: ${await registry.getShifterByToken(zBTC.address)}`);
    }

    /** ZEC *******************************************************************/

    if (!zZEC.address) {
        await deployer.deploy(zZEC, "Shifted ZCash", "zZEC", 8);
    }
    const zzec = await zZEC.at(zZEC.address);

    if (!ZECShifter.address) {
        await deployer.deploy(
            ZECShifter,
            zZEC.address,
            _feeRecipient,
            _mintAuthority,
            config.shifterFees,
            config.zZECMinShiftOutAmount,
        );
    }
    const zecShifter = await ZECShifter.at(ZECShifter.address);

    if (await zzec.owner() !== ZECShifter.address) {
        deployer.logger.log(`Transferring ownership of ZECShifter`);
        await zzec.transferOwnership(ZECShifter.address);
        deployer.logger.log(`Claiming token ownership in ZECShifter`);
        await zecShifter.claimTokenOwnership();
    }

    if ((await registry.getShifterByToken(zZEC.address)) === NULL) {
        deployer.logger.log(`Registering ZEC shifter`);
        await registry.setShifter(zZEC.address, ZECShifter.address);
    } else {
        deployer.logger.log(`ZEC shifter is already registered: ${await registry.getShifterByToken(zZEC.address)}`);
    }


    /** LOG *******************************************************************/

    deployer.logger.log({
        BTCShifter: BTCShifter.address,
        ZECShifter: ZECShifter.address,
        zBTC: zBTC.address,
        zZEC: zZEC.address,
        ShifterRegistry: ShifterRegistry.address,
    });
}