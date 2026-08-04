#!/bin/sh
set -e

cd /app
yarn install

yarn build:packages
yarn generate
yarn build:packages

cd /app/apps/helios

cd /app
exec yarn test:integration:ephemeral:start
