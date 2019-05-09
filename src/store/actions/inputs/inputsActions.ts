import { createStandardAction } from "typesafe-actions";

import { InputError, Token } from "../../types/general";

/**
 * Updates the current market (token pair, e.g. ETH/REN)
 */

export const setSendToken = createStandardAction("SET_SEND_TOKEN")<Token>();
export const setReceiveToken = createStandardAction("SET_RECEIVE_TOKEN")<Token>();
export const setSendVolume = createStandardAction("SET_SEND_VOLUME")<string | null>();
export const setReceiveVolume = createStandardAction("SET_RECEIVE_VOLUME")<string>();
export const setPrice = createStandardAction("SET_PRICE")<string>();
export const setAllOrNothing = createStandardAction("SET_ALL_OR_NOTHING")<boolean>();
export const setImmediateOrCancel = createStandardAction("SET_IMMEDIATE_OR_CANCEL")<boolean>();
export const setError = createStandardAction("SET_ERROR")<InputError>();
