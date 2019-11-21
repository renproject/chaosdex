import * as React from "react";

import { Currency, CurrencyIcon, Loading, TokenIcon } from "@renproject/react-components";
import { NetworkDetails } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { List, OrderedMap } from "immutable";
import {
    Area, AreaChart, Cell, Line, LineChart, Pie, PieChart, Tooltip, TooltipProps,
} from "recharts";

import { pageLoadedAt } from "../../lib/errors";
import { renderToken, Token, TokenPrices, Tokens } from "../../state/generalTypes";
import { CumulativeDataPoint, ReserveHistoryItem, Trade } from "../controllers/Stats";
import { TokenBalance } from "./TokenBalance";

interface Props {
    trades: List<Trade> | null;
    cumulativeVolume: CumulativeDataPoint[];
    tokenCount: OrderedMap<Token, number>;
    volumes: OrderedMap<Token, BigNumber>;
    reserveBalances: OrderedMap<Token, { quote: BigNumber, base: BigNumber }>;
    // When `any` is replaced with its type, the typescript compiler seems to
    // slow down significantly. This might resolve itself in future TS versions.
    // tslint:disable-next-line: no-any
    tokenPrices: any; // OrderedMap<Token, OrderedMap<any, number>>;
    preferredCurrency: Currency;
    network: NetworkDetails;
    reserveHistory: ReserveHistoryItem[] | null;
    loadedAt: Date;
}

const colors = {
    [Token.BTC]: "#F09242",
    [Token.ZEC]: "#f4b728",
    [Token.BCH]: "#6cc64b",
};

const PieTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload) {

        return <div className="custom-tooltip">
            <span className="label"><span style={{ color: payload[0].payload.fill }}>{payload[0].name}:</span> {payload[0].value} trades</span>
        </div>;
    }

    return null;
};

const Time = ({ unix }: { unix: number }) => {
    const dateObj = new Date(unix * 1000);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const year = dateObj.getFullYear();
    const month = months[dateObj.getMonth()];
    const date = dateObj.getDate();
    const hour = dateObj.getHours() % 12;
    const amPm = dateObj.getHours() < 12 ? "AM" : "PM";
    return <span>{date} {month} {year} {hour} {amPm}</span>;
};

const AreaTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload) {
        return <div className="custom-tooltip">
            <span>Block {payload[0].payload.blocknumber}</span>
            <Time unix={payload[0].payload.timestamp} />
            {
                payload.map(item => {
                    return <span key={item.name} style={{ color: item.color }} className="label">{item.name}: {item.value} DAI</span>;
                })}
        </div>;
    }

    return null;
};

const ReserveHistoryTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload) {
        const getName = (item: { name: string }) => item.name.slice(4, 7).toUpperCase();

        return <div className="custom-tooltip">
            <span>Block {payload[0].payload.blocknumber}</span>
            <Time unix={payload[0].payload.timestamp} />
            <span style={{ color: payload[0].color }} className="label">${payload[0].value} {getName(payload[0])} - ${payload[1].value} {getName(payload[1])}</span>
            <span style={{ color: payload[2].color }} className="label">${payload[2].value} {getName(payload[2])} - ${payload[3].value} {getName(payload[3])}</span>
            <span style={{ color: payload[4].color }} className="label">${payload[4].value} {getName(payload[4])} - ${payload[5].value} {getName(payload[5])}</span>
        </div>;
    }

    return null;
};

const ShowTrades = ({ trades, explorer }: { trades: List<Trade>, explorer: string }) =>
    <div className="stats--rows">
        {
            trades.map(trade => {
                return <div key={trade.id} className="stat">
                    Trade from <TokenIcon token={trade.src} /> {trade.sendAmount.decimalPlaces(trade.src === Token.DAI ? 2 : 6).toFixed()} {trade.src} to <TokenIcon token={trade.dst} /> {trade.recvAmount.decimalPlaces(trade.dst === Token.DAI ? 2 : 6).toFixed()} {trade.dst}
                    {" "}<a role="button" rel="noopener noreferrer" target="_blank" href={`${explorer}/tx/${trade.transactionHash}`} />
                </div>;
            }).toArray()}
    </div>;

const ShowReserveBalance = ({ token, preferredCurrency, balance, tokenPrices }: {
    token: Token,
    preferredCurrency: Currency,
    balance: BigNumber | null,
    tokenPrices: TokenPrices,
}) => {
    const tokenDetails = Tokens.get(token);
    return <span>
        <TokenIcon token={token} />
        {!balance ?
            "-" :
            <TokenBalance
                token={token}
                amount={balance || "0"}
                toReadable={true}
                decimals={tokenDetails ? tokenDetails.decimals : 0}
                digits={2}
            />
        }
        {" "}{renderToken(token)}
        {" ("}
        <CurrencyIcon currency={preferredCurrency} />
        {" "}
        {!balance ?
            "-" :
            <TokenBalance
                token={token}
                convertTo={preferredCurrency}
                tokenPrices={tokenPrices}
                amount={balance || "0"}
                toReadable={true}
                decimals={tokenDetails ? tokenDetails.decimals : 0}
            />
        }
        {")"}
    </span>;
};

const CumulativeChart = ({ cumulativeVolume }: { cumulativeVolume: CumulativeDataPoint[] }) =>
    <AreaChart
        width={300}
        height={300}
        data={cumulativeVolume}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
    >
        <Tooltip content={AreaTooltip} />
        <Area type="monotone" dataKey={Token.BTC} stroke={colors[Token.BTC]} fill={colors[Token.BTC]} yAxisId={0} />
        <Area type="monotone" dataKey={Token.ZEC} stroke={colors[Token.ZEC]} fill={colors[Token.ZEC]} yAxisId={0} />
        <Area type="monotone" dataKey={Token.BCH} stroke={colors[Token.BCH]} fill={colors[Token.BCH]} yAxisId={0} />
    </AreaChart>;

