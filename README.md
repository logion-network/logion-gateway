# Logion Gateway

Logion gateway is a TypeScript backend exposing a REST API enabling external components to interact with a logion chain. The purpose of the gateway
is to provide an alternative to the explicit integration of a Polkadot/logion client in an existing software. This may be necessary if the existing
software's code is not available or if no SDK is provided in its programming language.

The gateway is totally stateless, all credentials and data have to be provided in the requests. It is meant to be deployed in the same secure environment
as the components consuming its API.

**The data exchanged with the gateway may be critical (secret seeds!), make sure that those cannot be intercepted by a malicious third party!**

## Quick start

### From source

You have to install the [Yarn package manager](https://yarnpkg.com/) first and run `yarn install` in order to install dependencies.

After that, just run

```
yarn start
```

By default, the gateway listens to port 8080. You can change this by creating file `.env` at the root of the project and choosing another port with
variable `PORT` (see `.env.sample`).

### With Docker

Install [Docker](https://www.docker.com/) on your machine then just run

```
docker run --name logion-gateway -p 8080:8080 -d logionnetwork/logion-gateway:latest
```

You may change the listening port by adding option `-e PORT=$SOME_OTHER_PORT`. If you do so, do not forget to change the `-p` option value accordingly.

## Usage

The gateway currently supports 2 operations:

- Add an item to a collection
- Check that an item exists in the collection

### Add an item to a collection

In order to add an item to a collection, a POST request must be sent to resource `/api/collection/{collectionLocId}`. See below for an example of request.

```
curl -v http://localhost:8080/api/collection/$COLLECTION_LOC_ID -d '{"webSocketUrl":"wss://test-rpc01.logion.network","suri":"$SECRET_SEED","itemId":"$ITEM_ID","itemDescription":"$ITEM_DESCRIPTION"}' -H "Content-Type: application/json"
```

If the response has status code `200`, then the item has been successfully submitted (i.e. the transaction was put in a block).

A response status code `400` may be returned in case of failure. Potential reasons are:

- wrong endpoint,
- bad credentials,
- an item with the same ID already exists in the collection.

### Check an existing item

A PUT request must be sent to resource `/api/collection/{collectionLocId}/{itemId}`. See below for an example of request.

```
curl -v -X PUT http://localhost:8080/api/collection/$COLLECTION_LOC_ID/$ITEM_ID -d '{"webSocketUrl":"wss://test-rpc01.logion.network"}' -H "Content-Type: application/json"
```

If the response has status code `200`, then the item exists in the given collection and the response body looks like this:

```
{
  "collectionLocId": "...",
  "itemId": "...",
  "itemDescription": "..."
}
```

A response status code `404` is returned if the item does not exist in the collection.

## Swagger

The detailed API documentation of the gateway is exposed at this URL (please change protocol, hostname and/or port to match your own setup):

```
http://localhost:8080/api-docs
```
