import * as React from "react";

import { Loading } from "@renex/react-components";

import { _captureInteractionException_ } from "../../lib/errors";

/**
 * SigningPopup is a popup component for prompting for a user's ethereum
 * signature
 */
export class SigningPopup extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            error: null,
            signing: true,
            enterManually: false,
            manualSignature: "",
        };
    }

    public async componentDidMount() {
        this.callSign()
            .catch(null);
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { signing, error, enterManually } = this.state;
        const { data } = this.props;
        return <div className="popup sign">
            <h2>Approve signature</h2>
            <div className="sign--data">{data.map((item, key) => <div key={key} className="monospace sign--datum">{item}</div>)}</div>
            {signing ?
                <>
                    <Loading />
                </> :
                <>
                    {enterManually ?
                        <>
                            <textarea
                                className="input sign--manual"
                                placeholder="0x..."
                                role="textbox"
                                name={"manualSignature"}
                                onChange={this.handleInput}
                                value={this.state.manualSignature}
                            />
                            {error ? <span className="popup--error">{error}</span> : null}
                            <div className="popup--buttons">
                                <button className="button button--alt" onClick={this.toggleEnterManually}>Cancel</button>
                                <button className="button" onClick={this.submitManualSignature}>Submit</button>
                            </div>
                        </> : <>
                            {error ? <span className="popup--error">{error}</span> : null}
                            <div className="popup--buttons">
                                <button className="button button--alt" onClick={this.props.reject}>Close</button>
                                <button className="button" onClick={this.toggleEnterManually}>Enter manually</button>
                                <button className="button" onClick={this.callSign}>Try again</button>
                            </div>
                        </>
                    }
                </>
            }
        </div>;
    }

    private readonly submitManualSignature = async () => {
        const { manualSignature } = this.state;
        try {
            await this.props.resolve(manualSignature);
        } catch (error) {
            this.setState({ error: error ? error.message || error.toString() : "Something went wrong" });
        }
    }

    private readonly handleInput = (event: React.FormEvent<HTMLTextAreaElement>): void => {
        const element = (event.target as HTMLTextAreaElement);
        this.setState((current: State) => ({ ...current, [element.name]: element.value }));
    }

    private readonly toggleEnterManually = () => {
        this.setState({ error: null, enterManually: !this.state.enterManually });
    }

    private readonly callSign = async () => {
        const { sign } = this.props;

        this.setState({ signing: true, error: null });

        try {
            const signature = await sign();
            try {
                await this.props.resolve(signature);
            } catch (error) {
                this.setState({ error: error ? error.message || error.toString() : "Something went wrong" });
            }
        } catch (error) {
            _captureInteractionException_(error, {
                description: "Error in SigningPopup.callSign",
                shownToUser: "In SigningPopup message box",
            });
            this.setState({ error: error.message || error });
        }
        this.setState({ signing: false });
    }
}

interface Props {
    data: string[];
    sign(): Promise<string>;
    reject(): void;
    resolve(signature: string): Promise<void>;
}

interface State {
    error: string | null;
    signing: boolean;
    enterManually: boolean;
    manualSignature: string;
}
