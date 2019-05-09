import { ActionType, getType } from "typesafe-actions";

import * as alertActions from "../../../store/actions/alert/alertActions";
import * as pendingAlertActions from "../../../store/actions/alert/pendingAlertActions";

import { Alert, AlertData } from "../../types/general";

type AlertAction = ActionType<typeof alertActions>;
type PendingAlertAction = ActionType<typeof pendingAlertActions>;

export const alertReducer = (state: AlertData = new AlertData(), action: AlertAction | PendingAlertAction) => {
    switch (action.type) {
        case getType(alertActions.setAlert):
            return state.set("alert", action.payload.alert);
        case getType(alertActions.clearAlert):
            return state.set("alert", new Alert({ message: "" }));
        case getType(pendingAlertActions.addPendingAlert):
            const { id, method } = action.payload;
            return state.set("pendingAlerts", state.pendingAlerts.set(id, method));
        case getType(pendingAlertActions.removePendingAlerts):
            const { ids } = action.payload;
            let pendingAlerts = state.pendingAlerts;
            for (const alertID of ids) {
                pendingAlerts = pendingAlerts.delete(alertID);
            }

            return state.set("pendingAlerts", pendingAlerts);

        default:
            return state;
    }
};
