import * as React from "react";

import { connect, ConnectedProps } from "../../state/connect";
import { AppContainer } from "../../state/containers";
import { _catch_ } from "../views/ErrorBoundary";

/**
 * PopupController is a visual component for displaying an arbitrary component in the
 * foreground with the rest of the page in the background
 */
class PopupControllerClass extends React.Component<Props> {
    private readonly appContainer: AppContainer;

    constructor(props: Props) {
        super(props);
        [this.appContainer] = this.props.containers;
    }

    public render(): JSX.Element | null {
        const { popup, overlay, onCancel } = this.appContainer.state.popup;

        return (<>
            <div className={`popup--container ${popup && overlay ? "popup--blur" : ""}`}>
                {this.props.children}
            </div>
            {popup ? <div className="popup--outer">
                {_catch_(popup, { popup: true, onCancel })}
                {overlay ?
                    <div role="none" className="overlay" onClick={this.onClickHandler} /> : null}
            </div> : null}
        </>
        );
    }

    public onClickHandler = () => {
        const { dismissible, onCancel } = this.appContainer.state.popup;
        if (dismissible) {
            onCancel();
        }
    }
}

interface Props extends ConnectedProps<[AppContainer]> {
}

export const PopupController = connect<Props>([AppContainer])(PopupControllerClass);
