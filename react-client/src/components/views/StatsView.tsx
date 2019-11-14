import * as React from "react";

import { Area, AreaChart, Cell, Pie, PieChart, Tooltip, TooltipProps } from "recharts";
import BigNumber from "bignumber.js";
import { Currency, CurrencyIcon, Loading, TokenIcon } from "@renproject/react-components";
import { List, OrderedMap } from "immutable";
import { NetworkDetails } from "@renproject/ren";

import { _catchInteractionErr_, pageLoadedAt } from "../../lib/errors";
import { Token, TokenPrices, Tokens } from "../../state/generalTypes";
import { CumulativeDataPoint, Trade } from "../controllers/Stats";
import { TokenBalance } from "../views/TokenBalance";

interface Props {
    trades: List<Trade> | null;
    cumulativeVolume: CumulativeDataPoint[];
    tokenCount: OrderedMap<Token, number>;
    volumes: OrderedMap<Token, BigNumber>;
    reserveBalances: OrderedMap<Token, { quote: BigNumber, base: BigNumber }>;
    tokenPrices: OrderedMap<Token, OrderedMap<Currency, number>>;
    preferredCurrency: Currency;
    network: NetworkDetails;
}

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

const ShowTrades = ({ trades, explorer }: { trades: List<Trade>, explorer: string }) =>
    <div className="stats--rows">
        {trades.map((trade) => {
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
    </span>
}

const CumulativeChart = ({ cumulativeVolume }: { cumulativeVolume: CumulativeDataPoint[] }) =>
    <AreaChart
        width={300}
        height={300}
        data={cumulativeVolume}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
    >
        <Tooltip content={CustomTooltip} />
        <Area type="monotone" dataKey={Token.BTC} stroke={colors[Token.BTC]} fill={colors[Token.BTC]} yAxisId={0} />
        <Area type="monotone" dataKey={Token.ZEC} stroke={colors[Token.ZEC]} fill={colors[Token.ZEC]} yAxisId={0} />
        <Area type="monotone" dataKey={Token.BCH} stroke={colors[Token.BCH]} fill={colors[Token.BCH]} yAxisId={0} />
    </AreaChart>;

export const StatsView = ({ trades, cumulativeVolume, tokenCount, volumes, reserveBalances, tokenPrices, preferredCurrency, network }: Props) => {
    const loadedAt = React.useMemo(() => new Date(), []);

    const data = React.useMemo(() => {
        return tokenCount.map((count, token) => ({ name: token, value: count })).valueSeq().toArray();
    }, [tokenCount]);

    const yesterday = (new Date().getTime()) / 1000 - (24 * 60 * 60);
    const twoDaysAgo = (new Date().getTime()) / 1000 - (2 * 24 * 60 * 60);

    return <div className="stats">
        <div className="stats--title">
            <h2>Stats</h2>
            <small>Loaded: {pageLoadedAt(loadedAt)}</small>
        </div>
        <div className="stats--rows">
            {trades === null ? <Loading alt={true} /> : <>
                <div className="stats--rows">
                    <div className="stat--group">
                        <div className="stat graph-stat">
                            <p>Cumulative volume traded</p>
                            <CumulativeChart cumulativeVolume={cumulativeVolume} />
                        </div>
                    </div>
                    <div className="stat--group">
                        <div className="stat graph-stat">
                            <p>Number of trades ({trades.size} total)</p>
                            <PieChart width={300} height={300}>
                                <Pie dataKey="value" isAnimationActive={false} data={data} cx={150} cy={150} outerRadius={80} fill="#8884d8" label>
                                    {
                                        data.map((entry, index) => <Cell key={`cell-${index}`} fill={colors[entry.name]} />)
                                    }
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </div>
                    </div>
                </div>
                <div className="stats--rows">
                    {volumes.map((volume, token) => {
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
                    }).valueSeq().toArray()}
                </div>
            </>}
        </div>
        <h2>Trade History</h2>
        {trades === null ? <div className="stats--rows"><Loading alt={true} /></div> : <>
            <p>Today</p>
            <ShowTrades trades={trades.filter(trade => trade.timestamp >= yesterday)} explorer={network.contracts.etherscan} />
            <p>Yesterday</p>
            <ShowTrades trades={trades.filter(trade => trade.timestamp < yesterday && trade.timestamp >= twoDaysAgo)} explorer={network.contracts.etherscan} />
            <p>>48 hours ago</p>
            <ShowTrades trades={trades.filter(trade => trade.timestamp < twoDaysAgo)} explorer={network.contracts.etherscan} />
        </>}
    </div>;
};
