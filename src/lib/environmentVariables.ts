export const KYBER_KEY = process.env.REACT_APP_KYBER_KEY;
export const WYRE_KEY = process.env.REACT_APP_WYRE_KEY;
export const INFURA_KEY = process.env.REACT_APP_INFURA_KEY;
export const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;

export const NETWORK = process.env.REACT_APP_NETWORK;
export const INGRESS = process.env.REACT_APP_INGRESS;
export const INFURA = process.env.REACT_APP_INFURA || "";
export const ETHERSCAN = process.env.REACT_APP_ETHERSCAN;
export const ETH_NETWORK = process.env.REACT_APP_ETH_NETWORK;
export const ETH_NETWORK_LABEL = process.env.REACT_APP_ETH_NETWORK_LABEL;
export const ETH_NETWORK_ID = parseInt(process.env.REACT_APP_ETH_NETWORK_ID || "1", 10);

export const LATEST_SWAPPERD_VERSION = process.env.REACT_APP_LATEST_SWAPPERD_VERSION;
export const SOURCE_VERSION = process.env.REACT_APP_SOURCE_VERSION;

const MAINNET_INFURA = "https://mainnet.infura.io/v3/";

const infix = INFURA[INFURA.length - 1] === "/" ? "" : "/";
const mainnetInfix = MAINNET_INFURA[MAINNET_INFURA.length - 1] === "/" ? "" : "/";
export const INFURA_URL = `${INFURA}${infix}${INFURA_KEY}`;
export const MAINNET_INFURA_URL = `${MAINNET_INFURA}${mainnetInfix}${INFURA_KEY}`;

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

export const environment = ((process.env.NODE_ENV === "development") ? "local" : NETWORK) || "unknown";
