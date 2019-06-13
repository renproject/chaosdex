import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { Token } from "../state/generalTypes";
import { ETH_NETWORK_ID, NETWORK } from "./environmentVariables";

export const getTokenAddress = (token: Token): string => {
    // eslint-disable-next-line
    switch (NETWORK) {
        case "mainnet":
            // eslint-disable-next-line
            switch (token) {
                case Token.DAI:
                    return "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359";
                case Token.ETH:
                    return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
                case Token.BTC:
                    throw new Error("No address");
                case Token.ZEC:
                    throw new Error("No address");
                case Token.REN:
                    return "0x408e41876cCCDC0F92210600ef50372656052a38";
            }
            break;
        case "testnet":
            // eslint-disable-next-line
            switch (token) {
                case Token.DAI:
                    return "0xc4375b7de8af5a38a93548eb8453a498222c4ff2";
                case Token.ETH:
                    return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
                case Token.BTC:
                    return "0xFd44199b94EA4398aEa3dD5E1014e550D4cC5b9B";
                case Token.ZEC:
                    return "0xd67256552f93b39ac30083b4b679718a061feae6";
                case Token.REN:
                    return "0x2cd647668494c1b15743ab283a0f980d90a87394";
            }
            break;
        case "local":
            // eslint-disable-next-line
            switch (token) {
                case Token.DAI:
                    const deployedDaiNetworks = require("../contracts/DaiToken.json").networks;
                    return deployedDaiNetworks[ETH_NETWORK_ID].address;
                case Token.ETH:
                    return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
                case Token.BTC:
                    const deployedBtcNetworks = require("../contracts/zBTC.json").networks;
                    return deployedBtcNetworks[ETH_NETWORK_ID].address;
                case Token.ZEC:
                    const deployedZecNetworks = require("../contracts/zZEC.json").networks;
                    return deployedZecNetworks[ETH_NETWORK_ID].address;
                case Token.REN:
                    const deployedRenNetworks = require("../contracts/RenToken.json").networks;
                    return deployedRenNetworks[ETH_NETWORK_ID].address;
            }
            break;
    }
    throw new Error(`Unknown network ${NETWORK} or token ${token}`);
};

export const getRenExAddress = (): string => {
    // eslint-disable-next-line
    switch (NETWORK) {
        case "mainnet":
            throw new Error("No address");
        case "testnet":
            // eslint-disable-next-line
            return "0x0dF3510a4128c0cA11518465f670dB970E9302B7";
            // export const RENEX_ADAPTER_ADDRESS = "0x8cFbF788757e767392e707ACA1Ec18cE26e570fc";
        case "local":
            const renExNetworks = require("../contracts/RenEx.json").networks;
            return renExNetworks[ETH_NETWORK_ID].address;
    }
    throw new Error(`Unknown network ${NETWORK}`);
};

export const getRenExAdapterAddress = (): string => {
    // eslint-disable-next-line
    switch (NETWORK) {
        case "mainnet":
            throw new Error("No address");
        case "testnet":
            return "0x8cFbF788757e767392e707ACA1Ec18cE26e570fc";
        case "local":
            const renExNetworks = require("../contracts/RenExAdapter.json").networks;
            return renExNetworks[ETH_NETWORK_ID].address;
    }
    throw new Error(`Unknown network ${NETWORK}`);
};

interface AbiJson {
    abi: AbiItem[];
    network: {
        [network: string]: {
            address: string;
        }
    };
}

export const getContractInstance = (web3: Web3, contractPath: string) => {
    // tslint:disable-next-line:non-literal-require
    const contract: AbiJson = require(contractPath);
    return new web3.eth.Contract(contract.abi, contract.network[ETH_NETWORK_ID].address);
};

export const getTokenDecimals = (token: Token): number => {
    switch (token) {
        case Token.DAI:
            return 18;
        case Token.ETH:
            return 18;
        case Token.BTC:
            return 8;
        case Token.ZEC:
            return 8;
        case Token.REN:
            return 18;
    }
};
