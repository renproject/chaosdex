import { Token } from "../state/generalTypes";

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

export const syncGetDEXAddress = (networkID: number): string => {
    const renExNetworks = require(`../contracts/testnet/DEX.json`).networks;
    return renExNetworks[networkID].address;
};

export const syncGetDEXAdapterAddress = (networkID: number): string => {
    const renExNetworks = require(`../contracts/testnet/DEXAdapter.json`).networks;
    return renExNetworks[networkID].address;
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
        // case Token.REN:
        //     return 18;
    }
};
