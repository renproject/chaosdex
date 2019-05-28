import * as React from "react";

import { Currency, CurrencyIcon, TokenIcon } from "@renex/react-components";

import { _catchInteractionErr_ } from "../../lib/errors";
import { OrderData } from "../../state/containers/appContainer";
import { ReactComponent as Arrow } from "../../styles/images/arrow-right.svg";
import { TokenBalance } from "../views/TokenBalance";
import { Popup } from "./Popup";

export const ConfirmTradeDetails: React.StatelessComponent<{
    orderInputs: OrderData;
    quoteCurrency: Currency;
    done(): void;
    cancel(): void;
}> = ({ orderInputs, quoteCurrency, done, cancel }) => {

    return <Popup cancel={cancel}>
        <div className="swap swap--popup open">
            <div className="popup--header">
                <h2>Confirm Trade</h2>
                <div role="button" className="popup--header--x" onClick={cancel} />
                <div className="swap-details--section swap-details--icons">
                    <div>
                        <TokenIcon className="swap-details--icon" token={orderInputs.srcToken} />
                        <span>
                            <TokenBalance
                                token={orderInputs.srcToken}
                                amount={orderInputs.sendVolume}
                            />
                            {" "}
                            {orderInputs.srcToken}
                        </span>
                    </div>
                    <div className="swap-details--icons--arrow">
                        <Arrow />
                    </div>
                    <div>
                        <TokenIcon className="swap-details--icon" token={orderInputs.dstToken} />
                        <span>
                            <TokenBalance
                                token={orderInputs.dstToken}
                                amount={orderInputs.receiveVolume}
                            />
                            {" "}
                            {orderInputs.dstToken}
                        </span>
                    </div>
                </div>
            </div>
            <div className="popup--body">
                Details
                {orderInputs.sendVolume} {orderInputs.srcToken} for {orderInputs.receiveVolume} {orderInputs.dstToken}
                <div className={`swap-details`}>
                    <hr />
                    <div className="swap-details--section swap-details--values">
                        <div>
                            <span className="swap-details--values--left">Send</span>
                            <div className="swap-details--values--right">
                                <span className="swap-details--values--right--bold">
                                    <TokenBalance
                                        token={orderInputs.srcToken}
                                        amount={orderInputs.srcToken}
                                        toReadable={true}
                                        digits={18}
                                    />
                                    {" "}{orderInputs.srcToken}
                                </span>
                                <div className="swap-details--values--right--light">
                                    <CurrencyIcon currency={quoteCurrency} />
                                    <TokenBalance
                                        token={orderInputs.srcToken}
                                        convertTo={quoteCurrency}
                                        amount={orderInputs.srcToken}
                                        toReadable={true}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <span className="swap-details--values--left">Receive</span>
                            <div className="swap-details--values--right">
                                <span className="swap-details--values--right--bold">
                                    <TokenBalance
                                        token={orderInputs.srcToken}
                                        amount={orderInputs.srcToken}
                                        toReadable={true}
                                        digits={18}
                                    />
                                    {" "}{orderInputs.srcToken}
                                </span>
                                <div className="swap-details--values--right--light">
                                    <CurrencyIcon currency={quoteCurrency} />
                                    <TokenBalance
                                        token={orderInputs.srcToken}
                                        convertTo={quoteCurrency}
                                        amount={orderInputs.srcToken}
                                        toReadable={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <hr />
                    <div className="swap-details--section swap-details--values">
                        <div>
                            <span className="swap-details--values--left">Transaction fees</span>
                            <div className="swap-details--values--right">
                                <span className="swap-details--values--right--bold">
                                    0.2%
                        </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="popup--buttons">
                    <button className="button open--confirm" onClick={done}><span>Confirm</span></button>
                </div>

            </div>
        </div>;
    </Popup>;
};
