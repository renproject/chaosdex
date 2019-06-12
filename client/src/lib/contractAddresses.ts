import { Token } from "../state/generalTypes";

export const tokenAddresses = (token: Token, ethNetwork: string): string => {
    // eslint-disable-next-line
    switch (ethNetwork) {
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
                // return "0x7d6D31326b12B6CBd7f054231D47CbcD16082b71";
                case Token.REN:
                    return "0x2cd647668494c1b15743ab283a0f980d90a87394";
            }
            break;
    }
    throw new Error(`Unknown network ${ethNetwork} or token ${token}`);
};
