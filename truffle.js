const path = require("path");
require("ts-node/register");
require("dotenv").config();

const HDWalletProvider = require("truffle-hdwallet-provider");

const GWEI = 3000000000;

module.exports = {
  networks: {
    kovan: {
      // @ts-ignore
      provider: () => new HDWalletProvider(process.env.MNEMONIC_KOVAN, `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`),
      network_id: 42,
      gas: 6721975,
      gasPrice: 10 * GWEI,
    },
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
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
    bail: true,
  },
  compilers: {
    solc: {
      version: "0.5.8",
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
  contracts_build_directory: path.join(__dirname, "client/src/contracts"),
};