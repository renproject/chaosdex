// Import css first so that styles are consistent across dev and build
import "./styles/index.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { Router } from "react-router";
import { Provider } from "unstated";

import { App } from "./components/controllers/App";
import { history } from "./lib/history";
import { initializeSentry } from "./sentry";

initializeSentry();

ReactDOM.render(
    <Provider>
        <Router history={history}>
            <App />
        </Router>
    </Provider>,
    document.getElementById("root") as HTMLElement
);
