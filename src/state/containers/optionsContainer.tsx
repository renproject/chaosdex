import { Container } from "unstated";

import { Currency } from "@renex/react-components";

import { UITheme } from "../../store/types/general";
import { OptionsData } from "../storeTypes";

const initialState: OptionsData = {
    language: "en",
    preferredCurrency: Currency.USD,
    theme: UITheme.Light,
};

export class OptionsContainer extends Container<OptionsData> {
    public state = initialState;

    constructor() {
        super();
        // TODO: fetch previous language
        // TODO: fetch preferred currency
    }

    public setLanguage = async (language: string) => {
        await this.setState({ language });
    }

    public setCurrency = async (preferredCurrency: Currency) => {
        await this.setState({ preferredCurrency });
    }
}
