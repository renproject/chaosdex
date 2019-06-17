import Web3 from "web3";
import { AbiItem } from "web3-utils";

import { Token } from "../state/generalTypes";
import { NETWORK } from "./environmentVariables";
import { getWeb3 } from "./getWeb3";

export const getTokenAddress = async (token: Token): Promise<string> => {
    const web3 = await getWeb3();
    const networkID = await web3.eth.net.getId();

    // eslint-disable-next-line
    switch (token) {
        case Token.DAI:
            console.log(`Accessing network for ${Token.DAI}`);
            const deployedDaiNetworks = require("../contracts/DaiToken.json").networks;
            return deployedDaiNetworks[networkID].address;
        case Token.ETH:
            console.log(`Accessing network for ${Token.ETH}`);
            return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        case Token.BTC:
            console.log(`Accessing network for ${Token.BTC}`);
            const deployedBtcNetworks = require("../contracts/zBTC.json").networks;
            return deployedBtcNetworks[networkID].address;
        case Token.ZEC:
            console.log(`Accessing network for ${Token.ZEC}`);
            const deployedZecNetworks = require("../contracts/zZEC.json").networks;
            return deployedZecNetworks[networkID].address;
        // case Token.REN:
        //     console.log(`Accessing network for ${Token.REN}`);
        //     const deployedRenNetworks = require("../contracts/RenToken.json").networks;
        //     return deployedRenNetworks[networkID].address;
    }
};

export const getRenExAddress = async (): Promise<string> => {
    const web3 = await getWeb3();
    const networkID = await web3.eth.net.getId();
    const renExNetworks = require("../contracts/RenEx.json").networks;
    return renExNetworks[networkID].address;
};

export const getRenExAdapterAddress = async (): Promise<string> => {
    const web3 = await getWeb3();
    const networkID = await web3.eth.net.getId();

    const renExNetworks = require("../contracts/RenExAdapter.json").networks;
    return renExNetworks[networkID].address;
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
