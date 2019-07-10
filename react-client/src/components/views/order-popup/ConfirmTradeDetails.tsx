import * as React from "react";

import { Currency, CurrencyIcon, InfoLabel, TokenIcon } from "@renproject/react-components";
import BigNumber from "bignumber.js";

import { recoverRenVMFee } from "../../../lib/estimatePrice";
import { Token, TokenPrices } from "../../../state/generalTypes";
import { OrderInputs } from "../../../state/uiContainer";
import { ReactComponent as Arrow } from "../../../styles/images/arrow-right.svg";
import { Popup } from "../Popup";
import { TokenBalance } from "../TokenBalance";

export const ConfirmTradeDetails: React.StatelessComponent<{
    orderInputs: OrderInputs;
    quoteCurrency: Currency;
    tokenPrices: TokenPrices;
    done(): void;
    cancel(): void;
}> = ({ tokenPrices, orderInputs, quoteCurrency, done, cancel }) => {
    return <Popup cancel={cancel}>
        <div className="swap swap--popup open">
            <div className="popup--header">
                <h2>Confirm Trade</h2>
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
                                RenVM Fees <InfoLabel>RenVM will receive 0.2% of the<br />asset being shifted</InfoLabel>
                            </span>
                            <div className="swap-details--values--right">
                                <CurrencyIcon currency={quoteCurrency} />
                                <TokenBalance
                                    token={orderInputs.dstToken}
                                    convertTo={quoteCurrency}
                                    amount={recoverRenVMFee(new BigNumber(orderInputs.dstAmount)).toFixed()}
                                    tokenPrices={tokenPrices}
                                    digits={3}
                                />
                            </div>
                        </div>
                        <hr />
                        <div>
                            <span className="swap-details--values--left">
                                Bitcoin Transaction Fees
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
                            <span className="swap-details--values--left bold">
                                You will receive
                                </span>
                            <div className="swap-details--values--right bold">
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
                    <button className="button open--confirm" onClick={done}><span>Confirm</span></button>
                </div>

            </div>
        </div>
    </Popup>;
};
