import { injectable } from "inversify";
import { Keyring } from '@polkadot/api';
import { LogionClient } from '@logion/client';
import { NodeAxiosFileUploader } from "@logion/client-node";

@injectable()
export class LogionService {

    async buildApi(config: { rpcEndpoints: string[], directoryEndpoint: string }): Promise<LogionClient> {
        return await LogionClient.create({
            ...config,
            buildFileUploader: () => new NodeAxiosFileUploader(),
        });
    }

    buildKeyring(suri: string): Keyring {
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.addFromUri(suri);
        return keyring;
    }
}
