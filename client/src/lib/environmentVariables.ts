export const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;

export const ETHERSCAN = process.env.REACT_APP_ETHERSCAN;

export const SOURCE_VERSION = process.env.REACT_APP_SOURCE_VERSION;

export const ETHEREUM_NODE = process.env.REACT_APP_ETHEREUM_NODE || `http://localhost:8545`;

export const NETWORK = process.env.REACT_APP_NETWORK;
export const environment = ((process.env.NODE_ENV === "development") ? "development" : NETWORK) || "unknown";
