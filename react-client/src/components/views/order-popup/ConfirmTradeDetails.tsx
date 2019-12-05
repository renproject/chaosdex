import * as React from "react";

import { Currency, CurrencyIcon, InfoLabel, TokenIcon } from "@renproject/react-components";
import BigNumber from "bignumber.js";

import { recoverRenVMFee } from "../../../lib/estimatePrice";
import { renderToken, Token, TokenPrices } from "../../../state/generalTypes";
import { CommitmentType } from "../../../state/persistentContainer";
import { OrderInputs } from "../../../state/uiContainer";
import { ReactComponent as Arrow } from "../../../styles/images/arrow-right.svg";
import { Popup } from "../Popup";
import { TokenBalance } from "../TokenBalance";

export const ConfirmTradeDetails: React.StatelessComponent<{
    orderInputs: OrderInputs;
    quoteCurrency: Currency;
    tokenPrices: TokenPrices;
    commitmentType: CommitmentType;
    done(): void;
    cancel(): void;
}> = ({ tokenPrices, orderInputs, quoteCurrency, commitmentType, done, cancel }) => {
    const feeRow = (token: Token) => {
        if (token === Token.BTC || token === Token.ZEC || token === Token.BCH) {
            return <div>
                <span className="swap-details--values--left">
                    {(token === Token.BTC) ?
                        "Bitcoin Transaction Fees" :
                        (token === Token.ZEC) ?
                            "ZCash Transaction Fees" :
                            (token === Token.BCH) ?
                                "Bitcoin Cash Transaction Fees" :
                                "Transaction Fees"
                    }
                </span>
                <div className="swap-details--values--right">
                    <CurrencyIcon currency={quoteCurrency} />
                    <TokenBalance
                        token={token}
                        convertTo={quoteCurrency}
                        amount={"0.0001"}
                        tokenPrices={tokenPrices}
                    />
                </div>
            </div>;
        } else {
            return <></>;
        }
    };

    let title: React.ReactNode;
    switch (commitmentType) {
        case CommitmentType.Trade:
            title = <>Confirm Trade</>;
            break;
        case CommitmentType.AddLiquidity:
            title = <>Add Liquidity</>;
            break;
        case CommitmentType.RemoveLiquidity:
            title = <>Remove Liquidity</>;
            break;
        default:
            title = <>Confirm</>;
    }

    return <Popup cancel={cancel} whiteX={true}>
        <div className="swap swap--popup open">
            <div className="popup--header">
                <h2>{title}</h2>
                <div className="swap-details--icons">
                    <div>
                        <TokenIcon white={true} className="swap-details--icon" token={orderInputs.srcToken} />
                        <span>
                            <TokenBalance
                                token={orderInputs.srcToken}
                                amount={orderInputs.srcAmount}
                            />
                            {" "}
                            {renderToken(orderInputs.srcToken)}
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
                        {commitmentType === CommitmentType.Trade ? <Arrow /> : <>+</>}
                    </div>
                    <div>
                        <TokenIcon white={true} className="swap-details--icon" token={orderInputs.dstToken} />
                        <span>
                            <TokenBalance
                                token={orderInputs.dstToken}
                                amount={orderInputs.dstAmount}
                            />
                            {" "}
                            {renderToken(orderInputs.dstToken)}
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
                        {feeRow(orderInputs.dstToken)}
                        {feeRow(orderInputs.srcToken)}
                        {commitmentType === CommitmentType.Trade ?
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
                                    {renderToken(orderInputs.dstToken)}
                                </div>
                            </div> :
                            <></>
                        }
                    </div>
                </div>

                <div className="popup--buttons">
                    <button className="button open--confirm" onClick={done}><span>Confirm</span></button>
                </div>

            </div>
        </div>
    </Popup>;
};
