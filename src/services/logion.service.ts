import { injectable } from "inversify";
import { Keyring } from '@polkadot/api';
import type { IKeyringPair } from '@polkadot/types/types';
import { buildApiClass, LogionNodeApiClass } from '@logion/node-api';

@injectable()
export class LogionService {

    async buildApi(url: string): Promise<LogionNodeApiClass> {
        return await buildApiClass(url);
    }

    buildKeyringPair(suri: string): IKeyringPair {
        const keyring = new Keyring({ type: 'sr25519' });
        return keyring.addFromUri(suri);
    }
}
