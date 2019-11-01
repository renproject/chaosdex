require("ts-node/register");
require("dotenv").config();

const path = require("path");
// @ts-ignore
const packageJSON = require("./package.json");

const HDWalletProvider = require("truffle-hdwallet-provider");

const { execSync } = require("child_process")

const GWEI = 1000000000;
const commitHash = execSync("git describe --always --long").toString().trim();

if ((process.env.NETWORK || "").match(/devnet|testnet|chaosnet|mainnet/) && process.env.INFURA_KEY === undefined) {
    throw new Error("Must set INFURA_KEY");
}


module.exports = {
    networks: {
        devnet: {
            // @ts-ignore
            provider: () => new HDWalletProvider(process.env.MNEMONIC_KOVAN, `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`),
            network_id: 42,
            gas: 6721975,
            gasPrice: 10 * GWEI,
        },
        testnet: {
            // @ts-ignore
            provider: () => new HDWalletProvider(process.env.MNEMONIC_KOVAN, `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`),
            network_id: 42,
            gas: 6721975,
            gasPrice: 10 * GWEI,
        },
        chaosnet: {
            // @ts-ignore
            provider: () => new HDWalletProvider(process.env.MNEMONIC_MAINNET, `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`),
            network_id: 1,
            gas: 6721975,
            gasPrice: 5 * GWEI,
        },
        development: {
            host: "localhost",
            port: 8545,
            network_id: "*",
        },
        coverage: {
            host: "localhost",
            network_id: "*",
            port: 8555,         // <-- If you change this, also set the port option in .solcover.js.
            gas: 0xfffffffffff, // <-- Use this high gas value
            gasPrice: 0x01      // <-- Use this low gas price
        },
        develop: {
            port: 8545
        },
    },
    mocha: {
        // // Use with `npm run test`, not with `npm run coverage`
        // reporter: 'eth-gas-reporter',
        // reporterOptions: {
        //   currency: 'USD',
        //   gasPrice: 21
        // },
        enableTimeouts: false,
        useColors: true,
        bail: false,
    },
    compilers: {
        solc: {
            version: "0.5.12",
            settings: {
                evmVersion: "petersburg",
                optimizer: {
                    enabled: true,
                    runs: 200,
                }
            }
        }
    },
    plugins: [
        "truffle-plugin-verify"
    ],
    api_keys: {
        etherscan: process.env.ETHERSCAN_KEY,
    },
    verify: {
        preamble: `
Deployed by Ren Project, https://renproject.io

Commit hash: ${commitHash}
Repository: https://github.com/renproject/darknode-sol
Issues: https://github.com/renproject/darknode-sol/issues

Licenses
openzeppelin-solidity: (MIT) https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/LICENSE
darknode-sol: (GNU GPL V3) https://github.com/renproject/darknode-sol/blob/master/LICENSE
`
    },
    contracts_build_directory: path.join(__dirname, packageJSON.config.truffleBuildPath, process.env.NETWORK || "development"),
};
