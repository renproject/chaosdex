import * as React from "react";

/**
 * Heading is a visual component for displaying a title above another component
 */
export class Heading extends React.Component<Props, State> {
    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { title, description } = this.props;

        return (
            <div className="heading">
                <h2 className="heading--title">{title}</h2>
                {description &&
                    <h3 className="heading--description">({description})</h3>
                }
            </div>
        );
    }
}

interface Props {
    title: React.ReactNode | string;
    description?: React.ReactNode | string;
}

interface State {
}
