import { createStandardAction } from "typesafe-actions";

export const addPendingAlert = createStandardAction("ADD_PENDING_ALERT")<{
    id: string;
    method(): Promise<void>;
}>();

export const removePendingAlerts = createStandardAction("REMOVE_PENDING_ALERTS")<{ ids: string[] }>();
