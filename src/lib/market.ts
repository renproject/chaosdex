import { Currency } from "@renex/react-components";
import { Map, OrderedMap } from "immutable";

import { MarketPair, Token, TokenPrices } from "../state/generalTypes";

const CoinGeckoIDs = Map<Token, string>()
    .set(Token.DAI, "dai")
    .set(Token.BTC, "bitcoin")
    .set(Token.ETH, "ethereum")
    .set(Token.REN, "republic-protocol")
    .set(Token.ZEC, "zcash");

/**
 * Retrieves the current pricepoint for two currencies.
 * @param fstCode The first currency.
 * @param sndCode The second currency.
 * @returns An array containing the price with respect to the currencies, and the 24 hour percent change.
 */
const fetchDetails = async (geckoID: string) => {
    const url = `https://api.coingecko.com/api/v3/coins/${geckoID}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
    const response = await fetch(url);
    return response.json();
};

export const getTokenPricesInCurrencies = async (): Promise<TokenPrices> => {
    let prices: TokenPrices = Map();

    for (const tokenAndDetails of CoinGeckoIDs.toSeq().toArray()) {
        const [token, coinGeckoID] = tokenAndDetails;

        // tslint:disable-next-line:max-line-length
        const data = await fetchDetails(coinGeckoID);
        const price = Map<Currency, number>(data.market_data.current_price);

        prices = prices.set(token, price);
    }

    return prices;
};

interface MarketDetails {
    symbol: MarketPair;
    quote: Token;
    base: Token;
}

const MarketPairs = OrderedMap<MarketPair, MarketDetails>()
    // BTC pairs
    .set(MarketPair.ETH_BTC, { symbol: MarketPair.ETH_BTC, quote: Token.BTC, base: Token.ETH })
    .set(MarketPair.REN_BTC, { symbol: MarketPair.REN_BTC, quote: Token.BTC, base: Token.REN })
    .set(MarketPair.DAI_BTC, { symbol: MarketPair.DAI_BTC, quote: Token.BTC, base: Token.DAI })
    .set(MarketPair.ZEC_BTC, { symbol: MarketPair.ZEC_BTC, quote: Token.BTC, base: Token.ZEC })
    ;

export const getMarket = (left: Token, right: Token): MarketPair | undefined => {
    return (
        MarketPairs.findKey((marketDetails: MarketDetails) => marketDetails.base === left && marketDetails.quote === right) ||
        MarketPairs.findKey((marketDetails: MarketDetails) => marketDetails.base === right && marketDetails.quote === left) ||
        undefined
    );
};
