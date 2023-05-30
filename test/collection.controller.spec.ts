import { Container } from "inversify";
import request from "supertest";
import { It, Mock } from "moq.ts";
import { ApiPromise } from "@polkadot/api";
import type { IKeyringPair } from '@polkadot/types/types';
import { DispatchError } from '@polkadot/types/interfaces/system/types';
import { Compact, u128 } from "@polkadot/types-codec";

import { setupApp } from "./testapp.js";
import { CollectionController } from "../src/controllers/collection.controller.js";
import { LogionService } from "../src/services/logion.service.js";
import { LogionNodeApiClass, UUID } from "@logion/node-api";

const expectedWebSocketUrl = "ws://localhost:9944";
const expectedCollectionLocId = "d61e2e12-6c06-4425-aeee-2a0e969ac14e";
const expectedItemId = "0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705";
const expectedSuri = "0x123456789abcdf";
const expectedDescription = "Some description";
const expectedError = {
    pallet: "logionLoc",
    error: "CollectionItemAlreadyExists",
    details: "An item with same identifier already exists in the collection"
};

describe("CollectionController", () => {

    it("adds collection item", async () => {

        const app = setupApp(CollectionController, mockForAdd);

        await request(app)
            .post(`/api/collection/${expectedCollectionLocId}`)
            .send({
                webSocketUrl: expectedWebSocketUrl,
                suri: expectedSuri,
                itemId: expectedItemId,
                itemDescription: expectedDescription
            })
            .expect(200);
    })

    it("returns error in case of dispatch failure", async () => {

        const app = setupApp(CollectionController, mockForDispatchError);

        await request(app)
            .post(`/api/collection/${expectedCollectionLocId}`)
            .send({
                webSocketUrl: expectedWebSocketUrl,
                suri: expectedSuri,
                itemId: expectedItemId,
                itemDescription: expectedDescription
            })
            .expect(400)
            .then(response => {
                expect(response.body).toEqual(expectedError)
            });
    })

    it("returns error in case of submit failure", async () => {

        const app = setupApp(CollectionController, mockForSubmitError);

        await request(app)
            .post(`/api/collection/${expectedCollectionLocId}`)
            .send({
                webSocketUrl: expectedWebSocketUrl,
                suri: expectedSuri,
                itemId: expectedItemId,
                itemDescription: expectedDescription
            })
            .expect(400)
            .then(response => {
                expect(response.body.pallet).toBeUndefined();
                expect(response.body.error).toBeUndefined();
                expect(response.body.details).toBe("error");
            });
    })

    it("gets an existing collection item", async () => {

        const app = setupApp(CollectionController, mockForCheck);

        await request(app)
            .put(`/api/collection/${expectedCollectionLocId}/${expectedItemId}`)
            .send({
                webSocketUrl: expectedWebSocketUrl
            })
            .expect(200)
            .then(response => {
                expect(response.body.collectionLocId).toEqual(expectedCollectionLocId)
                expect(response.body.itemId).toEqual(expectedItemId)
                expect(response.body.itemDescription).toEqual(expectedDescription)
            });
    })

    it("gets not found when requesting non-existent collection item", async () => {

        const app = setupApp(CollectionController, mockForCheck);

        await request(app)
            .put(`/api/collection/${expectedCollectionLocId}/0x12345`)
            .send({
                webSocketUrl: expectedWebSocketUrl
            })
            .expect(404);
    })
})

function mockForAdd(container: Container): void {
    const apiMock: unknown = {
        tx: {
            logionLoc: {
                addCollectionItem: (collectionLocId: { toString: () => string }, itemId: string, itemDescription: string) => ({
                    signAndSend: (keypair: any, callback: (result: any) => void): Promise<() => void> => {
                        return new Promise((resolve, reject) => {
                            if(keypair
                                    && collectionLocId.toString() === expectedCollectionLocId
                                    && itemId === expectedItemId
                                    && itemDescription === expectedDescription) {
                                resolve(() => {});
                                setTimeout(() => callback({
                                    status: {
                                        isInBlock: true
                                    }
                                }));
                            } else {
                                reject("unexpected input");
                            }
                        });
                    }
                })
            }
        },
        disconnect: () => {}
    };
    const apiClassMock = new Mock<LogionNodeApiClass>();
    apiClassMock.setup(instance => instance.polkadot).returns(apiMock as ApiPromise);
    const locId = new Mock<Compact<u128>>();
    locId.setup(instance => instance.toString()).returns(expectedCollectionLocId);
    apiClassMock.setup(instance => instance.adapters.toLocId(It.Is<UUID>(uuid => uuid.toString() === expectedCollectionLocId))).returns(locId.object());
    
    const logionService = new Mock<LogionService>();
    logionService.setup(instance => instance.buildApi(expectedWebSocketUrl)).returns(Promise.resolve(apiClassMock.object()));

    const keyPair = new Mock<IKeyringPair>();
    logionService.setup(instance => instance.buildKeyringPair(expectedSuri)).returns(keyPair.object());

    container.bind(LogionService).toConstantValue(logionService.object());
}

