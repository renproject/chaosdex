// Import css first so that styles are consistent across dev and build
import "./styles/index.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { Router } from "react-router-dom";
import { Provider } from "unstated";

import { App } from "./components/controllers/App";
import { IS_TESTNET } from "./lib/environmentVariables";
import { history } from "./lib/history";
import { initializeSentry } from "./sentry";
import { PersistentContainer } from "./state/persistentContainer";
import { PopupContainer } from "./state/popupContainer";
import { SDKContainer } from "./state/sdkContainer";
import { UIContainer } from "./state/uiContainer";

initializeSentry();

const persistentContainer = new PersistentContainer();
const popupContainer = new PopupContainer();
const uiContainer = new UIContainer(persistentContainer, popupContainer);
const sdkContainer = new SDKContainer(persistentContainer);

ReactDOM.render(
    <Provider inject={[persistentContainer, sdkContainer, uiContainer, popupContainer]}>
        <Router history={history}>
            <App />
        </Router>
    </Provider>,
    document.getElementById("root") as HTMLElement
);

if (IS_TESTNET) {
    document.title = "TestDEX";
}
