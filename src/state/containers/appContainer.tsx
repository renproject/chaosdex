import { Currency } from "@renex/react-components";
import { Map } from "immutable";
import { Container } from "unstated";

import { getTokenPricesInCurrencies } from "../../lib/market";
import { Token } from "../../store/types/general";
import { ApplicationData } from "../storeTypes";

const initialState: ApplicationData = {
    tokenPrices: Map<Token, Map<Currency, number>>(),
    popup: {
        dismissible: true,
        onCancel: () => null,
        popup: null,
        overlay: false,
    }
};

export class AppContainer extends Container<ApplicationData> {
    public state = initialState;

    public updateTokenPrices = async (): Promise<void> => {
        const tokenPrices = await getTokenPricesInCurrencies();
        await this.setState({ tokenPrices });
    }
}
