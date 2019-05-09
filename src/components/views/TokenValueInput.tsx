import * as React from "react";

import { InfoLabel } from "@renex/react-components";

const calculateStep = (valueIn: string | null) => {
    if (valueIn === "0" || !valueIn) {
        return 0.1;
    }
    let value = valueIn;
    const split = (`0${value}`).split(".");
    let stepE = 0;
    if (split.length === 1) {
        const valueLength = value.length;
        while (value[value.length - 1] === "0") {
            value = value.slice(0, value.length - 1);
            stepE += 1;
        }
        if (stepE === valueLength - 1) {
            stepE -= 1;
        }
    } else {
        stepE = -split[1].length;
        if (split[1] === (`${"0".repeat(split[1].length - 1)}1`)) {
            stepE -= 1;
        }
    }

    return 10 ** stepE;
};

export class TokenValueInput extends React.Component<Props> {
    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { title, hint, value, subtext, error, onChange, className } = this.props;

        const disabled = onChange === null;
        return <div className={`token-value ${className || ""}`}>
            <div className="token-value--left">
                <div className="order-value--title">
                    <span>{title}</span>
                    {hint && <InfoLabel>{hint}</InfoLabel>}
                </div>
                <span className={`token-value--item ${disabled ? "disabled" : ""} ${error ? "token-value--item--error" : ""}`}>
                    <input
                        value={value === null ? "" : value}
                        type="number"
                        disabled={disabled}
                        placeholder="0"
                        min={0}
                        step={calculateStep(value)}
                        onChange={this.handleChange}
                        onBlur={this.handleBlur}
                    // onKeyDown={console.log}
                    />
                </span>
            </div>

            <div className="token-value--right">
                {this.props.children}
                <p className="order-value--subtext">
                    {/* {error ? */}
                    {/* <span className="order-value--warning"> */}
                    {/* {error} */}
                    {/* </span> : subtext} */}
                    {subtext}
                </p>
            </div>
        </div>;
    }

    private readonly handleChange = (event: React.FormEvent<HTMLInputElement>) => {
        if (this.props.onChange) {
            const element = (event.target as HTMLInputElement);
            const value = element.value;
            this.props.onChange(value, { blur: false });
        }
    }

    private readonly handleBlur = (event: React.FormEvent<HTMLInputElement>) => {
        if (this.props.onChange) {
            const element = (event.target as HTMLInputElement);
            const value = element.value;
            this.props.onChange(value, { blur: true });
        }
    }
}

interface Props {
    title: string;
    value: string | null;
    subtext: React.ReactNode;
    hint: string | null;
    error: boolean;
    onChange: ((newValue: string, options: { blur: boolean }) => void) | null;
    className?: string;
}
