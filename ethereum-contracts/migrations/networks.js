const BN = require("bn.js");
const ren = require("@renproject/contracts");

const config = {
    VERSION: "1.0.0",
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL: 2, // 14400 in production
    DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS: 300, // 300 for testnet (5 minutes in seconds), 86400 in mainnet testing (1 day), 2628000 in production (1 month in seconds)
    mintAuthority: "0x723eb4380E03dF6a6f98Cc1338b00cfBE5E45218", // Darknode public key
    shiftInFee: 10,
    shiftOutFee: 10,
    zBTCMinShiftOutAmount: 10000,
    zZECMinShiftOutAmount: 10000,
    zBCHMinShiftOutAmount: 10000,
    dexFees: 10,
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
        DEX: "0xf65d91333B1d4d3887016b17741aD602d7768594",
        DEXAdapter: "0x9992e9341e496bE5bC8F424DFC1f78A7388D3A58",
        BTC_DAI_Reserve: '0x2c4Ce444252FBeB762d789D6457D2BD530E292f6',
        ZEC_DAI_Reserve: '0xa08b74DaA6ea1ca4397D1e0C14C517f535A7839c',
        config: {
            ...config,
            mintAuthority: ren.chaosnet.renVM.mintAuthority,
        },
    },
    testnet: {
        renNetwork: ren.testnet,
        DEX: '',
        DEXAdapter: '',
        BTC_DAI_Reserve: '',
        ZEC_DAI_Reserve: '',
        config: {
            ...config,
            mintAuthority: ren.testnet.renVM.mintAuthority,
        },
    },
    devnet: {
        renNetwork: ren.devnet,
        DEX: "",
        DEXAdapter: "",
        config: {
            ...config,
            mintAuthority: ren.devnet.renVM.mintAuthority,
        },
    },
    config,
}