# `💱 ChaosDEX`

Trade BTC, ZEC, BCH ⟷ DAI trustlessly.

Powered by RenVM and the [RenVM.js SDK](https://github.com/renproject/renvm-sdk-js). To get started using the SDK, read the [Developer Docs](https://docs.renproject.io/developers/) or the [Getting Started Tutorial](https://docs.renproject.io/developers/tutorial/getting-started).

![Preview](./preview.png)

## Run locally

This will run against `testnet`.

```sh
cd ethereum-contracts
yarn install
yarn run bindings:ts
cd ../
```

```sh
cd react-client
yarn install
NETWORK="testnet" yarn start
```

> If it throws `Can't resolve './build/Release/scrypt'`, run:
> ```sh
> rm -r node_modules/scrypt
> ```

## Deploying

After running the above commands, `cd` into `react-client`.

Copy into `.env`, and fill in the Ethereum Node (first line) and optionally the Sentry DSN:

```sh
REACT_APP_ETHEREUM_NODE=""
REACT_APP_ETHERSCAN="https://kovan.etherscan.io"

REACT_APP_NETWORK="testnet"
REACT_APP_SENTRY_DSN=""
REACT_APP_ETHEREUM_NETWORK="Kovan"
REACT_APP_ETHEREUM_NETWORK_ID=42
```

Deploy to Github Pages:

```
yarn deploy
```
