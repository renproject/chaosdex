import { MarketPair, Token } from "../state/generalTypes";
import { sdk } from "./dexSDK";

test.only("getReserveBalance", async () => {
    const btcBalance = (await sdk.getReserveBalance([MarketPair.DAI_BTC]))[0].get(Token.BTC);
    expect(btcBalance).toBeDefined();
    if (btcBalance) {
        expect(btcBalance.toNumber()).toBeGreaterThan(0);
    }
});
