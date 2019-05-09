import * as qs from "query-string";
import * as React from "react";

import { connect, ConnectedReturnType } from "react-redux"; // Custom typings
import { RouteComponentProps, withRouter } from "react-router";
import { bindActionCreators, Dispatch } from "redux";

import { Loading } from "@renex/react-components";
import { NewOrder } from "../../components/NewOrder";
import { _captureInteractionException_ } from "../../lib/errors";
import { setAndUpdateValues } from "../../store/actions/inputs/newOrderActions";
import { ApplicationData } from "../../store/types/general";
import { _catch_ } from "../views/ErrorBoundary";

/**
 * Home is a page whose principal component allows users to open orders.
 */
class ExchangeClass extends React.Component<Props, Exchange> {
    public componentDidMount(): void {
        try {
            const queryParams = qs.parse(this.props.location.search);

            // Set market pair based on URL
            const sendToken = queryParams.send;
            const receiveToken = queryParams.receive;

            let orderInputs = this.props.orderInputs;

            if (sendToken) {
                orderInputs = this.props.actions.setAndUpdateValues(
                    orderInputs,
                    "sendToken",
                    sendToken,
                    { blur: true },
                );
            }

            if (receiveToken) {
                this.props.actions.setAndUpdateValues(
                    orderInputs,
                    "receiveToken",
                    receiveToken,
                    { blur: true },
                );
            }
        } catch (error) {
            _captureInteractionException_(error, {
                description: "Error in Exchange.componentDidMount",
                shownToUser: "No",
            });
        }
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render = (): React.ReactNode => {
        return <div className="exchange">
            <div className="content container exchange-inner">
                <div className="exchange--center">
                    {_catch_(
                        <React.Suspense fallback={<Loading />}>
                            <NewOrder disabled={false} />
                        </React.Suspense>
                    )}
                </div>
            </div>
        </div>;
    }
}

const mapStateToProps = (state: ApplicationData) => ({
    orderInputs: state.inputs,
    username: state.trader.username,
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        setAndUpdateValues,
    }, dispatch)
});

interface Props extends ReturnType<typeof mapStateToProps>, ConnectedReturnType<typeof mapDispatchToProps>, RouteComponentProps {
}

interface Exchange {
}

export const Exchange = connect(mapStateToProps, mapDispatchToProps)(withRouter(ExchangeClass));
