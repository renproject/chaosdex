/// <reference types="../types/truffle-contracts" />

const NULL = "0x0000000000000000000000000000000000000000";

const ShifterRegistry = artifacts.require("ShifterRegistry");

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");

const BCHShifter = artifacts.require("BCHShifter");
const zBCH = artifacts.require("zBCH");


const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const _mintAuthority = config.mintAuthority || accounts[0];
    const _feeRecipient = accounts[0];
    const renNetwork = addresses.renNetwork || networks.config.renNetwork;

    BTCShifter.address = (renNetwork.addresses.shifter.BTCShifter || {}).address || "";
    ZECShifter.address = (renNetwork.addresses.shifter.ZECShifter || {}).address || "";
    BCHShifter.address = (renNetwork.addresses.shifter.BCHShifter || {}).address || "";
    ShifterRegistry.address = (renNetwork.addresses.shifter.ShifterRegistry || {}).address || "";
    zBTC.address = (renNetwork.addresses.shifter.zBTC || {}).address || "";
    zZEC.address = (renNetwork.addresses.shifter.zZEC || {}).address || "";
    zBCH.address = (renNetwork.addresses.shifter.zBCH || {}).address || "";

    deployer.logger.log("Using:");
    deployer.logger.log(`BTCShifter: ${BTCShifter.address}`);
    deployer.logger.log(`ZECShifter: ${ZECShifter.address}`);
    deployer.logger.log(`BCHShifter: ${BCHShifter.address}`);
    deployer.logger.log(`ShifterRegistry: ${ShifterRegistry.address}`);
    deployer.logger.log(`zZEC: ${zZEC.address}`);
    deployer.logger.log(`zBTC: ${zBTC.address}`);
    deployer.logger.log(`zBCH: ${zBCH.address}`);

    /** Registry **************************************************************/

    if (!ShifterRegistry.address) {
        await deployer.deploy(
            ShifterRegistry,
        );
    }
    const registry = await ShifterRegistry.at(ShifterRegistry.address);

    // try {
    //     deployer.logger.log("Attempting to change cycle");
    //     await darknodePayment.changeCycle();
    // } catch (error) {
    //     deployer.logger.log("Unable to call darknodePayment.changeCycle()");
    // }

    for (const [Token, Shifter, name, symbol, decimals, minShiftOutAmount] of [
        [zBTC, BTCShifter, "Shifted Bitcoin", "zBTC", 8, config.zBTCMinShiftOutAmount],
        [zZEC, ZECShifter, "Shifted ZCash", "zZEC", 8, config.zZECMinShiftOutAmount],
        [zBCH, BCHShifter, "Shifted Bitcoin Cash", "zBCH", 8, config.zBCHMinShiftOutAmount],
    ]) {
        if (!Token.address) {
            await deployer.deploy(Token, name, symbol, decimals);
        }
        const token = await Token.at(Token.address);

        if (!Shifter.address) {
            await deployer.deploy(
                Shifter,
                Token.address,
                _feeRecipient,
                _mintAuthority,
                config.shiftInFee,
                config.shiftOutFee,
                minShiftOutAmount,
            );
        }
        const tokenShifter = await Shifter.at(Shifter.address);

        const shifterAuthority = await tokenShifter.mintAuthority.call();
        if (shifterAuthority.toLowerCase() !== _mintAuthority.toLowerCase()) {
            deployer.logger.log(`Updating fee recipient for ${symbol} shifter. Was ${shifterAuthority.toLowerCase()}, now is ${_mintAuthority.toLowerCase()}`);
            deployer.logger.log(`Updating mint authority in ${symbol} shifter`);
            await tokenShifter.updateMintAuthority(_mintAuthority);
        }

        if (await token.owner() !== Shifter.address) {
            deployer.logger.log(`Transferring ${symbol} ownership`);
            await token.transferOwnership(Shifter.address);
            deployer.logger.log(`Claiming ${symbol} ownership in shifter`);
            await tokenShifter.claimTokenOwnership();
        }

        const registered = await registry.getShifterByToken.call(Token.address);
        if (registered === NULL) {
            const otherRegistration = (await registry.getShifterBySymbol.call(symbol));
            if (otherRegistration === NULL) {
                deployer.logger.log(`Registering ${symbol} shifter`);
                await registry.setShifter(Token.address, Shifter.address);
            } else {
                deployer.logger.log(`Updating registered ${symbol} shifter`);
                await registry.updateShifter(Token.address, Shifter.address);
            }
        } else {
            deployer.logger.log(`${symbol} shifter is already registered: ${await registry.getShifterByToken.call(Token.address)}`);
        }
    }

    /** LOG *******************************************************************/

    deployer.logger.log({
        BTCShifter: BTCShifter.address,
        ZECShifter: ZECShifter.address,
        BCHShifter: BCHShifter.address,
        zBTC: zBTC.address,
        zZEC: zZEC.address,
        zBCH: zBCH.address,
        ShifterRegistry: ShifterRegistry.address,
    });
}