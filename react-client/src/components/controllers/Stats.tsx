import * as React from "react";

import { Currency } from "@renproject/react-components";
import { Ox, strip0x } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { List, OrderedMap } from "immutable";
import { Log } from "web3-core";
import { sha3 } from "web3-utils";

import {
    getTokenDecimals, syncGetDEXAddress, syncGetDEXReserveAddress, syncGetDEXTradeLog,
    syncGetTokenAddress, syncGetTokenFromAddress, syncGetTransfer,
} from "../../lib/contractAddresses";
import { _catchInteractionErr_ } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { UIContainer } from "../../state/uiContainer";
import { StatsView } from "../views/StatsView";

interface Props {
}

export interface Trade {
    id: string;
    src: string;
    dst: string;
    sendAmount: BigNumber;
    recvAmount: BigNumber;
    blockNumber: number;
    transactionHash: string;
    timestamp: number;
}

const defaultVolumes = OrderedMap<Token, BigNumber>()
    .set(Token.BTC, new BigNumber(0))
    .set(Token.ZEC, new BigNumber(0))
    .set(Token.BCH, new BigNumber(0))
    ;

const defaultTokenCount = OrderedMap<Token, number>()
    .set(Token.BTC, 0)
    .set(Token.ZEC, 0)
    .set(Token.BCH, 0)
    ;

const defaultCumulativeValue = defaultTokenCount;
export type CumulativeDataPoint = { timestamp: number, blocknumber: number } & { [Token.BTC]: number, [Token.ZEC]: number, [Token.BCH]: number };
const defaultCumulativeVolume = [] as CumulativeDataPoint[];

export interface ReserveHistoryItem {
    blocknumber: number;
    timestamp: number;
    BTC_btcBalance: number;
    BTC_daiBalance: number;
    ZEC_zecBalance: number;
    ZEC_daiBalance: number;
    BCH_bchBalance: number;
    BCH_daiBalance: number;
}

interface Transfer {
    id: string;
    reserve: Token;
    token: Token;
    amount: number;
    blockNumber: number;
    timestamp: number;
}

