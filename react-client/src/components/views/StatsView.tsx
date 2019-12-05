import * as React from "react";

import { Currency, CurrencyIcon, Loading, TokenIcon } from "@renproject/react-components";
import { NetworkDetails } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { List, OrderedMap } from "immutable";
import {
    Area, AreaChart, Cell, Line, LineChart, Pie, PieChart, Tooltip, TooltipProps,
} from "recharts";

import { pageLoadedAt } from "../../lib/errors";
import { Token, TokenPrices, Tokens } from "../../state/generalTypes";
import { CumulativeDataPoint, ReserveHistoryItem, Trade } from "../controllers/Stats";
import { TokenBalance } from "./TokenBalance";
import { toBitcoinValue } from "../../lib/conversion";
import { Table, Thead, Tbody, Tr, Th, Td } from 'react-super-responsive-table'
import 'react-super-responsive-table/dist/SuperResponsiveTableStyle.css'

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
    itemsPerPage: number;
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
        <Table>
            <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "30%" }} />
            </colgroup>
            <Thead>
                <Tr>
                    <Th>Type</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Transaction</Th>
                </Tr>
            </Thead>
            <Tbody>
                {
                    trades.map((trade, idx) => {
                        return (<Tr key={trade.id} className={`${idx % 2 ? "even" : "odd"}`}>
                            <Td>Trade</Td>
                            <Td><TokenIcon token={trade.src} /> {trade.sendAmount.decimalPlaces(trade.src === Token.DAI ? 2 : 6).toFixed()} {trade.src}</Td>
                            <Td><TokenIcon token={trade.dst} /> {trade.recvAmount.decimalPlaces(trade.dst === Token.DAI ? 2 : 6).toFixed()} {trade.dst}</Td>
                            <Td><a role="button" rel="noopener noreferrer" target="_blank" href={`${explorer}/tx/${trade.transactionHash}`}>View transaction &rarr;</a></Td>
                        </Tr>);
                    }).toArray()
                }
            </Tbody>
        </Table>
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
        {" "}{token}
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

const TokenDistribution: React.FC<{
    data: Array<{
        name: Token,
        value: number,
    }>
}> = props => {
    const totalTrades = props.data.map(d => d.value).reduce((p, c) => p + c);
    const tally = new Array<{
        token: Token,
        name: string,
        value: number
    }>();
    props.data.forEach((data) => {
        const token = data.name;
        const tokenDetails = Tokens.get(token);
        if (tokenDetails) {
            tally.push({
                name: tokenDetails.name,
                value: data.value / totalTrades * 100,
                token,
            });
        }
    });
    tally.sort((a, b) => b.value - a.value);
    return (
        <div className="trade--distribution">
            {tally.map((data) => {
                // const token = data.name;
                // const tokenDetails = Tokens.get(token);
                // if (!tokenDetails) {
                //     return null;
                // }
                return (
                    <div className="trade--distribution--entry" key={`token--distribution--${data.name}`}>
                        <div><TokenIcon token={data.token} /> {data.name}</div>
                        <div>{data.value.toFixed(2)}%</div>
                    </div>
                );
            })}
        </div>
    );
};

