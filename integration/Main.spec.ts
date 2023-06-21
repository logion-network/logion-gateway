import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { IKeyringPair, ISubmittableResult } from "@polkadot/types/types";
import { SubmittableExtrinsic } from "@polkadot/api/promise/types";
import { waitReady } from "@polkadot/wasm-crypto";
import { buildApiClass, LogionNodeApiClass, UUID, Currency, Adapters } from "@logion/node-api";
import axios from "axios";

describe("Gateway", () => {

    it("adds and retrieves items", async () => {
        await setup();

        const itemId = "0x5fa4160170ad053c261d3e441e4b10105463f44690c3749ab78846cb1bfe7659";
        const itemDescription = "Some description.";
        try {
            await axios.post(`http://localhost:8080/api/collection/${collectionLocId.toDecimalString()}`, {
                webSocketUrl: "ws://node:9944",
                suri: REQUESTER_SECRET_SEED,
                itemId,
                itemDescription,
            });

            const response = await axios.put(`http://localhost:8080/api/collection/${collectionLocId.toDecimalString()}/${itemId}`, {
                webSocketUrl: "ws://node:9944",
            });
            expect(response.data.collectionLocId).toBe(collectionLocId.toDecimalString());
            expect(response.data.itemId).toBe(itemId);
            expect(response.data.itemDescription).toBe(itemDescription);
        } catch(e: any) {
            if("response" in e && "data" in e.response && "details" in e.response.data) {
                throw new Error(e.response.data.details);
            } else {
                throw e;
            }
        }
    });

    jasmine.DEFAULT_TIMEOUT_INTERVAL = 300000;
});

let keyring: Keyring;
let alice: KeyringPair;
let requester: KeyringPair;
let api: LogionNodeApiClass;
let collectionLocId: UUID;

async function setup(): Promise<void> {
    await waitReady();
    keyring = new Keyring({ type: 'sr25519' });
    alice = keyring.addFromUri(ALICE_SEED);
    requester = keyring.addFromUri(REQUESTER_SECRET_SEED);
    api = await buildApiClass("ws://127.0.0.1:9944");

    const amount = Currency.toCanonicalAmount(Currency.nLgnt(5000n));
    const sendMoneyToRequester = api.polkadot.tx.balances.transfer(REQUESTER, amount);
    await signAndSend(alice, sendMoneyToRequester);

    collectionLocId = new UUID();
    const createCollectionLoc = api.polkadot.tx.logionLoc.createCollectionLoc(
        Adapters.toLocId(collectionLocId),
        ALICE,
        null,
        200,
        false,
    );
    await signAndSend(requester, createCollectionLoc);

    const closeCollectionLoc = api.polkadot.tx.logionLoc.close(
        Adapters.toLocId(collectionLocId),
    );
    await signAndSend(alice, closeCollectionLoc);
}

const ALICE_SEED = "0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a";

export const ALICE = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

const REQUESTER_SECRET_SEED = "unique chase zone team upset caution match west enter eyebrow limb wrist";

export const REQUESTER = "5DPLBrBxniGbGdFe1Lmdpkt6K3aNjhoNPJrSJ51rwcmhH2Tn";

function signAndSend(keypair: IKeyringPair, extrinsic: SubmittableExtrinsic): Promise<ISubmittableResult> {
    let unsub: () => void;
    return new Promise((resolve, error) => {
        extrinsic.signAndSend(keypair, (result) => {
            if(result.isError) {
                unsub();
                error(new Error("pre-dispatch error"));
            } else if (result.status.isInBlock) {
                unsub();
                if(result.dispatchError) {
                    error(new Error(Adapters.getErrorMessage(result.dispatchError)));
                } else {
                    resolve(result);
                }
            }
        })
        .then(_unsub => unsub = _unsub)
        .catch(() => error());
    });
}