// @ts-ignore
export const StatsView = ({ trades, cumulativeVolume, tokenCount, volumes, reserveBalances, tokenPrices, preferredCurrency, network, reserveHistory, loadedAt }: Props) => {
    const data = React.useMemo(() => {
        return tokenCount.map((count, token) => ({ name: token, value: count })).valueSeq().toArray();
    }, [tokenCount]);

    const yesterday = (new Date().getTime()) / 1000 - (24 * 60 * 60);
    const twoDaysAgo = (new Date().getTime()) / 1000 - (2 * 24 * 60 * 60);

    return <div className="stats">
        <div className="stats--title">
            <h2>Stats</h2>
            <small>Updated {pageLoadedAt(loadedAt).toLowerCase()}</small>
        </div>
        <div className="stats--rows">
            {trades === null ? <Loading alt={true} /> : <>
                <div className="stats--rows">
                    <div className="stat--group">
                        <div className="stat graph-stat">
                            <span>Cumulative volume traded</span>
                            <CumulativeChart cumulativeVolume={cumulativeVolume} />
                        </div>
                    </div>
                    <div className="stat--group">
                        <div className="stat graph-stat">
                            <span>Number of trades ({trades.size} total)</span>
                            <PieChart width={300} height={300}>
                                <Pie dataKey="value" isAnimationActive={false} data={data} cx={150} cy={150} outerRadius={80} fill="#8884d8" label>
                                    {
                                        data.map((entry, index) => <Cell key={`cell-${index}`} stroke={"#282C35"} fill={colors[entry.name]} />)
                                    }
                                </Pie>
                                <Tooltip content={PieTooltip} />
                            </PieChart>
                        </div>
                    </div>
                    <div className="stat--group">
                        <div className="stat graph-stat">
                            <div className="graph-stat--loading">
                                <span>Reserve balance history</span>
                                {!reserveHistory ? <Loading alt={true} /> : <></>}
                            </div>
                            <LineChart
                                width={300}
                                height={300}
                                data={reserveHistory || []}
                                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                            >
                                <Tooltip content={ReserveHistoryTooltip} />
                                <Line type="monotone" dot={<></>} dataKey={`BTC_btcBalance`} stroke={colors[Token.BTC]} yAxisId={0} />
                                <Line type="monotone" dot={<></>} dataKey={`BTC_daiBalance`} stroke={colors[Token.BTC]} yAxisId={0} />
                                <Line type="monotone" dot={<></>} dataKey={`ZEC_zecBalance`} stroke={colors[Token.ZEC]} yAxisId={0} />
                                <Line type="monotone" dot={<></>} dataKey={`ZEC_daiBalance`} stroke={colors[Token.ZEC]} yAxisId={0} />
                                <Line type="monotone" dot={<></>} dataKey={`BCH_bchBalance`} stroke={colors[Token.BCH]} yAxisId={0} />
                                <Line type="monotone" dot={<></>} dataKey={`BCH_daiBalance`} stroke={colors[Token.BCH]} yAxisId={0} />
                            </LineChart>
                        </div>
                    </div>
                </div>
                <div className="stats--rows">
                    {
                        volumes.map((volume, token) => {
                            const quoteReserveBalances = reserveBalances.get(token, { quote: new BigNumber(0), base: new BigNumber(0) });
                            return <div key={token} className="stat--group">
                                <div className="stat--group--title">
                                    <TokenIcon token={token} /> {renderToken(token)}
                                </div>
                                <div className="stat--group--body">
                                    <div className="stat">
                                        {tokenCount.get(token)} trades
                                </div>
                                    <div className="stat">
                                        <CurrencyIcon currency={preferredCurrency} />{" "}
                                        <TokenBalance
                                            token={Token.DAI}
                                            convertTo={preferredCurrency}
                                            amount={volume}
                                            tokenPrices={tokenPrices}
                                        />
                                        {" "}
                                        <TokenIcon token={token} /> {renderToken(token)} traded in total
                                </div>
                                    <div className="stat graph-stat"><span>Available {renderToken(token)} liquidity</span>
                                        <ShowReserveBalance token={token} balance={quoteReserveBalances ? quoteReserveBalances.quote : new BigNumber(0)} preferredCurrency={preferredCurrency} tokenPrices={tokenPrices} />
                                        <ShowReserveBalance token={Token.DAI} balance={quoteReserveBalances ? quoteReserveBalances.base : new BigNumber(0)} preferredCurrency={preferredCurrency} tokenPrices={tokenPrices} />
                                    </div>
                                </div>
                            </div>;
                        }).valueSeq().toArray()}
                </div>
            </>}
        </div>
        <br /><br />
        <h2>Trade History</h2>
        {trades === null ? <div className="stats--rows"><Loading alt={true} /></div> : <>
            <p>Today</p>
            <ShowTrades
                trades={
                    trades.filter(trade => trade.timestamp >= yesterday)
                }
                explorer={network.contracts.etherscan}
            />
            <p>Yesterday</p>
            <ShowTrades
                trades={
                    trades.filter(trade => trade.timestamp < yesterday && trade.timestamp >= twoDaysAgo)}
                explorer={network.contracts.etherscan}
            />
            <p>>48 hours ago</p>
            <ShowTrades
                trades={
                    trades.filter(trade => trade.timestamp < twoDaysAgo)}
                explorer={network.contracts.etherscan}
            />
        </>}
    </div>;
};
