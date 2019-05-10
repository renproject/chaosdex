// tslint:disable:no-any

import * as React from "react";

import { Subscribe } from "unstated";

export interface ConnectedProps {
    containers: any[];
}

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// Somewhat typesafe version of https://github.com/goncy/unstated-connect
// tslint:disable-next-line:only-arrow-functions
export function connect<X extends ConnectedProps>(_containers: any[]) {
    return (Component: React.ComponentClass<X>) => (props: Omit<X, "containers">) => (
        <Subscribe to={_containers}>
            {(...containers) => <Component {...({ ...props, containers } as unknown as X)} />}
        </Subscribe>
    );
}

// tslint:enable:no-any
