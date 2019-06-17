export const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;

export const NETWORK = process.env.REACT_APP_NETWORK;
export const INGRESS = process.env.REACT_APP_INGRESS;
export const ETHERSCAN = process.env.REACT_APP_ETHERSCAN;
export const ETH_NETWORK = process.env.REACT_APP_ETH_NETWORK;
export const ETH_NETWORK_LABEL = process.env.REACT_APP_ETH_NETWORK_LABEL;
export const ETH_NETWORK_ID = parseInt(process.env.REACT_APP_ETH_NETWORK_ID || "1", 10);

export const SOURCE_VERSION = process.env.REACT_APP_SOURCE_VERSION;

export const ETHEREUM_NODE = `http://localhost:8545`;

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

export const environment = ((process.env.NODE_ENV === "development") ? "local" : NETWORK) || "unknown";

export const EXCHANGE = NETWORK === "kovan" ? "0x0dF3510a4128c0cA11518465f670dB970E9302B7" : "";
