import { Keyring } from "@polkadot/api";
import { KeyringPair } from "@polkadot/keyring/types";
import { waitReady } from "@polkadot/wasm-crypto";
import { Adapters, UUID, Lgnt, buildApiClass } from "@logion/node-api";
import axios from "axios";
import { AcceptedRequest, KeyringSigner, LogionClient, OpenLoc, PendingRequest, Signer } from "@logion/client";
import { NodeAxiosFileUploader } from "@logion/client-node";
import { IKeyringPair, ISubmittableResult } from "@polkadot/types/types";
import { SubmittableExtrinsic } from "@polkadot/api/promise/types";

describe("Gateway", () => {

    it("adds and retrieves items", async () => {
        await setup();

        const itemId = "0x5fa4160170ad053c261d3e441e4b10105463f44690c3749ab78846cb1bfe7659";
        const itemDescription = "Some description.";
        try {
            console.log("Adding item with gateway");
            await axios.post(`http://localhost:8080/api/collection/${collectionLocId.toDecimalString()}`, {
                webSocketUrl: "ws://node:9944",
                directoryUrl: "http://directory:8080",
                suri: REQUESTER_SECRET_SEED,
                itemId,
                itemDescription,
            });

            console.log("Getting item with gateway");
            const response = await axios.put(`http://localhost:8080/api/collection/${collectionLocId.toDecimalString()}/${itemId}`, {
                webSocketUrl: "ws://node:9944",
                directoryUrl: "http://directory:8080",
            });
            expect(response.data.collectionLocId).toBe(collectionLocId.toDecimalString());
            expect(response.data.itemId).toBe(itemId);
            expect(response.data.itemDescription).toBe(itemDescription);
        } catch(e: any) {
            if("response" in e && "data" in e.response && "details" in e.response.data) {
                throw new Error(e.response.data.details);
            } else if("response" in e && "data" in e.response && "errorMessage" in e.response.data) {
                throw new Error(e.response.data.errorMessage);
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
let collectionLocId: UUID;

async function setup(): Promise<void> {
    await waitReady();
    keyring = new Keyring({ type: 'sr25519' });
    alice = keyring.addFromUri(ALICE_SEED);
    requester = keyring.addFromUri(REQUESTER_SECRET_SEED);

    let client = await LogionClient.create({
        rpcEndpoints: [ "ws://127.0.0.1:9944" ],
        directoryEndpoint: "http://localhost:8090",
        buildFileUploader: () => new NodeAxiosFileUploader(),
    });
    const signer = new KeyringSigner(keyring, GATEWAY_SIGN_SEND_STRAGEGY);
    client = await client.authenticate([
        client.logionApi.queries.getValidAccountId(ALICE, "Polkadot"),
        client.logionApi.queries.getValidAccountId(REQUESTER, "Polkadot"),
    ], signer);

    await createIdentityLoc({ client, signer });
    collectionLocId = await createCollectionLoc({ client, signer });

    await updateAliceBackend();
}

const ALICE_SEED = "0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a";

export const ALICE = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

const REQUESTER_SECRET_SEED = "unique chase zone team upset caution match west enter eyebrow limb wrist";

export const REQUESTER = "5DPLBrBxniGbGdFe1Lmdpkt6K3aNjhoNPJrSJ51rwcmhH2Tn";

const GATEWAY_SIGN_SEND_STRAGEGY = {
    canUnsub(result: ISubmittableResult): boolean {
        return result.isInBlock;
    }
};

async function createIdentityLoc(params: { client: LogionClient, signer: Signer }): Promise<UUID> {
    const { client, signer } = params;

    console.log("Setting requester balance");
    const aliceClient = client.withCurrentAddress(client.logionApi.queries.getValidAccountId(ALICE, "Polkadot"));
    let aliceBalances = await aliceClient.balanceState();

    const amount = Lgnt.from(5000n);
    aliceBalances = await aliceBalances.transfer({ amount, destination: REQUESTER, signer });

    const requesterClient = client.withCurrentAddress(client.logionApi.queries.getValidAccountId(REQUESTER, "Polkadot"));
    let requesterLocs = await requesterClient.locsState();
    const userIdentity = {
        firstName: "John",
        lastName: "Doe",
        email: "john@doe.com",
        phoneNumber: "+1234",
    };
    const userPostalAddress = {
        line1: "Main Street 4",
        line2: "",
        postalCode: "1000",
        city: "Brussels",
        country: "Belgium",
    };
    console.log("Creating identity LOC");
    const pendingRequesterIdentityLoc = await requesterLocs.requestIdentityLoc({
        description: "My identity LOC",
        draft: false,
        legalOfficerAddress: ALICE,
        userIdentity,
        userPostalAddress,
    });
    const identityLocId = pendingRequesterIdentityLoc.data().id;
    let aliceLocs = await aliceClient.locsState({ spec: { ownerAddress: ALICE, locTypes: ["Identity"], statuses: ["REVIEW_PENDING"] } });
    const pendingAliceIdentityLoc = aliceLocs.findById(identityLocId) as PendingRequest;
    await pendingAliceIdentityLoc.legalOfficer.accept({ signer });
    const acceptedRequesterIdentityLoc = await pendingRequesterIdentityLoc.refresh() as AcceptedRequest;
    await acceptedRequesterIdentityLoc.open({ signer, autoPublish: false });
    aliceLocs = await aliceClient.locsState({ spec: { ownerAddress: ALICE, locTypes: ["Identity"], statuses: ["OPEN"] } });
    const openAliceIdentityLoc = aliceLocs.findById(identityLocId) as OpenLoc;
    await openAliceIdentityLoc.legalOfficer.close({ signer, autoAck: false });

    return identityLocId;
}

async function createCollectionLoc(params: { client: LogionClient, signer: Signer }): Promise<UUID> {
    const { client, signer } = params;

    const aliceClient = client.withCurrentAddress(client.logionApi.queries.getValidAccountId(ALICE, "Polkadot"));
    const requesterClient = client.withCurrentAddress(client.logionApi.queries.getValidAccountId(REQUESTER, "Polkadot"));

    console.log("Creating collection LOC");
    let requesterLocs = await requesterClient.locsState();
    const pendingRequesterLoc = await requesterLocs.requestCollectionLoc({
        description: "My collection LOC",
        draft: false,
        legalOfficerAddress: ALICE,
        valueFee: Lgnt.zero(),
        legalFee: Lgnt.zero(),
        collectionItemFee: Lgnt.fromCanonical(10n),
        tokensRecordFee: Lgnt.fromCanonical(15n),
    });
    const collectionLocId = pendingRequesterLoc.data().id;
    let aliceLocs = await aliceClient.locsState({ spec: { ownerAddress: ALICE, locTypes: ["Collection"], statuses: ["REVIEW_PENDING"] } });
    const pendingAliceLoc = aliceLocs.findById(collectionLocId) as PendingRequest;
    await pendingAliceLoc.legalOfficer.accept({ signer });
    const acceptedRequesterLoc = await pendingRequesterLoc.refresh() as AcceptedRequest;
    await acceptedRequesterLoc.openCollection({ collectionCanUpload: false, collectionMaxSize: 1, autoPublish: false, signer });
    aliceLocs = await aliceClient.locsState({ spec: { ownerAddress: ALICE, locTypes: ["Collection"], statuses: ["OPEN"] } });
    const openAliceIdentityLoc = aliceLocs.findById(collectionLocId) as OpenLoc;
    await openAliceIdentityLoc.legalOfficer.close({ signer, autoAck: false });

    return collectionLocId;
}

async function updateAliceBackend() {
    console.log("Resetting Alice backend URL on chain");
    const api = await buildApiClass("ws://127.0.0.1:9944");
    await signAndSend(alice, api.polkadot.tx.loAuthorityList
        .updateLegalOfficer(alice.address, {
            Host: {
                nodeId: "0x0024080112201ce5f00ef6e89374afb625f1ae4c1546d31234e87e3c3f51a62b91dd6bfa57df",
                baseUrl: "http://backend:8080", // Resolveable by gateway
                region: "Europe",
            }
        })
    );
    await api.polkadot.disconnect();
}

function signAndSend(keypair: IKeyringPair, extrinsic: SubmittableExtrinsic): Promise<ISubmittableResult> {
    let unsub: () => void;
    return new Promise((resolve, error) => {
        extrinsic.signAndSend(keypair, (result) => {
            if(result.isError) {
                unsub();
                error(new Error("pre-dispatch error"));
            } else if (GATEWAY_SIGN_SEND_STRAGEGY.canUnsub(result)) {
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
