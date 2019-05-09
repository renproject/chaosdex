import { ActionType, getType } from "typesafe-actions";

import * as inputsActions from "../../../store/actions/inputs/inputsActions";

import { OrderInputsData } from "../../types/general";

type InputsAction = ActionType<typeof inputsActions>;

export const inputsReducer = (state: OrderInputsData = new OrderInputsData(), action: InputsAction) => {
    switch (action.type) {
        case getType(inputsActions.setSendToken):
            return state.set("sendToken", action.payload);
        case getType(inputsActions.setReceiveToken):
            return state.set("receiveToken", action.payload);
        case getType(inputsActions.setSendVolume):
            return state.set("sendVolume", action.payload);
        case getType(inputsActions.setReceiveVolume):
            return state.set("receiveVolume", action.payload);
        case getType(inputsActions.setPrice):
            return state.set("price", action.payload);
        case getType(inputsActions.setAllOrNothing):
            return state.set("allOrNothing", action.payload);
        case getType(inputsActions.setImmediateOrCancel):
            return state.set("immediateOrCancel", action.payload);
        case getType(inputsActions.setError):
            return state.set("inputError", action.payload);
        default:
            return state;
    }
};
