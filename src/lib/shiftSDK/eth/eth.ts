import Web3 from "web3";

import { Record } from "@renex/react-components";
import { List } from "immutable";
import { Contract } from "web3-eth-contract/types";
import { AbiItem } from "web3-utils";

import { DarknodeID, NewDarknodeID } from "../../types/types";

import BridgedTokenABI from "./BridgedTokenABI.json";
import DarknodeRegistryABI from "./DarknodeRegistryABI.json";

const NULL = "0x0000000000000000000000000000000000000000";

export const zBTCAddress = "0x2a8368d2a983a0aeae8da0ebc5b7c03a0ea66b37";
export const zZECAddress = "0xd67256552f93b39ac30083b4b679718a061feae6";

export class Pod extends Record({
    id: "",
    darknodes: List<string>(),
}) { }

export const darknodeRegistry = (web3: Web3, address: string): Contract => {
    return new web3.eth.Contract(DarknodeRegistryABI as AbiItem[], address);
};

export const bridgedToken = (web3: Web3, address: string): Contract => {
    return new web3.eth.Contract(BridgedTokenABI as AbiItem[], address);
};

/*
 * Retrieve all the darknodes registered in the current epoch.
 * The getDarknodes() function will always return an array of {count} with empty
 * values being the NULL address. These addresses must be filtered out.
 * When the {start} value is not the NULL address, it is always returned as the
 * first entry so it should not be re-added to the list of all darknodes.
 *
 * THROWS if there are no darknodes in the registry contract.
 */
export const getAllDarknodeIDs = async (darknodeRegistryContract: Contract): Promise<DarknodeID[]> => {
    const batchSize = 50;

    const allDarknodes = [];
    let lastDarknode = NULL;
    do {
        const darknodes: string[] = await darknodeRegistryContract.methods.getDarknodes(lastDarknode, `0x${(batchSize).toString(16)}`).call();
        allDarknodes.push(...darknodes.filter(addr => addr !== NULL && addr !== lastDarknode));
        if (darknodes.length === 0) {
            throw new Error("No darknodes in the darknode registry.");
        }
        [lastDarknode] = darknodes.slice(-1);
    } while (lastDarknode !== NULL);

    return allDarknodes.map(NewDarknodeID);
};

// export const mintToken = (bridgedToken: Contract, to: string, amount: number, hash: string, signature: string) => {
//     let signaturePrefix = 0;
//     const await bridgedToken.methods.verifySig(to, amount, hash, signature);

// }

// /*
//  * Calculate pod arrangement based on current epoch
//  */
// export const getAllPods = async (darknodeRegistryContract: Contract): Promise<List<Pod>> => {
//     const darknodes = await getAllDarknodes(darknodeRegistryContract);
//     const podSizeReturnValue = await darknodeRegistryContract.methods.minimumPodSize().call();
//     const minimumPodSize = new BN(podSizeReturnValue.toString()).toNumber();
//     console.log(`Using minimum pod size ${minimumPodSize}`);
//     const epoch: [string, string] = await darknodeRegistryContract.methods.currentEpoch().call();

//     if (!darknodes.length) {
//         return Promise.reject(new Error("no darknodes in contract"));
//     }

//     if (minimumPodSize === 0) {
//         return Promise.reject(new Error("invalid minimum pod size (0)"));
//     }

//     console.log(`epoch[0]: ${epoch[0]} (${epoch[0].toString()})`);
//     const epochVal = new BN(epoch[0].toString());
//     const numberOfDarknodes = new BN(darknodes.length);
//     let x = epochVal.mod(numberOfDarknodes);
//     let positionInOcean = List();
//     for (let i = 0; i < darknodes.length; i++) {
//         positionInOcean = positionInOcean.set(i, -1);
//     }

//     console.log(`Calculating pods`);

//     let pods = List<Pod>();
//     // FIXME: (setting to 1 if 0)
//     const numberOfPods = Math.floor(darknodes.length / minimumPodSize) || 1;
//     for (let i = 0; i < numberOfPods; i++) {
//         pods = pods.push(new Pod());
//     }

//     for (let i = 0; i < numberOfPods * minimumPodSize; i++) {
//         while (positionInOcean.get(x.toNumber()) !== -1) {
//             x = x.add(new BN(1));
//             x = x.mod(numberOfDarknodes);
//         }

//         positionInOcean = positionInOcean.set(x.toNumber(), i);
//         const podIndex = i % numberOfPods;

//         const pod = new Pod({
//             darknodes: pods.get(podIndex, new Pod()).darknodes.push(darknodes[x.toNumber()])
//         });
//         pods = pods.set(podIndex, pod);

//         x = x.add(epochVal);
//         x = x.mod(numberOfDarknodes);
//     }

//     for (let i = 0; i < pods.size; i++) {
//         let hashData = List<Buffer>();
//         for (const darknode of pods.get(i, new Pod()).darknodes.toArray()) {
//             hashData = hashData.push(Buffer.from(darknode.substring(2), "hex"));
//         }

//         const id = new EncodedData(keccak256(`0x${Buffer.concat(hashData.toArray()).toString("hex")}`), Encodings.HEX);
//         const pod = new Pod({
//             id: id.toBase64(),
//             darknodes: pods.get(i, new Pod()).darknodes
//         });

//         // console.log(pod.id, JSON.stringify(pod.darknodes.map((node: string) =>
//         //     new EncodedData("0x1B20" + node.slice(2), Encodings.HEX).toBase58()
//         // ).toArray()));

//         pods = pods.set(i, pod);
//     }

//     return pods;
// };

// // export const getPods = async (
// //     darknodeRegistryContract: Contract,
// //     marketID: string,
// // ): Promise<List<Pod>> => {
// //     // tslint:disable-next-line: no-unnecessary-local-variable
// //     const allPods = await getAllPods(darknodeRegistryContract);
// //     // return allPods.filter((pod: Pod) => podsForPair.includes(pod.id));
// //     return allPods;
// // };
