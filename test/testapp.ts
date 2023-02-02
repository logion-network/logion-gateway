import '../src/container/inversify.decorate.js';
import express, { Express } from 'express';
import bodyParser from 'body-parser';
import { Dino } from 'dinoloop';
import { Container } from 'inversify';
import { ApplicationErrorController } from '../src/controllers/application.error.controller.js';
import { JsonResponse } from '../src/middlewares/json.response.js';

export function setupApp<T>(
    controller: Function & { prototype: T; },
    mockBinder: (container: Container) => void,
): Express {

    const app = express();
    app.use(bodyParser.json());

    const dino = new Dino(app, '/api');

    dino.useRouter(() => express.Router());
    dino.registerController(controller);
    dino.registerApplicationError(ApplicationErrorController);
    dino.requestEnd(JsonResponse);

    let container = new Container({ defaultScope: "Singleton" });

    mockBinder(container);

    dino.dependencyResolver<Container>(container,
        (injector, type) => {
            return injector.resolve(type);
        });

    dino.bind();

    return app;
}
