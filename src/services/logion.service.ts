import { injectable } from "inversify";
import { ApiPromise, Keyring } from '@polkadot/api';
import type { IKeyringPair } from '@polkadot/types/types';
import { DispatchError } from '@polkadot/types/interfaces/system/types';
import { buildApi } from '@logion/node-api';

@injectable()
export class LogionService {

    async buildApi(url: string): Promise<ApiPromise> {
        return await buildApi(url);
    }

    buildKeyringPair(suri: string): IKeyringPair {
        const keyring = new Keyring({ type: 'sr25519' });
        return keyring.addFromUri(suri);
    }

    buildErrorMetadata(api: ApiPromise, dispatchError: DispatchError): ErrorMetadata {
        if (dispatchError.isModule) {
            const module = dispatchError.asModule;
            try {
                const metaError = api.registry.findMetaError({
                    index: module.index,
                    error: module.error
                });
                if (metaError) {
                    return {
                        pallet: metaError.section,
                        error: metaError.name,
                        details: metaError.docs.join(', ').trim()
                    }
                } else {
                    return {
                        pallet: "unknown",
                        error: "Unknown",
                        details: `index:${ module.index } error:${ module.error }`
                    }
                }
            } catch (e) {
                return {
                    pallet: "unknown",
                    error: "Unknown",
                    details: `Failed to find meta error: ${e}`
                }
            }
        }
        return {
            pallet: "unknown",
            error: "Unknown",
            details: "An unknown error occurred"
        }
    }
}

export interface ErrorMetadata {
    readonly pallet: string;
    readonly error: string;
    readonly details: string;
}
