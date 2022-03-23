import { injectable } from "inversify";
import { ApiPromise, Keyring } from '@polkadot/api';
import { buildApi } from 'logion-api/dist/Connection';
import type { IKeyringPair } from '@polkadot/types/types';

@injectable()
export class LogionService {

    async buildApi(url: string): Promise<ApiPromise> {
        return await buildApi(url);
    }

    buildKeyringPair(suri: string): IKeyringPair {
        const keyring = new Keyring({ type: 'sr25519' });
        return keyring.addFromUri(suri);
    }
}
