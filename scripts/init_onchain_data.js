import { buildApiClass } from "@logion/node-api";
import { Keyring } from '@polkadot/api';

let api;
let keyring;
let alice;

buildApiClass("ws://localhost:9944")
.then(api0 => {
    api = api0.polkadot;
    keyring = new Keyring({ type: 'sr25519' });
    alice = keyring.addFromUri("0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a");

    return api.tx.loAuthorityList
        .updateLegalOfficer(alice.address, {
            Host: {
                nodeId: "0x0024080112201ce5f00ef6e89374afb625f1ae4c1546d31234e87e3c3f51a62b91dd6bfa57df",
                baseUrl: "http://localhost:8070",
                region: "Europe",
            }
        })
        .signAndSend(alice);
})
.then(hash => {
    console.log(`Alice update tx hash: ${hash}`);
    return api.disconnect();
})
.then(() => {
    console.log("Done");
});