export const Stats = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer] }) => {

        const { web3, networkID, network, preferredCurrency, tokenPrices, reserveBalances } = uiContainer.state;
        const [trades, setTrades] = React.useState<List<Trade> | null>(null);
        const [volumes, setVolumes] = React.useState(defaultVolumes);
        const [tokenCount, setTokenCount] = React.useState(defaultTokenCount);
        const [cumulativeVolume, setCumulativeVolume] = React.useState(defaultCumulativeVolume);
        const [reserveHistory, setReserveHistory] = React.useState(null as ReserveHistoryItem[] | null);
        const [loadedAt, setLoadedAt] = React.useState(new Date());

        // Refresh every 5 minutes (and only if the component is being re-rendered)
        const refresh = Math.floor((new Date()).getTime() / 1000 / (60 * 5));

        // tslint:disable-next-line: no-non-null-assertion
        const noPrices = !tokenPrices || !tokenPrices.get(Token.DAI) || !tokenPrices.get(Token.DAI)!.get(Currency.USD);

        React.useEffect(() => {
            if (noPrices) {
                return;
            }
            (async () => {

                let logs = List<Transfer>();

                const logToEvent = (reserve: Token, token: Token, negative: boolean) => (log: Log): Transfer => {
                    const decoded = web3.eth.abi.decodeLog(syncGetTransfer(), log.data, (log.topics as string[]).slice(1));
                    const tokenDecimals = getTokenDecimals(token);
                    let price = 0;
                    const tokenPriceMap = tokenPrices.get(token);
                    if (tokenPriceMap) {
                        price = tokenPriceMap.get(preferredCurrency) || 0;
                    }
                    const amount = new BigNumber(decoded.value.toString())
                        .div(new BigNumber(10).pow(tokenDecimals))
                        .times(negative ? -1 : 1)
                        .times(price)
                        .toNumber();
                    return {
                        reserve,
                        token,
                        amount,
                        id: log.transactionHash + log.logIndex,
                        blockNumber: log.blockNumber,
                        timestamp: 0,
                    };
                };

                const getLogs = async (reserveToken: Token, token: Token, negative: boolean) => {
                    const reserveAddress = syncGetDEXReserveAddress(networkID, reserveToken);
                    return List(await web3.eth.getPastLogs({
                        address: syncGetTokenAddress(networkID, token),
                        fromBlock: "1",
                        toBlock: "latest",
                        topics: negative ? [
                            sha3("Transfer(address,address,uint256)"),
                            Ox("000000000000000000000000" + strip0x(reserveAddress)),
                        ] : [
                                sha3("Transfer(address,address,uint256)"),
                                null as unknown as string,
                                Ox("000000000000000000000000" + strip0x(reserveAddress)),
                            ],
                    })).map(logToEvent(reserveToken, token, negative));
                };

                for (const token of [Token.BTC, Token.ZEC, Token.BCH]) {
                    {
                        const transferIns = (await getLogs(token, Token.DAI, false));
                        const transferOuts = (await getLogs(token, Token.DAI, true));
                        logs = logs.concat(transferOuts).concat(transferIns);
                    }
                    {
                        const transferIns = (await getLogs(token, token, false));
                        const transferOuts = (await getLogs(token, token, true));
                        logs = logs.concat(transferOuts).concat(transferIns);
                    }
                }

                logs = logs.sort((left, right) => (left.blockNumber <= right.blockNumber) ? -1 : 1);

                const lowestBlock = logs.first({ blockNumber: 0 }).blockNumber;
                const highestBlock = logs.last({ blockNumber: 0 }).blockNumber;
                const step = Math.floor((highestBlock - lowestBlock) / 20);

                const lowestBlockDetails = await web3.eth.getBlock(lowestBlock);
                const highestBlockDetails = await web3.eth.getBlock(highestBlock);
                const lowestTimestamp = parseInt(lowestBlockDetails.timestamp.toString(), 10);
                const highestTimestamp = parseInt(highestBlockDetails.timestamp.toString(), 10);

                const jump = (bn: number, s: number) => Math.floor(bn / s) * s;

                const rValues: ReserveHistoryItem[] = [];
                const item: ReserveHistoryItem = {
                    blocknumber: 0,
                    timestamp: lowestTimestamp,
                    BTC_btcBalance: 0,
                    BTC_daiBalance: 0,
                    ZEC_zecBalance: 0,
                    ZEC_daiBalance: 0,
                    BCH_bchBalance: 0,
                    BCH_daiBalance: 0,
                };
                for (let bn = jump(lowestBlock, step); bn <= jump(highestBlock, step); bn += step) {
                    let first = logs.first(null);

                    while (first && jump(first.blockNumber, step) <= bn) {
                        const label = `${first.reserve}_${first.token.toLowerCase()}Balance`;
                        item[label] = Math.round((item[label] + first.amount) * 100) / 100;
                        logs = logs.slice(1);
                        first = logs.first(null);
                    }
                    const timestamp = (lowestTimestamp + ((bn - lowestBlock) / (highestBlock - lowestBlock) * (highestTimestamp - lowestTimestamp)));
                    rValues.push({ ...item, blocknumber: bn, timestamp });
                }
                setReserveHistory(rValues);
            })().catch(_catchInteractionErr_);
        }, [web3, networkID, noPrices, refresh]);

        React.useEffect(() => {
            (async () => {
                let recentRegistrationEvents = List(await web3.eth.getPastLogs({
                    address: syncGetDEXAddress(networkID),
                    fromBlock: "1",
                    toBlock: "latest",
                    topics: [sha3("LogTrade(address,address,uint256,uint256)")],
                }))
                    .map(((log): Trade => {
                        const decoded = web3.eth.abi.decodeLog(syncGetDEXTradeLog(), log.data, (log.topics as string[]).slice(1));
                        const src = syncGetTokenFromAddress(networkID, decoded._src);
                        const dst = syncGetTokenFromAddress(networkID, decoded._dst);
                        const srcDecimals = getTokenDecimals(src);
                        const dstDecimals = getTokenDecimals(dst);
                        return {
                            id: log.transactionHash + log.logIndex,
                            src,
                            dst,
                            sendAmount: new BigNumber(decoded._sendAmount.toString()).div(new BigNumber(10).pow(srcDecimals)),
                            recvAmount: new BigNumber(decoded._recvAmount.toString()).div(new BigNumber(10).pow(dstDecimals)),
                            blockNumber: log.blockNumber,
                            transactionHash: log.transactionHash,
                            timestamp: 0,
                        };
                    }));
                setVolumes(
                    volumes.map((_, token) => recentRegistrationEvents.reduce((s, { dst, src, sendAmount, recvAmount }) => {
                        return dst === token ? s.plus(sendAmount) : src === token ? s.plus(recvAmount) : s;
                    }, new BigNumber(0)))
                );
                setTokenCount(
                    tokenCount.map((_, token) => recentRegistrationEvents.reduce((s, { dst, src }) => {
                        return dst === token ? s + 1 : src === token ? s + 1 : s;
                    }, 0))
                );
                let blockVolumes = OrderedMap<number, typeof defaultCumulativeValue>();

                const first = recentRegistrationEvents.first(null);
                let lowestBlock = first ? first.blockNumber : 0;
                const last = recentRegistrationEvents.last(null);
                let highestBlock = last ? last.blockNumber : 0;
                for (const trade of recentRegistrationEvents.toArray()) {
                    if (trade.blockNumber < lowestBlock) {
                        lowestBlock = trade.blockNumber;
                    }
                    if (trade.blockNumber > highestBlock) {
                        highestBlock = trade.blockNumber;
                    }
                }
                const lowestBlockDetails = await web3.eth.getBlock(lowestBlock);
                const highestBlockDetails = await web3.eth.getBlock(highestBlock);
                const lowestTimestamp = parseInt(lowestBlockDetails.timestamp.toString(), 10);
                const highestTimestamp = parseInt(highestBlockDetails.timestamp.toString(), 10);

                recentRegistrationEvents = recentRegistrationEvents
                    .map(trade => {
                        trade.timestamp = (lowestTimestamp + ((trade.blockNumber - lowestBlock) / (highestBlock - lowestBlock) * (highestTimestamp - lowestTimestamp)));
                        return trade;
                    });

                const step = highestBlock && lowestBlock ? Math.floor((highestBlock - lowestBlock) / 20) : 1000;

                for (const trade of recentRegistrationEvents.toArray()) {
                    for (const token of [Token.BTC, Token.ZEC, Token.BCH]) {
                        let values = blockVolumes.get(Math.floor(trade.blockNumber / step) * step) || defaultCumulativeValue;
                        values = values.set(token, values.get(token, 0) + (trade.dst === token ? trade.sendAmount.toNumber() : trade.src === token ? trade.recvAmount.toNumber() : 0));
                        blockVolumes = blockVolumes.set(Math.floor(trade.blockNumber / step) * step, values);
                    }
                }

                // let newCumulativeVolumes = OrderedMap<number, typeof defaultCumulativeValue>();

                const newCumulativeVolumes = [];

                let sum = defaultCumulativeValue;

                for (let bn = Math.floor(lowestBlock / step) * step; bn <= Math.floor(highestBlock / step) * step; bn += step) {
                    const now = blockVolumes.get(bn) || defaultCumulativeValue;
                    sum = sum.set(Token.BTC, sum.get(Token.BTC, 0) + now.get(Token.BTC, 0));
                    sum = sum.set(Token.ZEC, sum.get(Token.ZEC, 0) + now.get(Token.ZEC, 0));
                    sum = sum.set(Token.BCH, sum.get(Token.BCH, 0) + now.get(Token.BCH, 0));
                    newCumulativeVolumes.push({
                        blocknumber: bn,
                        timestamp: (lowestTimestamp + ((bn - lowestBlock) / (highestBlock - lowestBlock) * (highestTimestamp - lowestTimestamp))),
                        [Token.BTC]: Math.round(sum.get(Token.BTC, 0) * 100) / 100,
                        [Token.ZEC]: Math.round(sum.get(Token.ZEC, 0) * 100) / 100,
                        [Token.BCH]: Math.round(sum.get(Token.BCH, 0) * 100) / 100,
                    });
                }

                setCumulativeVolume(newCumulativeVolumes);
                // const first = recentRegistrationEvents.first(null);
                // const last = recentRegistrationEvents.last(null);
                // if (first && last) {
                //     let newCumulative = cumulativeVolume;
                //     for (let blockNumber = first.blockNumber; blockNumber <= last.blockNumber; blockNumber++) {
                //         newCumulative = newCumulative.map((token,  => )
                //     }
                //     setCumulativeVolume(newCumulative);
                // }
                setTrades(recentRegistrationEvents.reverse());
                setLoadedAt(new Date());
            })().catch(_catchInteractionErr_);
        }, [web3, networkID, refresh]);

        return <StatsView
            trades={trades}
            cumulativeVolume={cumulativeVolume}
            tokenCount={tokenCount}
            volumes={volumes}
            reserveBalances={reserveBalances}
            tokenPrices={tokenPrices}
            preferredCurrency={preferredCurrency}
            network={network}
            reserveHistory={reserveHistory}
            loadedAt={loadedAt}
        />;
    }
);
