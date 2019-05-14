// tslint:disable:no-any
import * as React from "react";

import { Console } from "@renex/react-components";
import { List } from "immutable";

import { PopupID } from "../../state/generalTypes";

/**
 * OpenOrderPopup is a popup component that prompts the user to approve opening
 * an order
 */
class OpenOrderPopupClass extends React.Component<Props, State> {
    private _isMounted: boolean = false;

    constructor(props: Props) {
        super(props);
        this.state = {
            confirmed: false,
            error: null,
            logCount: 0,
            logs: List(),
            step: 0,
        };
    }

    public async componentDidMount(): Promise<void> {
        this._isMounted = true;
        if (this.state.confirmed) {
            await this.onConfirm();
        }
    }

    public async componentWillUnmount(): Promise<void> {
        this._isMounted = false;
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { confirmed } = this.state;

        let inner;
        if (!confirmed) {
            inner = this.renderConfirm();
        } else {
            inner = this.renderOpening();
        }

        return <div className="popup swap swap--popup open">
            {inner}
        </div>;
    }

    private readonly renderConfirm = (): React.ReactNode => {
        return <>
            <div className="popup--header">
                <h2>Confirm Trade</h2>
                <div role="button" className="popup--header--x" onClick={this.props.closePopup} />
            </div>
            <div className="popup--buttons">
                <button className="open--confirm" onClick={this.onConfirm}><span>Confirm</span></button>
            </div>
        </>;
    }

    private readonly renderOpening = (): React.ReactNode => {
        const { error, logs } = this.state;
        const { closePopup } = this.props;

        const logsWithError = error ? logs.push(<br />).push(<p className="red">{error.message}</p>) : logs;

        let title = <h2>Opening order...</h2>;
        if (error) {
            switch (error.message) {
                default:
                    title = <h2 className="red">Unable to complete transaction</h2>;
            }
        }
        return <>
            <div className="popup--header">
                {title}
            </div>
            <Console logs={logsWithError.toArray()} />
            {error &&
                <div className="popup--buttons">
                    {error ? <button className="open--confirm" onClick={this.onConfirm}>Retry</button> : <></>}
                    <button className="open--cancel" onClick={closePopup}>Close</button>
                </div>
            }
        </>;
    }

    private readonly onConfirm = async () => {
        const { call } = this.props;
        let { step } = this.state;

        this.setState({ error: null, confirmed: true });

        // this.props.actions.setDismissible(false);

        const simpleConsole = { log: this.log, error: this.error };

        while (step < call.length) {
            try {
                await call[step](simpleConsole);
            } catch (error) {
                // tslint:disable-next-line: no-console
                console.error(error);
                // Set state may fail if unmounted
                if (this._isMounted) {
                    this.setState({ error });
                }
                break;
            }
            step += 1;
            this.setState({ step });
        }
    }

    private readonly log = (message: string) => {
        const logCount = this.state.logCount;
        this.setState({ logCount: logCount + 1, logs: this.state.logs.push(<p key={logCount}>{message}</p>) });
    }

    private readonly error = (message: string) => {
        const logCount = this.state.logCount;
        this.setState({ logCount: logCount + 1, logs: this.state.logs.push(<p key={logCount} className="red">{message}</p>) });
    }
}

interface Props {
    orderInputs: any;
    call: any;
    quoteCurrency?: any;
    actions?: any;
    closePopup(): void;
}

interface State {
    confirmed: boolean;
    error: Error | null;
    logCount: number;
    logs: List<JSX.Element>;
    step: number;
}

const OpenOrderPopup = OpenOrderPopupClass;

export const newOpenOrderPopup = (uuid: PopupID, orderInputs: any, call: any, onCancelAction: () => void) => ({
    uuid,
    popup: <OpenOrderPopup call={call} closePopup={onCancelAction} orderInputs={orderInputs} />,
    dismissible: true,
    overlay: true,
    onCancel: onCancelAction,
});

// tslint:enable:no-any
