import * as React from "react";

import { _captureInteractionException_ } from "../../lib/errors";

export const Popup: React.StatelessComponent<{
    noOverlay?: boolean;
    cancel?: () => void;
}> = ({ noOverlay, cancel, children }) => {
    return <div className="popup--outer">
        <div className="popup">
            {children}
        </div>
        {noOverlay ? null : <div role="none" className="overlay" onClick={cancel} />}
    </div>;
};
