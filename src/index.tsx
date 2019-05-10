import * as React from "react";
import * as ReactDOM from "react-dom";

import { Provider } from "react-redux";
import { persistStore } from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";

import { Loading } from "@renex/react-components";
import { App } from "./components/App";
import { _catch_ } from "./components/views/ErrorBoundary";
import { onLoad } from "./lib/onLoad";
import { configureStore } from "./store/configureStore";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-xhr-backend";
import { initReactI18next } from "react-i18next";

import "./styles/index.scss";

export const store = configureStore();

// Initiate the i18n instance for multilingual support
i18n.use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: "en",
    debug: true,

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

onLoad("ApolloEx");

ReactDOM.render(
  _catch_(<Provider store={store}>
    <PersistGate loading={null} persistor={persistStore(store)}>
      <App />
    </PersistGate>
  </Provider>),
  document.getElementById("root") as HTMLElement
);
