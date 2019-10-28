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
    dexFees: 20,
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
    chaosnet: {
        renNetwork: ren.chaosnet,
        DEX: '0xbD0C94BC27824A76C1eBDaAc3a9f5FAbEc6985B7',
        DEXAdapter: '0xaF0EfC4E638A43a27A21d218d07c7499f85F8042',
        BTC_DAI_Reserve: '0x11716a1F51FaD053E9B43dA1025E8ace32aee110',
        ZEC_DAI_Reserve: '0x7B3b7383Bc88b645bdEfD7624d9c6FB981407bf9',
        config: {
            ...config,
            mintAuthority: ren.chaosnet.renVM.mintAuthority,
        },
    },
    testnet: {
        renNetwork: ren.testnet,
        DEX: '0x8da562d3d67B5832a834181Fc3345B306689DDbE',
        DEXAdapter: '0x0246DB1836c0fad9b6B5f3c4E642Af81b444Bbf8',
        BTC_DAI_Reserve: '0x426034F4B7C82b2DF1c06349A995E70F35B0C57B',
        ZEC_DAI_Reserve: '0xF2Ac666b592A2debEB0EceC60e3cdB0302B6266E',
        config: {
            ...config,
            mintAuthority: ren.testnet.renVM.mintAuthority,
        },
    },
    devnet: {
        renNetwork: ren.devnet,
        DEX: "0x641aBd6CC3E5CbDDAf2586A906d7F694C4d1ee2E",
        DEXAdapter: "0x33094b0124f8623A05ccB55c1840477B0019aAfB",
        config: {
            ...config,
            mintAuthority: ren.devnet.renVM.mintAuthority,
        },
    },
    config,
}