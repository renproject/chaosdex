import * as React from "react";

import { List } from "immutable";
import { Container } from "unstated";

const initialState = {
    popup: List<() => React.ReactNode>(),
};

export class PopupContainer extends Container<typeof initialState> {
    public state = initialState;

    constructor() {
        super();
    }

    public pushPopup = async (popup: () => React.ReactNode): Promise<void> => {
        await this.setState({ popup: this.state.popup.push(popup) });
    }

    public popPopup = async (): Promise<void> => {
        await this.setState({ popup: this.state.popup.pop() });
    }
}
