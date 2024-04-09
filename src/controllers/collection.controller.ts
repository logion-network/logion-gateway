import { injectable } from "inversify";
import { Controller, ApiController, Async, HttpPost, NotFoundException, HttpPut, BadRequestException, HttpResponseException } from "dinoloop";
import { OpenAPIV3 } from "express-oas-generator";
import { UUID, Hash, ValidAccountId } from "@logion/node-api";

import { components } from "./components.js";
import { addTag, setControllerTag, setPathParameters, getDefaultResponsesNoContent, getRequestBody, getBodyContent } from "./doc.js";
import { LogionService } from "../services/logion.service.js";
import { ClosedCollectionLoc, ISubmittableResult, KeyringSigner, LogionClient, SignAndSendStrategy, requireDefined } from "@logion/client";

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

class GatewaySignAndSendStrategy implements SignAndSendStrategy {

    canUnsub(result: ISubmittableResult): boolean {
        return result.isInBlock;
    }
}

const GATEWAY_SIGN_SEND_STRAGEGY = new GatewaySignAndSendStrategy();

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
        operationObject.responses = getDefaultResponsesNoContent(getBodyContent("ErrorMetadataView"));
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
        const url = requireDefined(body.webSocketUrl, () => new BadRequestException({ details: "Missing RPC URL" }));
        const directoryEndpoint = requireDefined(body.directoryUrl, () => new BadRequestException({ details: "Missing directory URL" }));
        const suri = requireDefined(body.suri, () => new BadRequestException({ details: "Missing Substrate URI" }));
        const itemIdHex = requireDefined(body.itemId, () => new BadRequestException({ details: "Missing item ID" }));
        if(!Hash.isValidHexHash(itemIdHex)) {
            throw new BadRequestException({ details: "Invalid item ID, not a valid SHA-256 hash hex" });
        }
        const itemId = Hash.fromHex(itemIdHex);
        const itemDescription = requireDefined(body.itemDescription, () => new BadRequestException({ details: "Missing item description" }));
        const locId = UUID.fromAnyString(collectionLocId);
        if(!locId) {
            throw new BadRequestException({ details: "Collection LOC ID is not a valid UUID" });
        }

        const keyring = this.logionService.buildKeyring(suri);
        let api = await this.logionService.buildApi({
            rpcEndpoints: [ url ],
            directoryEndpoint,
        });
        const signer = new KeyringSigner(keyring, GATEWAY_SIGN_SEND_STRAGEGY);
        const requester = ValidAccountId.polkadot(keyring.getPairs()[0].address);
        api = await api.authenticate([ requester ], signer);
        api = api.withCurrentAddress(requester);

        try {
            const collection = await this.getCollection({
                api,
                locId,
            });
            await collection.addCollectionItem({
                payload: {
                    itemId,
                    itemDescription,
                },
                signer
            });
        } catch(error) {
            if(error && error instanceof HttpResponseException) {
                throw error;
            } else if(error && typeof error === "object" && "message" in error) {
                throw new BadRequestException({ details: error.message });
            } else {
                throw new BadRequestException({ details: `${ error }` });
            }
        } finally {
            await api.disconnect();
        }
    }

    private async getCollection(params: {
        api: LogionClient,
        locId: UUID,
    }): Promise<ClosedCollectionLoc> {
        const { api, locId } = params;
        const loc = await api.logionApi.queries.getLegalOfficerCase(locId);
        if(!loc) {
            throw new BadRequestException({ details: "Collection LOC not found" });
        }
        const locs = await api.locsState({
            spec: {
                locTypes: ["Collection"],
                statuses: ["CLOSED"],
                requesterAddress: requireDefined(loc.requesterAddress).address,
                ownerAddress: loc.owner,
            }
        });
        const locState = locs.findById(locId);
        if(locState instanceof ClosedCollectionLoc) {
            return locState;
        } else {
            throw new BadRequestException({ details: "LOC is not a closed collection" });
        }
    }

    static getCollectionItem(spec: OpenAPIV3.Document) {
        const operationObject = spec.paths["/api/collection/{collectionLocId}/{itemIdHex}"].put!;
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
            'itemIdHex': "The ID of the item in the collection"
        });
        operationObject.requestBody = getRequestBody({
            description: "Item retrieval data",
            view: "GetCollectionItemView",
        });
    }

    @HttpPut('/:collectionLocId/:itemIdHex')
    @Async()
    async getCollectionItem(body: GetCollectionItemView, collectionLocId: string, itemIdHex: string): Promise<CollectionItemView> {
        const url = requireDefined(body.webSocketUrl, () => new BadRequestException({ details: "Missing RPC URL" }));
        const directoryEndpoint = requireDefined(body.directoryUrl, () => new BadRequestException({ details: "Missing directory URL" }));
        const locId = UUID.fromAnyString(collectionLocId);
        if(!locId) {
            throw new BadRequestException({ details: "Collection LOC ID is not a valid UUID" });
        }
        if(!Hash.isValidHexHash(itemIdHex)) {
            throw new BadRequestException({ details: "Invalid item ID, not a valid SHA-256 hash hex" });
        }
        const itemId = Hash.fromHex(itemIdHex);

        const api = await this.logionService.buildApi({
            rpcEndpoints: [ url ],
            directoryEndpoint,
        });

        try {
            const item = await api.public.findCollectionLocItemById({ locId, itemId });
            if(item) {
                return {
                    collectionLocId,
                    itemId: itemId.toHex(),
                    itemDescription: item.description.validValue(),
                }
            } else {
                throw new NotFoundException();
            }
        } finally {
            await api.disconnect();
        }
    }
}
