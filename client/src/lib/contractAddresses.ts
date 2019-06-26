import { AbiItem } from "web3-utils";

import { Token } from "../state/generalTypes";
import { NETWORK } from "./environmentVariables";
import { getWeb3 } from "./getWeb3";

// tslint:disable: non-literal-require
export const syncGetTokenAddress = (networkID: number, token: Token): string => {
    // eslint-disable-next-line
    switch (token) {
        case Token.DAI:
            const deployedDaiNetworks = require(`../contracts/testnet/DaiToken.json`).networks;
            return deployedDaiNetworks[networkID].address;
        case Token.ETH:
            return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        case Token.BTC:
            const deployedBtcNetworks = require(`../contracts/testnet/zBTC.json`).networks;
            return deployedBtcNetworks[networkID].address;
        case Token.ZEC:
            const deployedZecNetworks = require(`../contracts/testnet/zZEC.json`).networks;
            return deployedZecNetworks[networkID].address;
        // case Token.REN:
        //     const deployedRenNetworks = require(`../contracts/testnet/RenToken.json`).networks;
        //     return deployedRenNetworks[networkID].address;
    }
};

export const getTokenAddress = async (token: Token): Promise<string> => {
    const web3 = await getWeb3();
    const networkID = await web3.eth.net.getId();
    return syncGetTokenAddress(networkID, token);
};

export const syncGetRenExAddress = (networkID: number): string => {
    const renExNetworks = require(`../contracts/testnet/RenEx.json`).networks;
    return renExNetworks[networkID].address;
};

export const getRenExAddress = async (): Promise<string> => {
    const web3 = await getWeb3();
    const networkID = await web3.eth.net.getId();
    return syncGetRenExAddress(networkID);
};

export const syncGetRenExAdapterAddress = (networkID: number): string => {
    const renExNetworks = require(`../contracts/testnet/RenExAdapter.json`).networks;
    return renExNetworks[networkID].address;
};

export const getRenExAdapterAddress = async (): Promise<string> => {
    const web3 = await getWeb3();
    const networkID = await web3.eth.net.getId();
    return syncGetRenExAdapterAddress(networkID);
};

interface AbiJson {
    abi: AbiItem[];
    network: {
        [network: string]: {
            address: string;
        }
    };
}

// export const getContractInstance = async (web3: Web3, contractPath: string) => {
//     const web3 = await getWeb3();
//     const networkID = await web3.eth.net.getId();

//     // tslint:disable-next-line:non-literal-require
//     const contract: AbiJson = require(contractPath);
//     return new web3.eth.Contract(contract.abi, contract.network[networkID].address);
// };

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
        // case Token.REN:
        //     return 18;
    }
};