const StatBlock: React.SFC<{
    title?: string | number | React.ReactNode;
    subtitle?: string;
}> = (props) => {
    return (
        <div className="stat--group">
            <div className="stat graph-stat">
                <div className="stat--content">
                    {props.children}
                </div>
                <div className="stat--footer">
                    {props.title && <h2>{props.title}</h2>}
                    {props.subtitle && <h3>{props.subtitle}</h3>}
                </div>
            </div>
        </div>
    );
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
export const StatsView = ({ trades, cumulativeVolume, tokenCount, volumes, reserveBalances, tokenPrices, preferredCurrency, network, reserveHistory, loadedAt, itemsPerPage }: Props) => {
    const [page, setPage] = React.useState<number>(0);
    const data = React.useMemo(() => {
        return tokenCount.map((count, token) => ({ name: token, value: count })).valueSeq().toArray();
    }, [tokenCount]);

    const yesterday = (new Date().getTime()) / 1000 - (24 * 60 * 60);
    const twoDaysAgo = (new Date().getTime()) / 1000 - (2 * 24 * 60 * 60);

    const tokenDetails = Tokens.get(Token.DAI);
    let totalTradeVolumeInDai = new BigNumber(0);
    let totalLiquidityPoolInBtc = new BigNumber(0);
    volumes.forEach((volume, token) => {
        const quoteReserveBalances = reserveBalances.get(token, { quote: new BigNumber(0), base: new BigNumber(0) });
        const quoteReserveInBtc = toBitcoinValue(quoteReserveBalances.base, Token.DAI, tokenPrices);
        const baseReserveInBtc = toBitcoinValue(quoteReserveBalances.quote, token, tokenPrices);
        const reserveAmountInBtc = quoteReserveInBtc.plus(baseReserveInBtc);
        totalTradeVolumeInDai = totalTradeVolumeInDai.plus(volume);
        let daiAmount = (quoteReserveBalances ? quoteReserveBalances.base : new BigNumber(0));
        const decimals = tokenDetails ? new BigNumber(10).exponentiatedBy(new BigNumber(tokenDetails.decimals)) : new BigNumber(1);
        daiAmount = daiAmount.div(decimals);
        totalLiquidityPoolInBtc = totalLiquidityPoolInBtc.plus(reserveAmountInBtc);
    });
    const sliceFrom = page * itemsPerPage;
    const sliceUntil = ((page + 1) * itemsPerPage) - 1;
    const tradesList: List<Trade> = trades ? trades.slice(sliceFrom, sliceUntil) : List<Trade>();
    const todayTrades: List<Trade> = tradesList.filter(trade => trade.timestamp >= yesterday);
    const yesterdayTrades: List<Trade> = tradesList.filter(trade => trade.timestamp < yesterday && trade.timestamp >= twoDaysAgo);
    const oldTrades: List<Trade> = tradesList.filter(trade => trade.timestamp < twoDaysAgo);
    const maxPage = trades ? Math.floor(trades.size / itemsPerPage) : 0;

    const startIcon = require("../../styles/images/icons/icon-start.svg");
    const endIcon = require("../../styles/images/icons/icon-end.svg");
    const nextIcon = require("../../styles/images/icons/icon-next.svg");
    const prevIcon = require("../../styles/images/icons/icon-prev.svg");
    const pagination = (
        <div className="stats--pagination">
            <div className="page--number">
                Page {page + 1} of {maxPage + 1}
            </div>
            <div className="page--change">
                <button disabled={page === 0} onClick={() => { setPage(0) }}><img src={startIcon} /></button>
                <button disabled={page === 0} onClick={() => { setPage(Math.max(0, page - 1)) }}><img src={prevIcon} /></button>
                <button disabled={page === maxPage} onClick={() => { setPage(Math.min(maxPage, page + 1)) }}><img src={nextIcon} /></button>
                <button disabled={page === maxPage} onClick={() => { setPage(maxPage) }}><img src={endIcon} /></button>
            </div>
        </div>
    );

    return <div className="stats">
        <div className="stats--title">
            <h2>ChaosDex Stats</h2>
            <small>Updated {pageLoadedAt(loadedAt).toLowerCase()}</small>
        </div>
        <div className="stats--rows">
            {trades === null || reserveHistory === null ? <Loading alt={true} /> : <>
                <div className="stats--rows">
                    <StatBlock
                        title={
                            <>
                                <CurrencyIcon currency={preferredCurrency} />
                                <TokenBalance
                                    token={Token.DAI}
                                    convertTo={preferredCurrency}
                                    amount={totalTradeVolumeInDai}
                                    tokenPrices={tokenPrices}
                                    group={true}
                                />
                            </>
                        }
                        subtitle="Total Volume"
                    >
                        <CumulativeChart cumulativeVolume={cumulativeVolume} />
                    </StatBlock>
                    <StatBlock title={trades.size} subtitle="Total Trades">
                        <PieChart width={300} height={200}>
                            <Pie dataKey="value" isAnimationActive={false} data={data} fill="#8884d8" label>
                                {
                                    data.map((entry, index) => <Cell key={`cell-${index}`} stroke={"#282C35"} fill={colors[entry.name]} />)
                                }
                            </Pie>
                            <Tooltip content={PieTooltip} />
                        </PieChart>
                        <TokenDistribution data={data} />
                    </StatBlock>
                    <StatBlock
                        title={
                            <>
                                <CurrencyIcon currency={preferredCurrency} />
                                <TokenBalance
                                    token={Token.BTC}
                                    convertTo={preferredCurrency}
                                    amount={totalLiquidityPoolInBtc}
                                    tokenPrices={tokenPrices}
                                    group={true}
                                />
                            </>
                        }
                        subtitle="Liquidity Pool Value"
                    >
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
                    </StatBlock>
                </div>
                {/*
                <div className="stats--rows">
                    {
                        volumes.map((volume, token) => {
                            const quoteReserveBalances = reserveBalances.get(token, { quote: new BigNumber(0), base: new BigNumber(0) });
                            return <div key={token} className="stat--group">
                                <div className="stat--group--title">
                                    <TokenIcon token={token} /> {token}
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
                                        <TokenIcon token={token} /> {token} traded in total
                                </div>
                                    <div className="stat graph-stat"><span>Available {token} liquidity</span>
                                        <ShowReserveBalance token={token} balance={quoteReserveBalances ? quoteReserveBalances.quote : new BigNumber(0)} preferredCurrency={preferredCurrency} tokenPrices={tokenPrices} />
                                        <ShowReserveBalance token={Token.DAI} balance={quoteReserveBalances ? quoteReserveBalances.base : new BigNumber(0)} preferredCurrency={preferredCurrency} tokenPrices={tokenPrices} />
                                    </div>
                                </div>
                            </div>;
                        }).valueSeq().toArray()
                    }
                </div>
                */}
            </>}
        </div>
        <br /><br />
        <div className="trade--history">
            <h2>Trade History</h2>
            {trades === null ? <div className="stats--rows"><Loading alt={true} /></div> : <>
                {pagination}
                {todayTrades.size > 0 && <div className="trade--history--block">
                    <h3>Today</h3>
                    <ShowTrades
                        trades={todayTrades}
                        explorer={network.contracts.etherscan}
                    />
                </div>
                }
                {yesterdayTrades.size > 0 &&
                    <div className="trade--history--block">
                        <h3>Yesterday</h3>
                        <ShowTrades
                            trades={yesterdayTrades}
                            explorer={network.contracts.etherscan}
                        />
                    </div>
                }
                {oldTrades.size > 0 &&
                    <div className="trade--history--block">
                        <h3>&gt; 48 hours ago</h3>
                        <ShowTrades
                            trades={oldTrades}
                            explorer={network.contracts.etherscan}
                        />
                    </div>
                }
                {pagination}
            </>}
        </div>
    </div>;
};