function mockForDispatchError(container: Container): void {
    const dispatchError: unknown = {
        isModule: true,
        asModule: {
            index: 42,
            error: 42,
        },
        registry: {
            findMetaError: () => ({
                section: expectedError.pallet,
                name: expectedError.error,
                docs: [expectedError.details],
            })
        },
    };
    const apiMock: unknown = {
        tx: {
            logionLoc: {
                addCollectionItem: (collectionLocId: string, itemId: string, itemDescription: string) => ({
                    signAndSend: (keypair: any, callback: (result: any) => void): Promise<() => void> => {
                        return new Promise((resolve, reject) => {
                            if(keypair
                                    && collectionLocId.toString() === expectedCollectionLocId
                                    && itemId === expectedItemId
                                    && itemDescription === expectedDescription) {
                                resolve(() => {});
                                setTimeout(() => callback({
                                    status: {
                                        isInBlock: true
                                    },
                                    dispatchError
                                }));
                            } else {
                                reject("unexpected input");
                            }
                        });
                    }
                })
            }
        },
        disconnect: () => {}
    };
    const apiClassMock = new Mock<LogionNodeApiClass>();
    apiClassMock.setup(instance => instance.polkadot).returns(apiMock as ApiPromise);
    const locId = new Mock<Compact<u128>>();
    locId.setup(instance => instance.toString()).returns(expectedCollectionLocId);
    apiClassMock.setup(instance => instance.adapters.toLocId(It.Is<UUID>(uuid => uuid.toString() === expectedCollectionLocId))).returns(locId.object());
    
    const logionService = new Mock<LogionService>();
    logionService.setup(instance => instance.buildApi(expectedWebSocketUrl)).returns(Promise.resolve(apiClassMock.object()));

    const keyPair = new Mock<IKeyringPair>();
    logionService.setup(instance => instance.buildKeyringPair(expectedSuri)).returns(keyPair.object());

    container.bind(LogionService).toConstantValue(logionService.object());
}

function mockForSubmitError(container: Container): void {
    const apiMock: unknown = {
        tx: {
            logionLoc: {
                addCollectionItem: (collectionLocId: string, itemId: string, itemDescription: string) => ({
                    signAndSend: (keypair: any, _callback: (result: any) => void): Promise<() => void> => {
                        return new Promise((resolve, reject) => {
                            if(keypair
                                    && collectionLocId.toString() === expectedCollectionLocId
                                    && itemId === expectedItemId
                                    && itemDescription === expectedDescription) {
                                reject("error");
                            } else {
                                resolve(() => {});
                            }
                        });
                    }
                })
            }
        },
        disconnect: () => {}
    };
    const apiClassMock = new Mock<LogionNodeApiClass>();
    apiClassMock.setup(instance => instance.polkadot).returns(apiMock as ApiPromise);
    const locId = new Mock<Compact<u128>>();
    locId.setup(instance => instance.toString()).returns(expectedCollectionLocId);
    apiClassMock.setup(instance => instance.adapters.toLocId(It.Is<UUID>(uuid => uuid.toString() === expectedCollectionLocId))).returns(locId.object());
    
    const logionService = new Mock<LogionService>();
    logionService.setup(instance => instance.buildApi(expectedWebSocketUrl)).returns(Promise.resolve(apiClassMock.object()));

    const keyPair = new Mock<IKeyringPair>();
    logionService.setup(instance => instance.buildKeyringPair(expectedSuri)).returns(keyPair.object());

    container.bind(LogionService).toConstantValue(logionService.object());
}

function mockForCheck(container: Container): void {
    const apiMock: unknown = {
        disconnect: () => {}
    };
    const apiClassMock = new Mock<LogionNodeApiClass>();
    apiClassMock.setup(instance => instance.polkadot).returns(apiMock as ApiPromise);
    const locId = new Mock<Compact<u128>>();
    locId.setup(instance => instance.toString()).returns(expectedCollectionLocId);
    apiClassMock.setup(instance => instance.adapters.toLocId(It.Is<UUID>(uuid => uuid.toString() === expectedCollectionLocId))).returns(locId.object());
    apiClassMock.setup(instance => instance.queries.getCollectionItem(It.Is<UUID>(uuid => uuid.toString() === expectedCollectionLocId), expectedItemId)).returnsAsync({
        id: expectedItemId,
        description: expectedDescription,
        files: [],
        restrictedDelivery: false,
        termsAndConditions: [],
    });
    
    const logionService = new Mock<LogionService>();
    logionService.setup(instance => instance.buildApi(expectedWebSocketUrl)).returns(Promise.resolve(apiClassMock.object()));

    container.bind(LogionService).toConstantValue(logionService.object());
}
