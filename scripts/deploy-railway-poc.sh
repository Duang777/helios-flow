#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/apps/helios/.env.production}"
if [[ ! -f "$ENV_FILE" && -f "$ROOT/apps/helios/.env" ]]; then
  ENV_FILE="$ROOT/apps/helios/.env"
fi

if [[ -z "${RAILWAY_API_TOKEN:-}" ]]; then
  echo "[deploy] export RAILWAY_API_TOKEN (Account token from railway.com/account/tokens)" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy] create $ENV_FILE with APP_URL, DATABASE_URL, JWT_SECRET, AUTH_SECRET, OPENAI_API_KEY, HELIOS_AI_*" >&2
  exit 1
fi

export DEPLOY_ENV_FILE="$ENV_FILE"

echo "[deploy] dry-run plan..."
yarn helios deploy railway --dry-run --env-file "$ENV_FILE" "$@"

echo
echo "[deploy] to deploy for real:"
echo "  yarn helios deploy railway --env-file $ENV_FILE --source git"
echo "  # or: yarn helios deploy railway --env-file $ENV_FILE --source local"
