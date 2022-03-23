import './inversify.decorate';
import { Container } from 'inversify';

import { JsonResponse } from '../middlewares/json.response';
import { ApplicationErrorController } from '../controllers/application.error.controller';
import { CollectionController } from '../controllers/collection.controller';

let container = new Container({ defaultScope: "Singleton" });
container.bind(JsonResponse).toSelf();

// Controllers are stateful so they must not be injected with singleton scope
container.bind(ApplicationErrorController).toSelf().inTransientScope();
container.bind(CollectionController).toSelf().inTransientScope();

export { container as AppContainer };
