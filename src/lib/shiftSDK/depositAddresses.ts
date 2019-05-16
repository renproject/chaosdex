export const TODO = "todo";

// import BigNumber from "bignumber.js";
// import { List, Map as ImmutableMap } from "immutable";
// import Web3 from "web3";
// import { Contract } from "web3-eth-contract";

// import {
//     BitcoinUTXO, btcAddressToHex, createBTCTestnetAddress, getBTCTestnetUTXOs,
// } from "./blockchain/btc";
// import {
//     createZECTestnetAddress, getZECTestnetUTXOs, ZcashUTXO, zecAddressToHex,
// } from "./blockchain/zec";
// import { bridgedToken, zBTCAddress, zZECAddress } from "./eth/eth";

// export enum Currency {
//     BTC = "btc",
//     ZEC = "zec",
//     ETH = "eth"
// }
// export const CurrencyList = [Currency.BTC, Currency.ZEC, Currency.ETH];

// export const CurrencyDecimals = (currency: Currency): number => {
//     switch (currency) {
//         case Currency.BTC:
//             return 8;
//         case Currency.ZEC:
//             return 8;
//         case Currency.ETH:
//             return 18;
//     }
// };

// export const CurrencyColor = (currency: Currency): string => {
//     switch (currency) {
//         case Currency.BTC:
//             return "#F09242";
//         case Currency.ZEC:
//             return "rgb(244, 183, 40)";
//         case Currency.ETH:
//             return "#627eea";
//     }
// };

// export type UTXO = { currency: Currency.BTC, utxo: BitcoinUTXO } | { currency: Currency.ZEC, utxo: ZcashUTXO };

// export class DepositAddresses {
//     public receiveAddress: string;

//     public depositAddresses: Map<Currency, string>;

//     private readonly web3: Web3;
//     private readonly zBTC: Contract;
//     private readonly zZEC: Contract;

//     constructor(web3: Web3, receiveAddress: string) {
//         this.receiveAddress = receiveAddress;

//         this.depositAddresses = (new Map<Currency, string>())
//             .set(Currency.ZEC, createZECTestnetAddress(receiveAddress))
//             .set(Currency.BTC, createBTCTestnetAddress(receiveAddress))
//             .set(Currency.ETH, receiveAddress)
//             ;

//         this.web3 = web3;
//         this.zBTC = bridgedToken(this.web3, zBTCAddress);
//         this.zZEC = bridgedToken(this.web3, zZECAddress);
//     }

//     public getUTXOs = async (limit = 10, confirmations = 0): Promise<List<UTXO>> => {
//         let utxos = List<UTXO>();

//         const btcDepositAddress = this.depositAddresses.get(Currency.BTC);
//         if (btcDepositAddress) {
//             try {
//                 const newBitcoinUTXOs: Array<{ currency: Currency.BTC, utxo: BitcoinUTXO }> = (await getBTCTestnetUTXOs(btcDepositAddress, limit, confirmations)).map(utxo => ({ currency: Currency.BTC, utxo }));
//                 utxos = utxos.concat(List(newBitcoinUTXOs));
//             } catch (error) {
//                 console.error(error);
//             }
//         }

//         const zecDepositAddress = this.depositAddresses.get(Currency.ZEC);
//         if (zecDepositAddress) {
//             try {
//                 const newZcashUTXOs: Array<{ currency: Currency.ZEC, utxo: ZcashUTXO }> = (await getZECTestnetUTXOs(zecDepositAddress, limit, confirmations)).map(utxo => ({ currency: Currency.ZEC, utxo }));
//                 utxos = utxos.concat(List(newZcashUTXOs));
//             } catch (error) {
//                 console.error(error);
//             }
//         }

//         return utxos;
//     }

//     public getBalances = async () => {
//         let balances = ImmutableMap<string, string>();

//         for (const { curr, contract } of [
//             { curr: Currency.BTC, contract: this.zBTC },
//             { curr: Currency.ZEC, contract: this.zZEC },
//         ]) {
//             if (this.web3 && contract) {
//                 try {
//                     balances = balances.set(curr, this.web3.utils.fromWei(await contract.methods.balanceOf(this.receiveAddress).call()));
//                 } catch (error) {
//                     console.error(error);
//                 }
//             }
//         }

//         return balances;
//     }

//     public getBalance = async (currency: Currency): Promise<string> => {
//         switch (currency) {
//             case Currency.BTC:
//                 return (this.web3 && this.zBTC) ?
//                     new BigNumber(await this.zBTC.methods.balanceOf(this.receiveAddress).call()).div(10 ** CurrencyDecimals(Currency.BTC)).toFixed() :
//                     "0";
//             case Currency.ZEC:
//                 return (this.web3 && this.zZEC) ?
//                     new BigNumber(await this.zZEC.methods.balanceOf(this.receiveAddress).call()).div(10 ** CurrencyDecimals(Currency.BTC)).toFixed() :
//                     "0";
//             case Currency.ETH:
//                 // return (this.web3) ?
//                 // this.web3.utils.fromWei((await this.web3.eth.getBalance(this.receiveAddress)).toString()) :
//                 return "0";
//         }
//     }

//     public burn = async (currency: Currency, to: string, amount: string) => {
//         const network = await this.web3.eth.net.getNetworkType();
//         if (network !== "kovan") {
//             throw new Error("Please change your Web3 browser network to Kovan");
//         }
//         const addresses = (await this.web3.eth.getAccounts()).map(a => a.toUpperCase());
//         if (addresses.indexOf(this.receiveAddress.toUpperCase()) === -1) {
//             throw new Error("Please switch to the selected address in your Web3 browser");
//         }

//         const contract = currency === Currency.BTC ? bridgedToken(this.web3, zBTCAddress) :
//             currency === Currency.ZEC ? bridgedToken(this.web3, zZECAddress) :
//                 undefined;

//         if (contract === undefined) {
//             throw new Error("Something went wrong, please reload and try again");
//         }

//         const toHex = currency === Currency.BTC ? btcAddressToHex(to) :
//             currency === Currency.ZEC ? zecAddressToHex(to) :
//                 to;

//         await contract.methods.burn(toHex, new BigNumber(amount).multipliedBy(10 ** CurrencyDecimals(currency)).toFixed()).send({ from: this.receiveAddress });
//         console.log("Returned from burn call.");
//     }
// }
