export const INFURA_KEY = process.env.REACT_APP_INFURA_KEY;

export const NETWORK = process.env.REACT_APP_NETWORK;
export const INGRESS = process.env.REACT_APP_INGRESS;
export const INFURA = process.env.REACT_APP_INFURA || "";
export const ETHERSCAN = process.env.REACT_APP_ETHERSCAN;
export const ETH_NETWORK = process.env.REACT_APP_ETH_NETWORK;
export const ETH_NETWORK_LABEL = process.env.REACT_APP_ETH_NETWORK_LABEL;
export const ETH_NETWORK_ID = parseInt(process.env.REACT_APP_ETH_NETWORK_ID || "1", 10);

export const SOURCE_VERSION = process.env.REACT_APP_SOURCE_VERSION;

const MAINNET_INFURA = "https://mainnet.infura.io/v3/";

const infix = INFURA[INFURA.length - 1] === "/" ? "" : "/";
const mainnetInfix = MAINNET_INFURA[MAINNET_INFURA.length - 1] === "/" ? "" : "/";
export const INFURA_URL = `${INFURA}${infix}${INFURA_KEY}`;
export const MAINNET_INFURA_URL = `${MAINNET_INFURA}${mainnetInfix}${INFURA_KEY}`;

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

export const environment = ((process.env.NODE_ENV === "development") ? "local" : NETWORK) || "unknown";

export const EXCHANGE = NETWORK === "kovan" ? "0x0dF3510a4128c0cA11518465f670dB970E9302B7" : "";
