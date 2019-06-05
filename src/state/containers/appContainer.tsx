import { Currency } from "@renex/react-components";
import BigNumber from "bignumber.js";
import { List, Map } from "immutable";
import { Container } from "unstated";

import { tokenAddresses } from "../../lib/contractAddresses";
import {
    Commitment, DexSDK, OrderInputs, RENEX_ADAPTER_ADDRESS, ReserveBalances,
} from "../../lib/dexSDK";
import { NETWORK } from "../../lib/environmentVariables";
import { _catchBackgroundErr_, _catchInteractionErr_ } from "../../lib/errors";
import { estimatePrice } from "../../lib/estimatePrice";
import { history } from "../../lib/history";
import { getMarket, getTokenPricesInCurrencies } from "../../lib/market";
import { btcAddressToHex } from "../../lib/shiftSDK/blockchain/btc";
import { strip0x } from "../../lib/shiftSDK/blockchain/common";
import { ShiftedInResponse, ShiftedOutResponse } from "../../lib/shiftSDK/darknode/darknodeGroup";
import { isERC20, isEthereumBased } from "../../lib/shiftSDK/eth/eth";
import { Chain, UTXO } from "../../lib/shiftSDK/shiftSDK";
import { MarketPair, Token, Tokens } from "../generalTypes";

// const transferEvent = [{
//     "indexed": true,
//     "name": "from",
//     "type": "address"
// },
// {
//     "indexed": true,
//     "name": "to",
//     "type": "address"
// },
// {
//     "indexed": false,
//     "name": "tokens",
//     "type": "uint256"
// }
// ];

export interface Tx {
    hash: string;
    chain: Chain;
}

const BitcoinTx = (hash: string) => ({ hash, chain: Chain.Bitcoin });
// const ZCashTx = (hash: string) => ({ hash, chain: Chain.ZCash });
const EthereumTx = (hash: string) => ({ hash, chain: Chain.Ethereum });

export interface HistoryEvent {
    time: number; // Seconds since Unix epoch
    inTx: Tx | null;
    outTx: Tx | null;
    orderInputs: OrderInputs;
    complete: boolean;
}

const initialOrder: OrderInputs = {
    srcToken: Token.BTC,
    dstToken: Token.DAI,
    srcAmount: "0.01",
    dstAmount: "0",
};

const initialState = {
    address: null as string | null,
    tokenPrices: Map<Token, Map<Currency, number>>(),
    accountBalances: Map<Token, BigNumber>(),
    balanceReserves: Map<MarketPair, ReserveBalances>(),
    dexSDK: new DexSDK(),

    orderInputs: initialOrder,
    confirmedOrderInputs: null as null | OrderInputs,

    confirmedTrade: false,
    submitting: false,
    toAddress: null as string | null,
    refundAddress: null as string | null,
    commitment: null as Commitment | null,
    depositAddress: null as string | null,
    depositAddressToken: null as Token | null,
    utxos: null as List<UTXO> | null,
    messageID: null as string | null,
    erc20Approved: false,
    signature: null as ShiftedInResponse | ShiftedOutResponse | null,
    inTx: null as Tx | null,
    outTx: null as Tx | null,
    amountHex: null as string | null,
};

export type OrderData = typeof initialState.orderInputs;

export class AppContainer extends Container<typeof initialState> {
    public state = initialState;

    public connect = async (): Promise<void> => {
        const { dexSDK } = this.state;
        await dexSDK.connect();

        const addresses = await dexSDK.web3.eth.getAccounts();
        await this.setState({ address: addresses.length > 0 ? addresses[0] : null });
        await this.updateAccountBalances();
    }

    public clearAddress = async (): Promise<void> => {
        await this.setState({ address: null });
    }

    // Token prices ////////////////////////////////////////////////////////////

    public updateTokenPrices = async (): Promise<void> => {
        const tokenPrices = await getTokenPricesInCurrencies();
        await this.setState({ tokenPrices });
    }

