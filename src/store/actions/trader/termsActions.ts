import { createStandardAction } from "typesafe-actions";

export const agreeToTerms = createStandardAction("AGREE_TO_TERMS")<{ agreedToTerms: boolean }>();
