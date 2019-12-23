/// <reference types="../types/truffle-contracts" />
const hashjs = require('hash.js');

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

const BTCPuzzle = artifacts.require("BTCPuzzle");

const networks = require("./networks.js");

const generateSecretMessage = (secret) => {
    return `Secret(${secret})`;
};

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network}...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;

    const renNetwork = addresses.renNetwork || networks.config.renNetwork;

    /*
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
    */

    /** PUZZLES **************************************************************/

    const maxGasPrice = web3.utils.toWei("21", "gwei");
    const secret = "helloWorld";
    const msg = generateSecretMessage(secret);
    const hash = hashjs.sha256().update(msg).digest("hex");
    deployer.logger.log(`secret hash is: 0x${hash}`);
    await deployer.deploy(
        BTCPuzzle,
        ShifterRegistry.address,
        `0x${hash}`,
        maxGasPrice,
    );
    const puz = await BTCPuzzle.at(BTCPuzzle.address);
    const validSecret = await puz.validateSecret(web3.utils.fromAscii(secret));
    deployer.logger.log(`valid?: ${validSecret}`);
    if (validSecret) {
        deployer.logger.log("secret is valid");
    } else {
        deployer.logger.log("secret is not valid");
    }

    /** LOG *******************************************************************/

    /*
    deployer.logger.log({
        DEX: DEX.address,
        DEXAdapter: DEXAdapter.address,
        BTC_DAI_Reserve: BTC_DAI_Reserve.address,
        ZEC_DAI_Reserve: ZEC_DAI_Reserve.address,
        BCH_DAI_Reserve: BCH_DAI_Reserve.address,
    });
    */
}