    public updateBalanceReserves = async (): Promise<void> => {
        const { balanceReserves,
            dexSDK } = this.state;
        let newBalanceReserves = balanceReserves;
        const marketPairs = [MarketPair.DAI_BTC, MarketPair.ETH_BTC, MarketPair.REN_BTC, MarketPair.ZEC_BTC];
        const res = await dexSDK.getReserveBalance(marketPairs); // Promise<Array<Map<Token, BigNumber>>> => {
        marketPairs.forEach((value, index) => {
            newBalanceReserves = newBalanceReserves.set(value, res[index]);
        });
        await this.setState({ balanceReserves: newBalanceReserves });
        await this.updateReceiveValue();
    }

    // Swap inputs /////////////////////////////////////////////////////////////

    public updateSrcToken = async (srcToken: Token): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, srcToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateDstToken = async (dstToken: Token): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, dstToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    public updateSrcAmount = async (srcAmount: string): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, srcAmount } });
        await this.updateReceiveValue();
    }

    public flipSendReceive = async (): Promise<void> => {
        const { orderInputs: { srcToken, dstToken } } = this.state;
        await this.updateBothTokens(dstToken, srcToken);
    }

    public updateBothTokens = async (srcToken: Token, dstToken: Token): Promise<void> => {
        await this.setState({ orderInputs: { ...this.state.orderInputs, srcToken, dstToken } });
        await this.updateHistory();
        await this.updateReceiveValue();
    }

    // Opening order ///////////////////////////////////////////////////////////

    public onConfirmedTrade = () => {
        this.setState({ confirmedTrade: true }).catch(_catchBackgroundErr_);
        if (this.state.confirmedOrderInputs && isERC20(this.state.confirmedOrderInputs.srcToken)) {
            this.getAllowance().catch(_catchBackgroundErr_);
        }
    }

    public updateToAddress = async (toAddress: string) => {
        await this.setState({ toAddress });
    }
    public updateRefundAddress = async (refundAddress: string) => {
        await this.setState({ refundAddress });
    }

    public updateCommitment = async () => {
        const { orderInputs: order, dexSDK, toAddress, refundAddress } = this.state;
        const srcTokenDetails = Tokens.get(order.srcToken);
        if (!toAddress || !refundAddress || !srcTokenDetails) {
            throw new Error(`Required info is undefined (${toAddress}, ${refundAddress}, ${srcTokenDetails})`);
        }
        const blockNumber = await dexSDK.web3.eth.getBlockNumber();
        let hexRefundAddress = refundAddress;
        if (order.srcToken === Token.BTC) {
            hexRefundAddress = btcAddressToHex(refundAddress);
        }
        let hexToAddress = toAddress;
        if (order.dstToken === Token.BTC) {
            hexToAddress = btcAddressToHex(toAddress);
        }
        const commitment: Commitment = {
            srcToken: tokenAddresses(order.srcToken, "testnet"),
            dstToken: tokenAddresses(order.dstToken, "testnet"),
            minDestinationAmount: new BigNumber(0),
            srcAmount: new BigNumber(order.srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals)),
            toAddress: hexToAddress,
            refundBlockNumber: blockNumber + 360, // 360 blocks (assuming 0.1bps, equals 1 hour)
            refundAddress: hexRefundAddress,
            orderInputs: order,
        };
        if (isEthereumBased(order.srcToken)) {
            await this.setState({ commitment });
        } else {
            const depositAddress = await dexSDK.generateAddress(order.srcToken, commitment);
            const depositAddressToken = order.srcToken;
            await this.setState({ commitment, depositAddress, depositAddressToken });
        }
    }

    public updateDeposits = async () => {
        const { dexSDK, depositAddress, depositAddressToken } = this.state;
        if (!depositAddressToken || !depositAddress) {
            return;
        }
        const utxos = await dexSDK.retrieveDeposits(depositAddressToken, depositAddress);
        if (!this.state.utxos || (utxos.length >= this.state.utxos.size)) {
            await this.setState({ utxos: List(utxos) });
        }
    }

    public submitDeposit = async () => {
        const { dexSDK, commitment, utxos, depositAddressToken } = this.state;
        if (!commitment || !depositAddressToken || !utxos || utxos.size === 0) {
            throw new Error(`Invalid values required to submit deposit`);
        }
        const messageID = await dexSDK.submitDeposit(depositAddressToken, utxos.get(0)!, commitment);
        await this.setState({ messageID });
    }

    public submitBurn = async () => {
        const { dexSDK, commitment, amountHex } = this.state;
        if (!commitment || !amountHex) {
            throw new Error(`Invalid values required to submit burn`);
        }
        const messageID = await dexSDK.submitBurn(commitment, amountHex);
        this.setState({ messageID }).catch(_catchBackgroundErr_);
    }

    public submitSwap = async () => {
        const { address, dexSDK, commitment, signature } = this.state;
        if (!address || !commitment) {
            console.error(`address: ${address}`);
            console.error(`commitment: ${commitment}`);
            throw new Error(`Invalid values required for swap`);
        }

        const promiEvent = dexSDK.submitSwap(address, commitment, signature);
        const transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));

        if (isEthereumBased(commitment.orderInputs.dstToken)) {
            this.setState({ outTx: EthereumTx(transactionHash) }).catch(_catchInteractionErr_);
            return;
        }

        await new Promise((resolve, reject) => {
            let submitted = false;
            promiEvent.on("confirmation", async () => {
                if (!submitted) {
                    submitted = true;

                    try {
                        const receipt = await dexSDK.web3.eth.getTransactionReceipt(transactionHash);

                        /*
                        // Example log:
                        {
                            address: "",
                            blockHash: "0xf45bb29e86499cb9270fac41a522e2229d135e64facdb41c5f206bda6cd11a10",
                            blockNumber: 11354259,
                            data: "0x00000000000000000000000000000000000000000000000000000000000003ca",
                            id: "log_0xcb6de4ec665873cd9782fca0a23b686b9ccb68c775ef27746d83af0c7ba0be5e",
                            logIndex: 7,
                            removed: false,
                            topics: [
                                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                                "0x0000000000000000000000008cfbf788757e767392e707aca1ec18ce26e570fc",
                                "0x0000000000000000000000000000000000000000000000000000000000000000",
                            ],
                            transactionHash: "0x9d489c404e39326da77a7a2252c2bcfc4ec66140cc32064f0d5eb141a87bf29f",
                            transactionIndex: 0,
                            transactionLogIndex: "0x7",
                            type: "mined",
                        }
                        */

                        // Loop through logs to find burn log
                        for (const log of receipt.logs) {
                            if (
                                log.address.toLowerCase() === tokenAddresses(Token.BTC, NETWORK || "").toLowerCase() &&
                                log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef".toLowerCase() &&
                                log.topics[1] === `0x000000000000000000000000${strip0x(RENEX_ADAPTER_ADDRESS)}`.toLowerCase() &&
                                log.topics[2] === "0x0000000000000000000000000000000000000000000000000000000000000000".toLowerCase()
                            ) {
                                const amountHex = parseInt(log.data, 16).toString(16); // TODO: create "strip" function
                                this.setState({ amountHex }).catch(_catchInteractionErr_);
                                resolve();
                            }
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
            });
        });

        this.setState({ inTx: EthereumTx(transactionHash) }).catch(_catchInteractionErr_);
    }

    public getHistoryEvent = async () => {
        const { inTx, outTx, commitment } = this.state;
        if (!commitment) {
            return;
        }
        const historyItem: HistoryEvent = {
            inTx,
            outTx,
            orderInputs: commitment.orderInputs,
            time: Date.now() / 1000,
            complete: false,
        };

        await this.resetTrade();
        return historyItem;
    }

    public updateMessageStatus = async () => {
        const { dexSDK, messageID, commitment } = this.state;
        if (!messageID || !commitment) {
            return;
        }
        try {
            const messageResponse = await dexSDK.shiftStatus(messageID);
            await this.setState({ signature: messageResponse });

            if (isEthereumBased(commitment.orderInputs.dstToken)) {
                this.setState({ inTx: BitcoinTx(messageResponse.txHash) }).catch(_catchInteractionErr_);
            } else {
                this.setState({ outTx: BitcoinTx(messageResponse.txHash) }).catch(_catchInteractionErr_);
            }

        } catch (error) {
            if (`${error}`.match("Signature not available")) {
                return;
            }
            console.error(error);
        }
    }

    public setSubmitting = async (submitting: boolean) => {
        await this.setState({
            submitting,
            confirmedOrderInputs: { ...this.state.orderInputs },
        });
    }

    public resetTrade = async () => {
        await this.setState({
            confirmedTrade: false,
            submitting: false,
            toAddress: null,
            refundAddress: null,
            commitment: null,
            depositAddress: null,
            depositAddressToken: null,
            utxos: null,
            messageID: null,
            signature: null,
            erc20Approved: false,
            inTx: null,
            outTx: null,
            amountHex: null,
        });
    }

    public sufficientBalance = (): boolean => {
        const { orderInputs: { srcToken, srcAmount }, accountBalances } = this.state;
        // We can't know the balance if it's not an Ethereum token
        if (!isEthereumBased(srcToken)) {
            return true;
        }

        // Fetch information about srcToken
        const srcTokenDetails = Tokens.get(srcToken);
        if (!srcTokenDetails) {
            return false;
        }
        const srcAmountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
        const balance = accountBalances.get(srcToken) || new BigNumber(0);
        if (srcAmountBN.isNaN()) {
            return true;
        }
        return srcAmountBN.lte(balance);
    }

    public updateAccountBalances = async (): Promise<void> => {
        const { dexSDK, address } = this.state;
        if (!address) {
            return;
        }
        let accountBalances = this.state.accountBalances;
        const ethTokens = [Token.ETH, Token.DAI, Token.REN];
        const promises = ethTokens.map(token => dexSDK.fetchEthereumTokenBalance(token, address));
        const balances = await Promise.all(promises);
        balances.forEach((bal, index) => {
            accountBalances = accountBalances.set(ethTokens[index], bal);
        });

        await this.setState({ accountBalances });
    }

    public getAllowance = async () => {
        const { orderInputs: { srcToken, srcAmount }, dexSDK, address } = this.state;
        const srcTokenDetails = Tokens.get(srcToken);
        if (!address || !srcTokenDetails) {
            this.setState({ erc20Approved: false }).catch(_catchBackgroundErr_);
            return;
        }
        const srcAmountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
        const allowance = await dexSDK.getTokenAllowance(srcToken, address);
        this.setState({ erc20Approved: allowance.gte(srcAmountBN) }).catch(_catchBackgroundErr_);
    }

    public setAllowance = async () => {
        const { orderInputs: { srcToken, srcAmount }, dexSDK, address } = this.state;
        const srcTokenDetails = Tokens.get(srcToken);
        if (!address || !srcTokenDetails) {
            this.setState({ erc20Approved: false }).catch(_catchBackgroundErr_);
            return;
        }
        const srcAmountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));
        const allowance = await dexSDK.setTokenAllowance(srcAmountBN, srcToken, address);
        this.setState({ erc20Approved: allowance.gte(srcAmountBN) }).catch(_catchBackgroundErr_);
    }

    private readonly updateReceiveValue = async (): Promise<void> => {
        const { orderInputs: { srcToken, dstToken, srcAmount } } = this.state;
        const market = getMarket(srcToken, dstToken);
        if (market) {
            const reserves = this.state.balanceReserves.get(market);

            const dstAmount = await estimatePrice(srcToken, dstToken, srcAmount, reserves);
            await this.setState({ orderInputs: { ...this.state.orderInputs, dstAmount: dstAmount.toFixed() } });
        }
    }

    private readonly updateHistory = async (): Promise<void> => {
        const { orderInputs: { srcToken, dstToken } } = this.state;
        history.replace(`/?send=${srcToken}&receive=${dstToken}`);
    }
}
