import * as React from "react";

import { sha3 } from "web3-utils";
import BigNumber from "bignumber.js";
import { CurrencyIcon, Loading, TokenIcon } from "@renproject/react-components";
import { OrderedMap } from "immutable";

import {
    getTokenDecimals, syncGetDEXAddress, syncGetDEXTradeLog, syncGetTokenFromAddress,
} from "../../lib/contractAddresses";
import { _catchInteractionErr_, pageLoadedAt } from "../../lib/errors";
import { connect, ConnectedProps } from "../../state/connect";
import { Token } from "../../state/generalTypes";
import { UIContainer } from "../../state/uiContainer";
import { TokenBalance } from "../views/TokenBalance";

interface Props {
}

interface Trade {
    id: string;
    src: string;
    dst: string;
    sendAmount: BigNumber;
    recvAmount: BigNumber;
}

const defaultVolumes = OrderedMap<Token, BigNumber>()
    .set(Token.BTC, new BigNumber(0))
    .set(Token.ZEC, new BigNumber(0))
    .set(Token.BCH, new BigNumber(0))
    ;

export const Stats = connect<Props & ConnectedProps<[UIContainer]>>([UIContainer])(
    ({ containers: [uiContainer] }) => {

        const { web3, networkID, preferredCurrency, tokenPrices } = uiContainer.state;
        const [trades, setTrades] = React.useState<Trade[] | null>(null);
        const [volumes, setVolumes] = React.useState(defaultVolumes);

        React.useEffect(() => {
            if (!web3) {
                return;
            }
            (async () => {
                console.log("address", syncGetDEXAddress(networkID));
                const recentRegistrationEvents = (await web3.eth.getPastLogs({
                    address: syncGetDEXAddress(networkID),
                    fromBlock: "1",
                    toBlock: "latest",
                    topics: [sha3("LogTrade(address,address,uint256,uint256)")],
                }))
                    .map((log => {
                        console.log(`New log!`);
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
                        };
                    }));
                setVolumes(
                    volumes.map((_, token) => recentRegistrationEvents.reduce((sum, { dst, src, sendAmount, recvAmount }) => {
                        return dst === token ? sum.plus(recvAmount) : src === token ? sum.plus(sendAmount) : sum;
                    }, new BigNumber(0)))
                );
                setTrades(recentRegistrationEvents);
            })().catch(_catchInteractionErr_);
        }, [web3, networkID]);

        const loadedAt: string = React.useMemo(() => pageLoadedAt(), []);

        return <div className="stats">
            <h2>Stats</h2>
            <small>Loaded: {loadedAt}</small>
            <div className="stats--rows">
                {trades === null ? <Loading alt={true} /> : <>
                    <div className="stat">
                        {trades.length} trades settled
                    </div>
                    {volumes.map((volume, token) => {
                        return <div key={token} className="stat">
                            <CurrencyIcon currency={preferredCurrency} />{" "}
                            <TokenBalance
                                token={token}
                                convertTo={preferredCurrency}
                                amount={volume}
                                tokenPrices={tokenPrices}
                            /> <TokenIcon token={token} /> {token} traded in total
                        </div>;
                    }).valueSeq().toArray()}
                </>}
            </div>
            <h2>Trade History</h2>
            <div className="stats--rows">
                {trades === null ? <Loading alt={true} /> : trades.map((trade) => {
                    return <div key={trade.id} className="stat">
                        Trade from <TokenIcon token={trade.src} /> {trade.sendAmount.decimalPlaces(trade.src === Token.DAI ? 2 : 6).toFixed()} {trade.src} to <TokenIcon token={trade.dst} /> {trade.recvAmount.decimalPlaces(trade.dst === Token.DAI ? 2 : 6).toFixed()} {trade.dst}
                    </div>;
                })}
            </div>
        </div>;
    }
);
