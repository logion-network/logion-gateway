import { OpenAPIV3 } from "openapi-types";
import express, { Express } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Dino } from "dinoloop";
import { Container } from "inversify";

import { setOpenApi3, loadSchemasIntoSpec } from "./controllers/doc.js";
import { ApplicationErrorController } from "./controllers/application.error.controller.js";
import { JsonResponse } from "./middlewares/json.response.js";
import { AppContainer } from "./container/app.container.js";

import { CollectionController, fillInSpec as fillInSpecCollection } from "./controllers/collection.controller.js";

export function predefinedSpec(spec: OpenAPIV3.Document): OpenAPIV3.Document {
    setOpenApi3(spec);
    loadSchemasIntoSpec(spec, "./resources/schemas.json");

    spec.info = {
        title: "Logion gateway API",
        description: `API for logion chain.  
[Spec V3](/api-spec/v3)`,
        termsOfService: "https://logion.network/",
        contact: {
            name: "Logion Team",
            url: "https://logion.network/",
            email: "info@logion.network"
        },
        license: {
            name: "Apache 2.0",
            url: "http://www.apache.org/licenses/LICENSE-2.0"
        },
        version: "0.1",
    };

    fillInSpecCollection(spec);

    return spec;
}

export function setupApp(app: Express) {
    app.use(bodyParser.json());
    app.use(cors());

    const dino = new Dino(app, '/api');

    dino.useRouter(() => express.Router());
    dino.registerApplicationError(ApplicationErrorController);
    dino.requestEnd(JsonResponse);

    dino.registerController(CollectionController);

    dino.dependencyResolver<Container>(AppContainer,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();
}
