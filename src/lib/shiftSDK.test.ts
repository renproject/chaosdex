
import { MarketPair, Token } from "../store/types/general";
import { sdk } from "./shiftSDK";

test.only("getReserveBalance", async () => {
    const btcBalance = (await sdk.getReserveBalance([MarketPair.DAI_BTC]))[0].get(Token.BTC)!;
    expect(btcBalance.toNumber()).toBeGreaterThan(0);
});
