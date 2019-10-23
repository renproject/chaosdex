// Import css first so that styles are consistent across dev and build
import "./styles/index.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { Router } from "react-router-dom";
import { Provider } from "unstated";

import { App } from "./components/controllers/App";
import { history } from "./lib/history";
import { initializeSentry } from "./sentry";
import { PersistentContainer } from "./state/persistentContainer";
import { SDKContainer } from "./state/sdkContainer";
import { UIContainer } from "./state/uiContainer";

initializeSentry();

const persistentContainer = new PersistentContainer();
const sdkContainer = new SDKContainer(persistentContainer);
const uiContainer = new UIContainer(persistentContainer);

ReactDOM.render(
    <Provider inject={[persistentContainer, sdkContainer, uiContainer]}>
        <Router history={history}>
            <App />
        </Router>
    </Provider>,
    document.getElementById("root") as HTMLElement
);
