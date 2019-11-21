import Web3 from "web3";
import { HttpProvider } from "web3-providers";

interface InjectedEthereum extends HttpProvider {
    enable: () => Promise<void>;
    send: <T, X extends unknown[] = []>(name: string, args?: X) => Promise<T>;
    on: (event: string, callback?: () => void) => void;
    autoRefreshOnNetworkChange?: boolean;
}

declare global {
    interface Window {
        ethereum?: InjectedEthereum;
        web3?: Web3;
    }
}

export const getWeb3 = async () => new Promise<Web3>(async (resolve, reject) => {
    // Modern dApp browsers...
    if (window.ethereum) {

        try {
            // See https://medium.com/metamask/no-longer-reloading-pages-on-network-change-fbf041942b44
            // We will want to support the network changing without reloading in
            // the future.
            window.ethereum.on("chainChanged", () => {
                document.location.reload();
            });
            window.ethereum.autoRefreshOnNetworkChange = false;
        } catch (error) {
            // Ignore
        }

        try {
            // See https://metamask.github.io/metamask-docs/API_Reference/Ethereum_Provider#ethereum.send(%E2%80%98eth_requestaccounts%E2%80%99)
            await window.ethereum.send<string[]>("eth_requestAccounts");
            resolve(new Web3(window.ethereum));
        } catch (error) {
            try {
                // Request account access if needed
                await window.ethereum.enable();
                resolve(new Web3(window.ethereum));
            } catch (error) {
                reject(error);
            }
        }
    } else if (window.web3) {
        // Accounts always exposed
        resolve(new Web3(window.web3.currentProvider));
    } else {
        // Non-dApp browsers...
        reject(new Error(`No Web3 detected.`));
    }
});
