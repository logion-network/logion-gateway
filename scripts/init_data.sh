#!/bin/bash

# Directory
docker-compose exec -T directory-database psql -U postgres postgres < scripts/directory_data.sql

# Authority list
node ./scripts/init_onchain_data.js
