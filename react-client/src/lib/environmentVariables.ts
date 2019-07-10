export const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;

export const ETHERSCAN = process.env.REACT_APP_ETHERSCAN;

export const SOURCE_VERSION = process.env.REACT_APP_SOURCE_VERSION;

export const ETHEREUM_NODE = process.env.REACT_APP_ETHEREUM_NODE || `http://localhost:8545`;

export const ENVIRONMENT = ((process.env.NODE_ENV === "development") ? "development" : process.env.REACT_APP_NETWORK) || "unknown";
export const ETHEREUM_NETWORK = process.env.REACT_APP_ETHEREUM_NETWORK;
export const ETHEREUM_NETWORK_ID = process.env.REACT_APP_ETHEREUM_NETWORK_ID;
