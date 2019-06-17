/// <reference types="../types/truffle-contracts" />

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");

const NULL = "0x0000000000000000000000000000000000000000";

const RenExReserve = artifacts.require("RenExReserve");
const RenExAdapter = artifacts.require("RenExAdapter");
const RenEx = artifacts.require("RenEx");
const DaiToken = artifacts.require("DaiToken");

const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network}...`);

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const _mintAuthority = config.owner || accounts[0];
    // TODO: _feeRecipient should be the DarknodePayment contract
    // There should be a 0_darknode_payment.js that deploys it before the shifter contracts
    const _feeRecipient = accounts[0];

    BTCShifter.address = addresses.BTCShifter || "";
    ZECShifter.address = addresses.ZECShifter || "";
    zZEC.address = addresses.zZEC || "";
    zBTC.address = addresses.zBTC || "";
    RenEx.address = addresses.RenEx || "";
    RenExAdapter.address = addresses.RenExAdapter || "";
    DaiToken.address = addresses.DaiToken || "";

    const renExFees = 0;

    /** BTC *******************************************************************/

    if (!zBTC.address) {
        await deployer.deploy(zBTC, "Shifted Bitcoin", "zBTC", 8);
    }
    const zbtc = await zBTC.at(zBTC.address);

    if (!BTCShifter.address) {
        await deployer.deploy(
            BTCShifter,
            "0x0000000000000000000000000000000000000000",
            zBTC.address,
            _feeRecipient,
            _mintAuthority,
            config.shifterFees,
        );
    }
    const btcShifter = await BTCShifter.at(BTCShifter.address);

    if (await zbtc.owner() !== BTCShifter.address) {
        await zbtc.mint(accounts[0], "10000000000");
        await zbtc.transferOwnership(BTCShifter.address);
        await btcShifter.claimTokenOwnership();
    }

    /** ZEC *******************************************************************/

    if (!zZEC.address) {
        await deployer.deploy(zZEC, "Shifted ZCash", "zZEC", 8);
    }
    const zzec = await zZEC.at(zZEC.address);

    if (!ZECShifter.address) {
        await deployer.deploy(
            ZECShifter,
            "0x0000000000000000000000000000000000000000",
            zZEC.address,
            _feeRecipient,
            _mintAuthority,
            config.shifterFees,
        );
    }
    const zecShifter = await ZECShifter.at(ZECShifter.address);

    if (await zzec.owner() !== ZECShifter.address) {
        await zzec.mint(accounts[0], "10000000000");
        await zzec.transferOwnership(ZECShifter.address);
        await zecShifter.claimTokenOwnership();
    }

    /** EVERYTHING ELSE *******************************************************/

    if (!DaiToken.address) {
        await deployer.deploy(DaiToken)
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
        );
    }

    const current = await renEx.reserve(zBTC.address, DaiToken.address);
    if (current === "0x0000000000000000000000000000000000000000") {
        await deployer.deploy(
            RenExReserve
        );
        const res = await RenExReserve.at(RenExReserve.address);
        res.setShifter(zBTC.address, BTCShifter.address);
        console.log(`[${"BTC"}, ${"DAI"}]: ${RenExReserve.address}`);
        console.log(`[${zBTC.address}, ${DaiToken.address}]`);
        console.log(RenExReserve.address);
        await renEx.registerReserve(zBTC.address, DaiToken.address, RenExReserve.address);
        await zbtc.transfer(RenExReserve.address, "10000000000");
        const dai = await DaiToken.at(DaiToken.address);
        await dai.transfer(RenExReserve.address, "100000000000000000000");
    } else {
        console.log(`\nUsing existing reserve for [${"BTC"}, ${"DAI"}]: ${current}\n`);
    }

    await web3.eth.sendTransaction({ to: "0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66", from: accounts[0], value: web3.utils.toWei("1", "ether") });

    /** LOG *******************************************************************/

    console.log({
        BTCShifter: BTCShifter.address,
        ZECShifter: ZECShifter.address,
        zBTC: zBTC.address,
        zZEC: zZEC.address,
        RenEx: RenEx.address,
        RenExAdapter: RenExAdapter.address,
        BTCDAIReserve: RenExReserve.address,
    });
}