import storage from "redux-persist/lib/storage";

import { createTransform, PersistConfig } from "redux-persist";

import { _captureBackgroundException_ } from "../lib/errors";
import { ApplicationData, TraderData } from "./types/general";

// Local Storage:

const traderTransform = createTransform<TraderData, string>(
    (inboundState: TraderData, key: string): string => {
        try {
            return inboundState.serialize();
        } catch (error) {
            // tslint:disable-next-line: no-console
            console.error(`Error serializing ${key} (${JSON.stringify(inboundState)}): ${error}`);
            _captureBackgroundException_(error, { description: "Error serializing local storage" });
            throw error;
        }
    },
    (outboundState: string, key: string): TraderData => {
        try {
            return new TraderData().deserialize(outboundState);
        } catch (error) {
            // tslint:disable-next-line: no-console
            console.error(`Error deserializing ${key} (${JSON.stringify(outboundState)}): ${error}`);
            _captureBackgroundException_(error, { description: "Error deserializing local storage" });
            throw error;
        }
    },
    { whitelist: ["trader"] as Array<keyof ApplicationData>, },
);

export const persistConfig: PersistConfig = {
    storage,
    key: "root",
    whitelist: ["trader"] as Array<keyof ApplicationData>,
    transforms: [traderTransform],
};
