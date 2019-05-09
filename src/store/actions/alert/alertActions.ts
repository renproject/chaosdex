import { createStandardAction } from "typesafe-actions";

import { Alert } from "../../types/general";

/**
 * Adds a new alert to the alert stack.
 */
export const setAlert = createStandardAction("SET_ALERT")<{
    /**
     * The alert to be added to the alert stack.
     */
    alert: Alert;
}>();

/**
 * Remove the top alert from the alert stack.
 */
export const clearAlert = createStandardAction("CLEAR_ALERT")();
