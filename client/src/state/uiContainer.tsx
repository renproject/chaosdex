import { Container } from "unstated";

const initialState = {
};

export class UIContainer extends Container<typeof initialState> {
    public state = initialState;
}
