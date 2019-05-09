import * as React from "react";

import { ReactComponent as Feedback } from "../../styles/images/icons/feedback.svg";

export const FeedbackButton: React.SFC = () => {
    return <a href="https://docs.google.com/forms/d/e/1FAIpQLScDqffrmK-CtAOvL9dM0SUJq8_No6lTMmjnfH8s7a4bIbrJvA/viewform" rel="noreferrer" target="_blank" className="feedbackButton">
        <Feedback />
        <span className="feedbackButton--info">Feedback</span>
    </a>;
};
