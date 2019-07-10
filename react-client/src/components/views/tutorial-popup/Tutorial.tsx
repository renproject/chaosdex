import * as React from "react";

import { ReactComponent as Docs } from "../../../styles/images/icons/docs.svg";
import { ReactComponent as FAQ } from "../../../styles/images/icons/faq.svg";
import { ReactComponent as HowItWorks } from "../../../styles/images/icons/howitworks.svg";
import { Popup } from "../Popup";
import { FAQ_LINK, HOWITWORKS_LINK, READTHEDOCS_LINK, tutorialPages } from "./TutorialPages";

/**
 * Shows a tutorial popup with multiple pages. The pages are defined in
 * [[TutorialPages]].
 */
export const Tutorial: React.StatelessComponent<{
    cancel: () => void;
}> = ({ cancel }) => {

    // `page` represents the index of the current page being shown, out of the
    // pages in `tutorialPages`.
    const [page, setPage] = React.useState(0);

    const nextPage = React.useCallback(async () => {
        if (page < tutorialPages.length - 1) {
            setPage(page + 1);
        } else {
            cancel();
        }
    }, [page, setPage]);

    const previousPage = React.useCallback(async () => {
        if (page > 0) {
            setPage(page - 1);
        }
    }, [page, setPage]);

    return <Popup cancel={cancel}>
        <div className="tutorial">
            <div className="tutorial--left">
                <div className="tutorial--left--top">
                    <div className="tutorial--left--setup">Setup Guide</div>
                    <ul>
                        {tutorialPages.map(({ name }, index) =>
                            // tslint:disable-next-line: react-this-binding-issue jsx-no-lambda
                            <li onClick={() => { setPage(index); }} role="tab" key={name} className={`${page >= index ? "checked" : ""} ${page === index ? "selected" : ""}`}>{name}</li>
                        )}
                    </ul>
                </div>
                <div className="tutorial--left--bottom">
                    <hr />
                    <ul>
                        <li><a href={HOWITWORKS_LINK} target="_blank" rel="noopener noreferrer"><HowItWorks />How it works</a></li>
                        <li><a href={READTHEDOCS_LINK} target="_blank" rel="noopener noreferrer"><Docs />Read the docs</a></li>
                        <li><a href={FAQ_LINK} target="_blank" rel="noopener noreferrer"><FAQ />FAQs</a></li>
                    </ul>
                </div>
            </div>
            <div className="tutorial--right">
                {React.createElement(tutorialPages[page].node, { nextPage, previousPage })}
            </div>
        </div>
    </Popup>;
};
