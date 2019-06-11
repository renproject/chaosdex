import * as React from "react";

import { Currency, CurrencyIcon, InfoLabel, TokenIcon } from "@renex/react-components";
import { useTranslation } from "react-i18next";

import { OrderInputs } from "../../../lib/dexSDK";
import { _catchInteractionErr_ } from "../../../lib/errors";
import { Token, TokenPrices } from "../../../state/generalTypes";
import { ReactComponent as Arrow } from "../../styles/images/arrow-right.svg";
import { TokenBalance } from "../TokenBalance";
import { Popup } from "./Popup";

export const ConfirmTradeDetails: React.StatelessComponent<{
    orderInputs: OrderInputs;
    quoteCurrency: Currency;
    tokenPrices: TokenPrices;
    done(): void;
    cancel(): void;
}> = ({ tokenPrices, orderInputs, quoteCurrency, done, cancel }) => {
    const { t } = useTranslation();

    return <Popup cancel={cancel}>
        <div className="swap swap--popup open">
            <div className="popup--header">
                <h2>{t("popup.confirm_trade")}</h2>
                <div role="button" className="popup--header--x" onClick={cancel} />
                <div className="swap-details--icons">
                    <div>
                        <TokenIcon white={true} className="swap-details--icon" token={orderInputs.srcToken} />
                        <span>
                            <TokenBalance
                                token={orderInputs.srcToken}
                                amount={orderInputs.srcAmount}
                            />
                            {" "}
                            {orderInputs.srcToken}
                        </span>
                        <span>
                            <CurrencyIcon currency={quoteCurrency} />
                            <TokenBalance
                                token={orderInputs.srcToken}
                                convertTo={quoteCurrency}
                                amount={orderInputs.srcAmount}
                                tokenPrices={tokenPrices}
                            />
                        </span>
                    </div>
                    <div className="swap-details--icons--arrow">
                        <Arrow />
                    </div>
                    <div>
                        <TokenIcon white={true} className="swap-details--icon" token={orderInputs.dstToken} />
                        <span>
                            <TokenBalance
                                token={orderInputs.dstToken}
                                amount={orderInputs.dstAmount}
                            />
                            {" "}
                            {orderInputs.dstToken}
                        </span>
                        <span>
                            <CurrencyIcon currency={quoteCurrency} />
                            <TokenBalance
                                token={orderInputs.dstToken}
                                convertTo={quoteCurrency}
                                amount={orderInputs.dstAmount}
                                tokenPrices={tokenPrices}
                            />
                        </span>
                    </div>
                </div>
            </div>
            <div className="popup--body">
                <div className="swap-details">
                    <div className="swap-details-heading">
                        <span>Details</span>
                        <span>{quoteCurrency.toUpperCase()}</span>
                    </div>
                    <hr />
                    <div className="swap-details--values">
                        <div>
                            <span className="swap-details--values--left">
                                <TokenBalance
                                    token={orderInputs.dstToken}
                                    amount={orderInputs.dstAmount}
                                />
                                {" "}
                                {orderInputs.dstToken}
                                {" @ "}
                                <CurrencyIcon currency={quoteCurrency} />
                                {/* tslint:disable-next-line: no-non-null-assertion no-unnecessary-type-assertion */}
                                {tokenPrices.get(orderInputs.dstToken) ? tokenPrices.get(orderInputs.dstToken)!.get(quoteCurrency) : null}
                                {quoteCurrency.toUpperCase()}
                            </span>
                            <div className="swap-details--values--right">
                                <CurrencyIcon currency={quoteCurrency} />
                                <TokenBalance
                                    token={orderInputs.dstToken}
                                    convertTo={quoteCurrency}
                                    amount={orderInputs.dstAmount}
                                    tokenPrices={tokenPrices}
                                />
                            </div>
                        </div>
                        <hr />
                        <div>
                            <span className="swap-details--values--left">
                                FEE <InfoLabel>Darknode and transfer fees</InfoLabel>
                            </span>
                            <div className="swap-details--values--right">
                                <CurrencyIcon currency={quoteCurrency} />
                                <TokenBalance
                                    token={Token.BTC}
                                    convertTo={quoteCurrency}
                                    amount={"0.0001"}
                                    tokenPrices={tokenPrices}
                                />
                            </div>
                        </div>
                        <div className="swap-details--rounded">
                            <span className="swap-details--values--left">
                                You will receive
                                </span>
                            <div className="swap-details--values--right">
                                <TokenBalance
                                    token={orderInputs.dstToken}
                                    amount={orderInputs.dstAmount}
                                />
                                {" "}
                                {orderInputs.dstToken}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="popup--buttons">
                    <button className="button open--confirm" onClick={done}><span>{t("popup.confirm")}</span></button>
                </div>

            </div>
        </div>
    </Popup>;
};
