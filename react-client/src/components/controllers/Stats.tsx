import * as React from "react";

import { Area, AreaChart, Cell, Pie, PieChart, Tooltip, TooltipProps } from "recharts";
import { sha3 } from "web3-utils";
import BigNumber from "bignumber.js";
import { CurrencyIcon, Loading, TokenIcon } from "@renproject/react-components";
import { List, OrderedMap } from "immutable";

import {
    getTokenDecimals, syncGetDEXAddress, syncGetDEXTradeLog, syncGetTokenFromAddress,
} from "../../lib/contractAddresses";
import { _catchInteractionErr_, pageLoadedAt } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { UIContainer } from "../../state/uiContainer";
import { StatsView } from "../views/StatsView";
import { TokenBalance } from "../views/TokenBalance";

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
    timestamp: number,
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

const colors = {
    [Token.BTC]: "#F09242",
    [Token.ZEC]: "#f4b728",
    [Token.BCH]: "#6cc64b",
};

const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload) {

        const dateObj = new Date(payload[0].payload.timestamp * 1000);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const year = dateObj.getFullYear();
        const month = months[dateObj.getMonth()];
        const date = dateObj.getDate();
        const hour = dateObj.getHours() % 12;
        const amPm = dateObj.getHours() < 12 ? "AM" : "PM";
        const time = date + " " + month + " " + year + " " + hour + amPm;

        return <div className="custom-tooltip">
            <span>Block {payload[0].payload.blocknumber}</span>
            <span>{time}</span>
            <span style={{ color: payload[0].color }} className="label">{`${payload[0].name}: ${payload[0].value}`} DAI</span>
            <span style={{ color: payload[1].color }} className="label">{`${payload[1].name}: ${payload[1].value}`} DAI</span>
            <span style={{ color: payload[2].color }} className="label">{`${payload[2].name}: ${payload[2].value}`} DAI</span>
        </div>;
    }

    return null;
};

export const Stats = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer] }) => {

        const { web3, networkID, network, preferredCurrency, tokenPrices, reserveBalances, preferredCurrency: quoteCurrency } = uiContainer.state;
        const [trades, setTrades] = React.useState<List<Trade> | null>(null);
        const [volumes, setVolumes] = React.useState(defaultVolumes);
        const [tokenCount, setTokenCount] = React.useState(defaultTokenCount);
        const [cumulativeVolume, setCumulativeVolume] = React.useState(defaultCumulativeVolume);

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
                    volumes.map((_, token) => recentRegistrationEvents.reduce((sum, { dst, src, sendAmount, recvAmount }) => {
                        return dst === token ? sum.plus(sendAmount) : src === token ? sum.plus(recvAmount) : sum;
                    }, new BigNumber(0)))
                );
                setTokenCount(
                    tokenCount.map((_, token) => recentRegistrationEvents.reduce((sum, { dst, src }) => {
                        return dst === token ? sum + 1 : src === token ? sum + 1 : sum;
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
            })().catch(_catchInteractionErr_);
        }, [web3, networkID]);

        return <StatsView
            trades={trades}
            cumulativeVolume={cumulativeVolume}
            tokenCount={tokenCount}
            volumes={volumes}
            reserveBalances={reserveBalances}
            tokenPrices={tokenPrices}
            preferredCurrency={preferredCurrency}
            network={network}
        />;
    }
);
