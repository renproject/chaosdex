import BigNumber from "bignumber.js";

import { getStep } from "./conversion";

test("getStep should convert the step to the correct order of magnitude", () => {
    expect(getStep(new BigNumber("0.5"), 0.2))
        .toEqual("0.02");

    expect(getStep(new BigNumber("5"), 0.2))
        .toEqual("0.2");

    expect(getStep(new BigNumber("10"), 0.2))
        .toEqual("2");

    expect(getStep(new BigNumber("50"), 0.2))
        .toEqual("2");

    expect(getStep(new BigNumber("1000"), 0.2))
        .toEqual("200");

    expect(getStep(new BigNumber("10000000000000000"), 0.2))
        .toEqual("2000000000000000");

    expect(getStep(new BigNumber("-5"), 0.2))
        .toEqual("NaN");

});
