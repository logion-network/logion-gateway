import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpPost, NotFoundException, HttpPut, BadRequestException } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { DispatchError } from '@polkadot/types/interfaces/system/types';

import { components } from "./components";
import { addTag, setControllerTag, setPathParameters, getDefaultResponsesNoContent, getRequestBody, getBodyContent } from "./doc";
import { LogionService } from "../services/logion.service";

type CreateCollectionItemView = components["schemas"]["CreateCollectionItemView"];
type GetCollectionItemView = components["schemas"]["GetCollectionItemView"];
type CollectionItemView = components["schemas"]["CollectionItemView"];

export function fillInSpec(spec: OpenAPIV3.Document): void {
    const tagName = 'Collections';
    addTag(spec, {
        name: tagName,
        description: "Handling of Collections"
    });
    setControllerTag(spec, /^\/api\/collection.*/, tagName);

    CollectionController.addCollectionItem(spec);
    CollectionController.getCollectionItem(spec);
}

@injectable()
@Controller('/collection')
export class CollectionController extends ApiController {

    constructor(
        private logionService: LogionService
    ) {
        super();
    }

    static addCollectionItem(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}"].post!;
        operationObject.summary = "Adds an item to an existing collection";
        operationObject.description = "";
        operationObject.responses = getDefaultResponsesNoContent();
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the collection loc"
        });
        operationObject.requestBody = getRequestBody({
            description: "Item creation data",
            view: "CreateCollectionItemView",
        });
    }

    @HttpPost('/:collectionLocId')
    @Async()
    async addCollectionItem(body: CreateCollectionItemView, collectionLocId: string): Promise<void> {
        const url = body.webSocketUrl!;
        const suri = body.suri!;
        const itemId = body.itemId!;
        const itemDescription = body.itemDescription!;

        const api = await this.logionService.buildApi(url);
        const keyPair = this.logionService.buildKeyringPair(suri);

        try {
            await new Promise<void>(async (resolve, reject) => {
                try {
                    const unsub = await api.tx.logionLoc
                    .addCollectionItem(collectionLocId, itemId, itemDescription)
                    .signAndSend(keyPair, (result) => {
                        if (result.status.isInBlock) {
                            unsub();
                            if(result.dispatchError) {
                                reject(result.dispatchError);
                            } else {
                                resolve();
                            }
                        }
                    });
                } catch(error) {
                    reject(error);
                }
            });
        } catch(error) {
            if(error && typeof error === 'object' && 'toHuman' in error) {
                const dispatchError = error as DispatchError;
                throw new BadRequestException(dispatchError.toHuman());
            } else {
                throw new BadRequestException(error);
            }
        }
    }

    static getCollectionItem(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemId}"].put!;
        operationObject.summary = "Retrieves an item from an existing collection";
        operationObject.description = "";
        operationObject.responses = {
            "200": {
                description: "OK",
                content: getBodyContent("CollectionItemView"),
            },
            "404": {
                description: "Not Found"
            }
        };
        setPathParameters(operationObject, {
            'collectionLocId': "The ID of the collection loc",
            'itemId': "The ID of the item in the collection"
        });
        operationObject.requestBody = getRequestBody({
            description: "Item retrieval data",
            view: "GetCollectionItemView",
        });
    }

    @HttpPut('/:collectionLocId/:itemId')
    @Async()
    async getCollectionItem(body: GetCollectionItemView, collectionLocId: string, itemId: string): Promise<CollectionItemView> {
        const url = body.webSocketUrl!;

        const api = await this.logionService.buildApi(url);
        const item = await api.query.logionLoc.collectionItemsMap(collectionLocId, itemId);
        if(item.isSome) {
            return {
                collectionLocId,
                itemId,
                itemDescription: item.unwrap().description.toUtf8()
            }
        } else {
            throw new NotFoundException();
        }
    }
}
