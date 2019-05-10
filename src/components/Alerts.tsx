import * as React from "react";

import { clearAlert } from "../store/actions/alert/alertActions";
import { ApplicationData } from "../store/types/general";

/**
 * Alerts is a visual component for displaying general alert messages.
 * Alerts can represent an Error, a Warning or a Success event.
 */
class AlertsClass extends React.Component<Props, AlertsState> {

    /**
     * Th
     */
    private readonly DEFAULT_TIME = 10 * 1000; // 10 seconds

    /**
     * NodeJS Timer for hiding alerts after a specified period
     */
    private alertIntervalTimeout: NodeJS.Timer | undefined;

    public constructor(props: Props, context: object) {
        super(props, context);
    }

    public componentWillReceiveProps(nextProps: Props): void {
        const { message } = nextProps.alert;
        if (message === null || message === this.props.alert.message) {
            return;
        }

        // Hide alert after 10 seconds.
        if (this.alertIntervalTimeout) { clearTimeout(this.alertIntervalTimeout); }

        // tslint:disable-next-line: no-string-based-set-timeout
        this.alertIntervalTimeout = setTimeout(
            this.props.actions.clearAlert,
            this.DEFAULT_TIME,
        );
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { message } = this.props.alert;
        const { alertType } = this.props.alert;
        if (message === "") {
            return <></>;
        }

        return (
            <div role="alert" className={`alert ${alertType}`}>
                <span className="alert--message">{message}</span>
                <span role="button" className="alert--cross" onClick={this.handleClose}>&#x00D7;</span>
            </div>
        );
    }

    /**
     * handleClose is called when a user manually closes an alert
     */
    private readonly handleClose = (): void => {
        if (this.alertIntervalTimeout) { clearInterval(this.alertIntervalTimeout); }
        this.props.actions.clearAlert();
    }
}

interface Props {
    // tslint:disable-next-line:no-any
    actions: any;
    // tslint:disable-next-line:no-any
    alert: any;
}

interface AlertsState {
}

export const Alerts = AlertsClass;
