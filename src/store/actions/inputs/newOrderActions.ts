import BigNumber from "bignumber.js";

import { _captureInteractionException_ } from "../../../lib/errors";

export const normalizeDecimals = (inputIn: string | null): string | null => {
    return inputIn === null ? inputIn : new BigNumber(inputIn).decimalPlaces(8).toFixed();
};

/*

const calculateNewState = (
    previousState: OrderInputsData,
    options: { blur: boolean }
): OrderInputsData => {
    return previousState;
};

// tslint:disable-next-line: no-any
export const setAndUpdateValues = (valuesIn: OrderInputsData, name: "inputError" | "sendToken" | "receiveToken" | "sendVolume" | "price" | "allOrNothing" | "immediateOrCancel", valueIn: any, options: { blur: boolean }) => (dispatch: Dispatch): OrderInputsData => {

    // If the value is in scientific notation, fix it
    let value = valueIn;
    if ((name === "sendVolume" || name === "price") && value !== null) {
        if (value.toLowerCase().indexOf("e") !== -1) {
            value = new BigNumber(value).toFixed();
        }
    }

    let values = valuesIn
        .set("inputError", null)
        .set(name, value);

    try {
        values = calculateNewState(values, options);
    } catch (err) {
        _captureInteractionException_(err, {
            description: "Error in newOrderActions.setAndUpdateValues",
            shownToUser: "No",
        });
    }

    dispatch(setSendToken(values.sendToken));
    dispatch(setReceiveToken(values.receiveToken));
    dispatch(setSendVolume(values.sendVolume));
    dispatch(setReceiveVolume(values.receiveVolume));
    dispatch(setPrice(values.price));
    dispatch(setAllOrNothing(values.allOrNothing));
    dispatch(setImmediateOrCancel(values.immediateOrCancel));
    dispatch(setError(values.inputError));

    return values;
};

export const swapTokens = (valuesIn: OrderInputsData) => (dispatch: Dispatch) => {
    let values = valuesIn
        .set("sendToken", valuesIn.receiveToken)
        .set("receiveToken", valuesIn.sendToken);

    values = setAndUpdateValues(values, "sendVolume", values.receiveVolume, { blur: true })(dispatch);

    history.replace(`/?send=${values.sendToken}&receive=${values.receiveToken}`);
};

*/
