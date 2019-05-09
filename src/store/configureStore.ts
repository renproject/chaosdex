import thunk from "redux-thunk";

import { Action, applyMiddleware, createStore, Middleware, Reducer } from "redux";
import { PersistConfig, persistReducer } from "redux-persist";

import { environment } from "../lib/environmentVariables";
import { rootReducer } from "../store/reducers/rootReducer";
import { persistConfig } from "./persistConfig";

const middlewares: Middleware[] = [
    thunk,
];

// Log Redux actions (only in development)
if (environment === "local") {
    // middlewares.push(createLogger({ collapsed: true }));
}

// Workaround createStore not liking type of persistReducer
const typedPersistReducer = <S, A extends Action>(config: PersistConfig, reducer: Reducer<S, A>) => {
    return persistReducer<S, A>(
        config,
        reducer
    );
};

const persistedReducer = typedPersistReducer(persistConfig, rootReducer);

export const configureStore = () => createStore(
    persistedReducer,
    applyMiddleware(...middlewares),
);
