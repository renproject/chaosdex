import { Token } from "../state/generalTypes";

const network = process.env.REACT_APP_NETWORK;

// tslint:disable: non-literal-require
export const syncGetTokenAddress = (networkID: number, token: Token): string => {
    // eslint-disable-next-line
    switch (token) {
        case Token.DAI:
            const deployedDaiNetworks = require(`../contracts/${network}/DaiToken.json`).networks;
            return deployedDaiNetworks[networkID].address;
        case Token.ETH:
            return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        case Token.BTC:
            const deployedBtcNetworks = require(`../contracts/${network}/zBTC.json`).networks;
            return deployedBtcNetworks[networkID].address;
        case Token.ZEC:
            const deployedZecNetworks = require(`../contracts/${network}/zZEC.json`).networks;
            return deployedZecNetworks[networkID].address;
        // case Token.REN:
        //     const deployedRenNetworks = require(`../contracts/${network}/RenToken.json`).networks;
        //     return deployedRenNetworks[networkID].address;
    }
};

// tslint:disable: non-literal-require
export const syncGetDEXReserveAddress = (networkID: number, token: Token): string => {
    // eslint-disable-next-line
    switch (token) {
        case Token.BTC:
            const deployedBTCReserveNetworks = require(`../contracts/${network}/BTC_DAI_Reserve.json`).networks;
            return deployedBTCReserveNetworks[networkID].address;
        case Token.ZEC:
            const deployedZECReserveNetworks = require(`../contracts/${network}/ZEC_DAI_Reserve.json`).networks;
            return deployedZECReserveNetworks[networkID].address;
    }
    return "";
};

export const syncGetDEXAddress = (networkID: number): string => {
    const renExNetworks = require(`../contracts/${network}/DEX.json`).networks;
    return renExNetworks[networkID].address;
};

export const syncGetDEXAdapterAddress = (networkID: number): string => {
    const renExNetworks = require(`../contracts/${network}/DEXAdapter.json`).networks;
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
