import React from "react";

export const Column: React.SFC<Props> = (props) => {
    const { children, overlay, className } = props;

    return (
        <div className={`column ${className ? className : ""}`}>
            {overlay ?
                <>
                    <div className="column--faded">
                        {children}
                    </div>
                    <div className="column--overlay">
                        {overlay}
                    </div>
                </>
                : children
            }
        </div>
    );
};

interface Props {
    overlay: React.ReactNode | null;
    className?: string;
}
