import { injectable } from "inversify";
import { Keyring } from '@polkadot/api';
import { LogionClient, LogionClientConfig } from '@logion/client';
import FormData from "form-data";

@injectable()
export class LogionService {

    async buildApi(config: LogionClientConfig): Promise<LogionClient> {
        return await LogionClient.create({
            ...config,
            formDataLikeFactory: () => new FormData(),
        });
    }

    buildKeyring(suri: string): Keyring {
        const keyring = new Keyring({ type: 'sr25519' });
        keyring.addFromUri(suri);
        return keyring;
    }
}
