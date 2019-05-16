import { Record } from "@renex/react-components";
import { List, Map } from "immutable";

// tslint:disable: no-unused-variable
import { Chain, UTXO } from "../shiftSDK";
import { Lightnode } from "./darknode";
import {
    EventType, HealthResponse, ReceiveMessageRequest, ReceiveMessageResponse,
    RenVMReceiveMessageResponse, SendMessageRequest, SendMessageResponse,
} from "./types";

// tslint:enable: no-unused-variable

export const lightnodes = [
    "https://lightnode.herokuapp.com",
];

export class Mint extends Record({
    id: "",
    isXCSEvent: true,
    type: EventType.Mint,
    utxos: List<UTXO>(),
    mintTransaction: undefined as string | undefined,
    messageID: "",
    messageIDs: List<string>(),
}) { }

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

    // public bootstrap = async (): Promise<this> => {
    //     let success = false;
    //     let lastError;
    //     for (const multiAddress of this.bootstraps.toArray()) {
    //         try {
    //             const result: Lightnode | undefined = this.darknodes.get(multiAddressToID(multiAddress).id);
    //             if (!result) {
    //                 throw new Error("No darknode provided");
    //             }
    //             const peers = await result.getPeers();
    //             if (peers.result) {
    //                 this.addLightnodes(peers.result.peers.map(NewMultiAddress));
    //                 success = true;
    //             } else if (peers.error) {
    //                 throw peers.error;
    //             }
    //         } catch (error) {
    //             lastError = error;
    //         }
    //     }
    //     if (!success) {
    //         throw lastError;
    //     }
    //     return this;
    // }

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

export class WarpGateGroup extends DarknodeGroup {
    constructor(multiAddresses: string[] | string) {
        super(multiAddresses);
        // this.getHealth();
    }

    public submitDeposits = async (address: string, utxo: UTXO): Promise<List<{ messageID: string, lightnode: string }>> => {
        // TODO: If one fails, still return the other.

        const method = utxo.chain === Chain.Bitcoin ? "MintZBTC"
            : utxo.chain === Chain.ZCash ? "MintZZEC" : undefined;

        if (!method) {
            throw new Error(`Minting ${utxo.chain} not supported`);
        }

        const results = await this.sendMessage({
            nonce: window.crypto.getRandomValues(new Uint32Array(1))[0],
            to: "WarpGate",
            signature: "",
            payload: {
                method,
                args: [
                    {
                        value: address.slice(0, 2) === "0x" ? address.slice(2) : address,
                    }
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

    public checkForResponse = async (mintEvent: Mint): Promise<string> => {
        for (const node of this.darknodes.valueSeq().toArray()) {
            if (node) {
                try {
                    const signature = await node.receiveMessage({ messageID: mintEvent.messageID }) as RenVMReceiveMessageResponse;
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
