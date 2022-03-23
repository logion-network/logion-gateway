// tslint:disable-next-line: no-require-imports no-var-requires
import express from 'express';
import expressOasGenerator, { SPEC_OUTPUT_FILE_BEHAVIOR } from 'express-oas-generator';
import dotenv from 'dotenv';

import { Log } from "./util/Log";
import { setupApp, predefinedSpec } from "./app.support";

const { logger } = Log;

require('source-map-support').install();

dotenv.config()

const app = express();

expressOasGenerator.handleResponses(app, {
    predefinedSpec,
    specOutputFileBehavior: SPEC_OUTPUT_FILE_BEHAVIOR.RECREATE,
    swaggerDocumentOptions: {

    },
    alwaysServeDocs: true,
});


setupApp(app)

expressOasGenerator.handleRequests();

const port = process.env.PORT || 8080;
app.listen(port, () => logger.info(`Server started on port ${ port }`));
