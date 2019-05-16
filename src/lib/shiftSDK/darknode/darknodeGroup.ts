import { List, Map } from "immutable";

import { strip0x } from "../blockchain/common";
// tslint:disable: no-unused-variable
import { Chain, UTXO } from "../shiftSDK";
import { Lightnode } from "./darknode";
import {
    HealthResponse, ReceiveMessageRequest, ReceiveMessageResponse, RenVMReceiveMessageResponse,
    SendMessageRequest, SendMessageResponse,
} from "./types";

// tslint:enable: no-unused-variable

export const lightnodes = [
    "https://lightnode.herokuapp.com",
];

const promiseAll = async <a>(list: List<Promise<a>>, defaultValue: a): Promise<List<a>> => {
    let newList = List<a>();
    for (const entryP of list.toArray()) {
        try {
            newList = newList.push(await entryP);
        } catch (error) {
            newList = newList.push(defaultValue);
        }
    }
    return newList;
};

/**
 * DarknodeGroup allows sending messages to multiple darknodes
 */
export class DarknodeGroup {
    public bootstraps = List<string>();
    public darknodes = Map<string, Lightnode>();

    constructor(multiAddresses: string[] | string) {
        if (Array.isArray(multiAddresses)) {
            this.bootstraps = this.bootstraps.concat(multiAddresses);
            this.addLightnodes(multiAddresses);
        } else {
            this.addLightnodes([multiAddresses]);
        }
        this.bootstraps = this.bootstraps.concat(multiAddresses);
    }

    public getHealth = async (): Promise<List<HealthResponse | null>> => {
        return promiseAll<HealthResponse | null>(
            this.darknodes.valueSeq().map(darknode => darknode.getHealth()).toList(),
            null,
        );
    }

    public sendMessage = async (request: SendMessageRequest): Promise<List<{ result: SendMessageResponse, lightnode: string } | null>> => {
        return promiseAll(
            this.darknodes.valueSeq().map(async (darknode) => ({
                lightnode: darknode.lightnodeURL,
                result: await darknode.sendMessage(request),
            })).toList(),
            null,
        );
    }

    public receiveMessage = async (request: ReceiveMessageRequest): Promise<List<ReceiveMessageResponse | null>> => {
        return promiseAll<ReceiveMessageResponse | null>(
            this.darknodes.valueSeq().map(darknode => darknode.receiveMessage(request)).toList(),
            null,
        );
    }

    private readonly addLightnodes = (newLightnodes: string[]): this => {
        for (const lightnode of newLightnodes) {
            this.darknodes = this.darknodes.set(lightnode, new Lightnode(lightnode));
        }
        return this;
    }
}

export class ShifterGroup extends DarknodeGroup {
    constructor(multiAddresses: string[] | string) {
        super(multiAddresses);
        // this.getHealth();
    }

    public submitDeposits = async (chain: Chain, address: string, commitmentHash: string): Promise<List<{ messageID: string, lightnode: string }>> => {
        // TODO: If one fails, still return the other.

        const method = chain === Chain.Bitcoin ? "MintZBTC"
            : chain === Chain.ZCash ? "MintZZEC" : undefined;

        if (!method) {
            throw new Error(`Minting ${chain} not supported`);
        }

        const results = await this.sendMessage({
            nonce: window.crypto.getRandomValues(new Uint32Array(1))[0],
            to: "Shifter",
            signature: "",
            payload: {
                method: `ShiftIn${chain}`,
                args: [
                    {
                        value: address.slice(0, 2) === "0x" ? address.slice(2) : address,
                    },
                    { name: "uid", type: "public", value: address },
                    { name: "commitment", type: "public", value: strip0x(commitmentHash) },
                ],
            },
        });

        if (results.filter(x => x !== null).size < 1) {
            throw new Error("Unable to send message to lightnodes.");
        }

        return results.filter(x => x !== null).map((result) => ({
            // tslint:disable: no-non-null-assertion no-unnecessary-type-assertion
            lightnode: result!.lightnode,
            messageID: result!.result.result!.messageID,
            // tslint:enable: no-non-null-assertion no-unnecessary-type-assertion
        })).toList();
    }

    public checkForResponse = async (messageID: string): Promise<string> => {
        for (const node of this.darknodes.valueSeq().toArray()) {
            if (node) {
                try {
                    const signature = await node.receiveMessage({ messageID }) as RenVMReceiveMessageResponse;
                    // Error:
                    // { "jsonrpc": "2.0", "version": "0.1", "error": { "code": -32603, "message": "result not available", "data": null }, "id": null }
                    // Success:
                    // (TODO)
                    if (signature.result) {
                        return signature.result.result[0].value;
                    } else if (signature.error) {
                        throw signature.error;
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        }
        throw new Error(`Signature not available`);
    }
}
