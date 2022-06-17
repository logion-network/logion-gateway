# Build backend
FROM node:16 AS build
WORKDIR /tmp/logion-gateway
COPY . .
RUN yarn install
RUN yarn build

# Backend image
FROM node:16

COPY --from=build /tmp/logion-gateway/dist dist
COPY --from=build /tmp/logion-gateway/node_modules node_modules
COPY --from=build /tmp/logion-gateway/resources resources

ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV PORT=8080

CMD node ./dist/app.js
EXPOSE ${PORT}
