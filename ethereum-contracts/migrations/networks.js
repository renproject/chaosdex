const BN = require("bn.js");
const ren = require("@renproject/contracts");

const config = {
    VERSION: "1.0.0",
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL: 2, // 14400 in production
    DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS: 300, // 300 for testnet (5 minutes in seconds), 86400 in mainnet testing (1 day), 2628000 in production (1 month in seconds)
    mintAuthority: "0x723eb4380E03dF6a6f98Cc1338b00cfBE5E45218", // Darknode public key
    shifterFees: 10,
    zBTCMinShiftOutAmount: 10000,
    zZECMinShiftOutAmount: 10000,
    dexFees: 0,
    renNetwork: {
        addresses: {
            tokens: {
                REN: "",
                DAI: "",
            },
            ren: {
                DarknodeSlasher: "",
                DarknodeRegistry: "",
                DarknodeRegistryStore: "",
                DarknodePaymentStore: "",
                DarknodePayment: "",
            },
            shifter: {
                BTCShifter: "",
                ZECShifter: "",
                ShifterRegistry: "",
                zZEC: "",
                zBTC: "",
            },
        },
    },
}

module.exports = {
    mainnet: {
        renNetwork: ren.mainnet,
        DEX: "",
        DEXAdapter: "",
        config: {
            ...config,
            mintAuthority: "TODO",
        },
    },
    testnet: {
        renNetwork: ren.testnet,
        DEX: '0x6Be14F3ce70c72876aBb07b54F5DA8E75Be7F4a7',
        DEXAdapter: '0x467371C80B4d92837876E40d9610E893D26C36BA',
        BTC_DAI_Reserve: '0x0a3ea20A2942677df300361e0F32c296b0AC2158',
        ZEC_DAI_Reserve: '0xA100f837b913901AeD82EcB011891b75e9842Ce5',
        config: {
            ...config,
            mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",
        },
    },
    devnet: {
        renNetwork: ren.devnet,
        DEX: "0x641aBd6CC3E5CbDDAf2586A906d7F694C4d1ee2E",
        DEXAdapter: "0x33094b0124f8623A05ccB55c1840477B0019aAfB",
        config: {
            ...config,
            mintAuthority: "0x723eb4380E03dF6a6f98Cc1338b00cfBE5E45218",
        },
    },
    config,
}