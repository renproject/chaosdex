import * as React from "react";

import { InfoLabel, Loading, TokenIcon } from "@renproject/react-components";
import { UTXO } from "@renproject/ren";
import { OrderedMap } from "immutable";
import QRCode from "qrcode.react";
import CopyToClipboard from "react-copy-to-clipboard";

import { IS_TESTNET } from "../../../lib/environmentVariables";
import { Token } from "../../../state/generalTypes";
import { ShiftInEvent } from "../../../state/persistentContainer";
import { ReactComponent as Copy } from "../../../styles/images/copy.svg";
import { ReactComponent as QR } from "../../../styles/images/qr.svg";
import { txUrl } from "../OrderHistory";
import { Popup } from "../Popup";
import { BTC_FAUCET_LINK, INTEROP_LINK, TAZ_FAUCET_LINK } from "../tutorial-popup/TutorialPages";

interface Props {
    token: Token;
    amount: string;
    orderID: string;
    order: ShiftInEvent;
    cancel(): void;
    generateAddress(orderID: string): string | undefined;
    waitForDeposit(orderID: string, onDeposit: (utxo: UTXO) => void): Promise<void>;
}

export const ShowDepositAddress: React.StatelessComponent<Props> =
    ({ amount, token, orderID, order, cancel, generateAddress, waitForDeposit }) => {
        // Defaults for demo

        // tslint:disable-next-line: prefer-const
        let [understood, setUnderstood] = React.useState(false);
        const [copied, setCopied] = React.useState(false);
        const [showQR, setShowQR] = React.useState(false);
        const [depositAddress, setDepositAddress] = React.useState<string | undefined>(undefined);
        const [utxos, setUTXOs] = React.useState(OrderedMap<string, UTXO>());

        const [showSpinner, setShowSpinner] = React.useState(false);

        const [timer, setTimer] = React.useState<NodeJS.Timeout | null>(null);
        const [failed, setFailed] = React.useState(null as Error | null);

        // useEffect replaces `componentDidMount` and `componentDidUpdate`.
        // To limit it to running once, we use the initialized hook.
        const [initialized, setInitialized] = React.useState(false);
        React.useEffect(() => {
            if (!initialized) {
                try {
                    setDepositAddress(generateAddress(orderID));
                } catch (error) {
                    setFailed(error);
                }
                setInitialized(true);
            }
        }, [initialized, generateAddress, orderID]);

        const onDeposit = (deposit: UTXO) => {
            setUTXOs(utxos.set(deposit.utxo.txid, deposit));
        };

        const showDepositAddress = () => {
            setTimer(setTimeout(() => {
                setShowSpinner(true);
            }, 5000)
            );
            setUnderstood(true);
            understood = true;
            waitForDeposit(orderID, onDeposit)
                .catch(() => {
                    setUnderstood(false);
                    understood = false;
                });
        };

        const onClickAddress = () => {
            setCopied(true);
            if (timer) {
                clearTimeout(timer);
            }
            setTimer(setTimeout(() => {
                setCopied(false);
                if (!showSpinner) {
                    setShowSpinner(true);
                }
            }, 5000)
            );
        };

        const toggleQR = () => {
            setShowQR(!showQR);
        };

        const showAddress = <>
            <div className="address-input--message">
                <p className="blue">Only send the exact amount of {token.toUpperCase()} in a single transaction or funds will be lost. Future versions will allow sending arbitrary amounts.</p>
            </div>
            {understood ?
                <>
                    <div className="address-input--label">
                        Send {token.toUpperCase()} to:
                            </div>
                    <CopyToClipboard
                        text={depositAddress || ""}
                        onCopy={onClickAddress}
                    >
                        <div role="button" className={`address-input--copy ${copied ? "address-input--copied" : ""}`}>
                            <input
                                type="text"
                                name="address"
                                disabled={true}
                                value={depositAddress || ""}
                                autoFocus={true}
                                required={true}
                                aria-required={true}
                            />
                            <label className="copied-text">Copied</label>
                            <QR className="qr" onClick={toggleQR} />
                            <Copy />
                        </div>
                    </CopyToClipboard>
                    {showQR ? <QRCode value={`bitcoin:${depositAddress}?amount=${amount}`} /> : null}
                    {showSpinner ? <div className="spinner">
                        <Loading />{" "}<span>Scanning for {token.toUpperCase()} deposits</span>
                    </div> : null}
                </> :
                <>
                    {failed ? <div className="red">{`${failed.message || failed}`}</div> : ""}
                    <div className="popup--buttons">
                        <button className="button open--confirm" disabled={depositAddress === null || failed !== null} onClick={showDepositAddress}>{failed ? "Unable to generate address" : "Show deposit address"}</button>
                    </div>
                </>
            }
        </>;

        const showUTXOs = (
            utxos.size > 0 ? <div className="show-utxos">
                <Loading className="loading--blue" />
                <p>Waiting for confirmations. This can take up to twenty minutes due to confirmation times on various blockchains. This will be improved for Mainnet via 3rd parties. For more information, head <a className="blue" href={INTEROP_LINK} target="_blank" rel="noopener noreferrer">here</a>.</p>
                {utxos.map(utxo => {
                    return <div key={utxo.utxo.txid} className="show-utxos--utxo">
                        <a href={txUrl({ chain: utxo.chain, hash: utxo.utxo.txid })}>TXID {utxo.utxo.txid.slice(0, 12)}...{utxo.utxo.txid.slice(-5, -1)}</a>
                        <span>{utxo.utxo.confirmations} / {order ? (order.orderInputs.srcToken === Token.BTC || order.orderInputs.srcToken === Token.BCH ? 2 : 6) : "?"} confirmations</span>
                    </div>;
                }).valueSeq()}
                <details>
                    <summary>Show deposit address</summary>
                    {showAddress}
                </details>
            </div> : null
        );

        return <Popup cancel={cancel}>
            <div className="deposit-address">
                <div className="popup--body">
                    <TokenIcon className="token-icon" token={token} />
                    <h2>Deposit {amount} {token.toUpperCase()}{
                        token === Token.BTC && IS_TESTNET ? <InfoLabel><span className="infolabel--p"><span className="hint">Hint</span>: If you don't have a Testnet BTC wallet, send Testnet BTC from the <a className="blue" href={BTC_FAUCET_LINK} target="_blank" rel="noopener noreferrer">faucet</a>.</span></InfoLabel> :
                            token === Token.ZEC && IS_TESTNET ? <InfoLabel><span className="infolabel--p"><span className="hint">Hint</span>: If you don't have a Testnet ZEC wallet, send Testnet ZEC from the <a className="blue" href={TAZ_FAUCET_LINK} target="_blank" rel="noopener noreferrer">faucet</a>.</span></InfoLabel> :
                                <></>
                    }</h2>
                    {utxos.size > 0 ? showUTXOs : showAddress}
                </div>
            </div>
        </Popup>;
    };
