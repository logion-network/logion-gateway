import { Container } from "inversify";
import request from "supertest";
import { It, Mock } from "moq.ts";
import { Keyring } from "@polkadot/api";
import type { KeyringPair } from '@polkadot/keyring/types.js';

import { setupApp } from "./testapp.js";
import { CollectionController } from "../src/controllers/collection.controller.js";
import { LogionService } from "../src/services/logion.service.js";
import { LogionNodeApiClass, UUID, Hash, ValidAccountId, LegalOfficerCase } from "@logion/node-api";
import { AddCollectionItemParams, ClosedCollectionLoc, FetchAllLocsParams, LocsState, LogionClient, LogionClientConfig, CollectionItem, HashString } from "@logion/client";

const expectedWebSocketUrl = "ws://localhost:9944";
const expectedDirectoryUrl = "http://localhost:8090";
const expectedCollectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
const expectedItemId = Hash.fromHex("0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705");
const expectedSuri = "0x123456789abcdf";
const expectedRequester = ValidAccountId.polkadot("5FniDvPw22DMW1TLee9N8zBjzwKXaKB2DcvZZCQU5tjmv1kb");
const expectedOwner = ValidAccountId.polkadot("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
const expectedDescription = "Some description";
const expectedError = "Expected error";

describe("CollectionController", () => {

    it("adds collection item", async () => {

        const app = setupApp(CollectionController, mockForAdd);

        await request(app)
            .post(`/api/collection/${ expectedCollectionLocId }`)
            .send({
                webSocketUrl: expectedWebSocketUrl,
                directoryUrl: expectedDirectoryUrl,
                suri: expectedSuri,
                itemId: expectedItemId.toHex(),
                itemDescription: expectedDescription
            })
            .expect(200);
    })

    it("returns error in case of add failure", async () => {

        const app = setupApp(CollectionController, mockForError);

        await request(app)
            .post(`/api/collection/${ expectedCollectionLocId }`)
            .send({
                webSocketUrl: expectedWebSocketUrl,
                directoryUrl: expectedDirectoryUrl,
                suri: expectedSuri,
                itemId: expectedItemId.toHex(),
                itemDescription: expectedDescription
            })
            .expect(400)
            .then(response => {
                expect(response.body.details).toEqual(expectedError)
            });
    })

    it("gets an existing collection item", async () => {

        const app = setupApp(CollectionController, mockForGet);

        await request(app)
            .put(`/api/collection/${ expectedCollectionLocId }/${ expectedItemId.toHex() }`)
            .send({
                webSocketUrl: expectedWebSocketUrl,
                directoryUrl: expectedDirectoryUrl,
            })
            .expect(200)
            .then(response => {
                expect(response.body.collectionLocId).toEqual(expectedCollectionLocId)
                expect(response.body.itemId).toEqual(expectedItemId.toHex())
                expect(response.body.itemDescription).toEqual(expectedDescription)
            });
    })

    it("gets not found when requesting non-existent collection item", async () => {

        const app = setupApp(CollectionController, mockForGet);

        await request(app)
            .put(`/api/collection/${ expectedCollectionLocId }/${ Hash.of("unknown-item").toHex() }`)
            .send({
                webSocketUrl: expectedWebSocketUrl,
                directoryUrl: expectedDirectoryUrl,
            })
            .expect(404);
    })
})

function mockForAdd(container: Container): void {
    const { client, keyring, locState } = mockLogionService(container);

    const keypair = new Mock<KeyringPair>();
    keypair.setup(instance => instance.address).returns(expectedRequester.address);
    keyring.setup(instance => instance.getPairs()).returns([ keypair.object() ]);

    locState.setup(instance => instance.addCollectionItem(ItIsExpectedAddItemParams())).returnsAsync(locState.object());

    client.setup(instance => instance.authenticate(It.IsAny(), It.IsAny())).returnsAsync(client.object());
    client.setup(instance => instance.withCurrentAddress(
        It.Is<ValidAccountId>(account => account.equals(expectedRequester)),
    )).returns(client.object());
}

function mockLogionService(container: Container): {
    nodeApi: Mock<LogionNodeApiClass>,
    client: Mock<LogionClient>,
    keyring: Mock<Keyring>,
    locState: Mock<ClosedCollectionLoc>,
} {
    const nodeApi = new Mock<LogionNodeApiClass>();

    const client = new Mock<LogionClient>();
    client.setup(instance => instance.logionApi).returns(nodeApi.object());
    client.setup(instance => instance.disconnect()).returnsAsync();

    const loc = new Mock<LegalOfficerCase>();
    loc.setup(instance => instance.requesterAddress).returns(expectedRequester);
    loc.setup(instance => instance.owner).returns(expectedOwner.address);
    nodeApi.setup(instance => instance.queries.getLegalOfficerCase(ItIsExpectedLocId())).returnsAsync(loc.object());

    const locState = new Mock<ClosedCollectionLoc>();

    const locs = new Mock<LocsState>();
    locs.setup(instance => instance.findById(ItIsExpectedLocId())).returns(locState.prototypeof(ClosedCollectionLoc.prototype).object());
    client.setup(instance => instance.locsState(ItIsExpectedLocsSpec())).returnsAsync(locs.object());

    const logionService = new Mock<LogionService>();
    logionService.setup(instance => instance.buildApi(IsExpectedConfig())).returns(Promise.resolve(client.object()));

    const keyring = new Mock<Keyring>();
    logionService.setup(instance => instance.buildKeyring(expectedSuri)).returns(keyring.object());

    container.bind(LogionService).toConstantValue(logionService.object());

    return { nodeApi, client, keyring, locState };
}

function IsExpectedConfig() {
    return It.Is<LogionClientConfig>(config =>
        config.directoryEndpoint === expectedDirectoryUrl
        && config.rpcEndpoints[0] === expectedWebSocketUrl
    );
}

function ItIsExpectedLocId() {
    return It.Is<UUID>(locId => locId.toString() === expectedCollectionLocId);
}

function ItIsExpectedLocsSpec() {
    return It.Is<FetchAllLocsParams>(params =>
        params.spec?.locTypes.length === 1
        && params.spec?.locTypes[0] === "Collection"
        && params.spec?.statuses.length === 1
        && params.spec?.statuses[0] === "CLOSED"
        && params.spec.ownerAddress === expectedOwner.address
        && params.spec.requesterAddress === expectedRequester.address
    );
}

function ItIsExpectedAddItemParams() {
    return It.Is<AddCollectionItemParams>(params =>
        params.itemId.equalTo(expectedItemId)
        && params.itemDescription === expectedDescription
    );
}

function mockForError(container: Container): void {
    const { client, keyring, locState } = mockLogionService(container);

    const keypair = new Mock<KeyringPair>();
    keypair.setup(instance => instance.address).returns(expectedRequester.address);
    keyring.setup(instance => instance.getPairs()).returns([ keypair.object() ]);

    locState.setup(instance => instance.addCollectionItem)
        .returns(_ => Promise.reject(new Error(expectedError)));

        client.setup(instance => instance.withCurrentAddress(
            It.Is<ValidAccountId>(account => account.equals(expectedRequester)),
        )).returns(client.object());
    client.setup(instance => instance.authenticate(It.IsAny(), It.IsAny())).returnsAsync(client.object());
}

function mockForGet(container: Container): void {
    const { client } = mockLogionService(container);

    const item = new Mock<CollectionItem>();
    item.setup(instance => instance.description).returns(HashString.fromValue(expectedDescription));
    client.setup(instance => instance.public.findCollectionLocItemById(
        It.Is<{ locId: UUID, itemId: Hash}>(params =>
            params.itemId.equalTo(expectedItemId)
            && params.locId.toString() === expectedCollectionLocId
    ))).returnsAsync(item.object());
}
