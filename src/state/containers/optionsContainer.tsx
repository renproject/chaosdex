import { Container } from "unstated";

import { Currency } from "@renex/react-components";

import { UITheme } from "../generalTypes";

const initialState = {
    preferredCurrency: Currency.USD,
    theme: UITheme.Light,
};

export class OptionsContainer extends Container<typeof initialState> {
    public state = initialState;

    // constructor() {
    //     super();
    //     // TODO: fetch preferred currency
    // }

    public setCurrency = async (preferredCurrency: Currency) => {
        await this.setState({ preferredCurrency });
    }
}
