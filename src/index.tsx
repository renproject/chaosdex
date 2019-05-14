import * as React from "react";
import * as ReactDOM from "react-dom";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-xhr-backend";

import { initReactI18next } from "react-i18next";
import { Provider } from "unstated";

import { App } from "./components/App";
import { _catch_ } from "./components/views/ErrorBoundary";
import { _captureInteractionException_ } from "./lib/errors";
import { onLoad } from "./lib/onLoad";

import "./styles/index.scss";

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
  })
  .catch(_captureInteractionException_);

onLoad("DEX Demo");

ReactDOM.render(
  _catch_(<Provider>
    <App />
  </Provider>),
  document.getElementById("root") as HTMLElement
);
