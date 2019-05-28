// import { MultiAddress } from "../types/types";
import { bootstrapNode0, bootstrapNode1, DarknodeGroup } from "./darknodeGroup";

test("bootstrapping", async () => {
    // try {
    //     console.log(await (new Darknode(bootstrapNode0).getHealth()));
    // } catch (error) {
    //     console.log(error);
    // }

    const group: DarknodeGroup = await new DarknodeGroup([bootstrapNode0, bootstrapNode1]).bootstrap();
    expect(group.darknodes.size).toBeGreaterThan(1);
});
