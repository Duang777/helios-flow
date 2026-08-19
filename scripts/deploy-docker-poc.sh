#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/.env}"
COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.fullapp.yml}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[deploy] missing command: $1" >&2
    exit 1
  }
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[deploy] missing required env: $name (set in $ENV_FILE)" >&2
    exit 1
  fi
}

require_cmd docker
docker compose version >/dev/null 2>&1 || {
  echo "[deploy] docker compose plugin required" >&2
  exit 1
}

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ROOT/.env.production.example" ]]; then
    cp "$ROOT/.env.production.example" "$ENV_FILE"
    echo "[deploy] created $ENV_FILE from .env.production.example — edit secrets before continuing."
    exit 1
  fi
  echo "[deploy] $ENV_FILE not found" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

require_env APP_URL
require_env JWT_SECRET
require_env AUTH_SECRET
require_env OPENAI_API_KEY

if [[ "${DEMO_MODE:-true}" != "false" ]]; then
  echo "[deploy] warning: DEMO_MODE is not false; set DEMO_MODE=false for production." >&2
fi

echo "[deploy] building and starting stack ($COMPOSE_FILE)..."
docker compose -f "$COMPOSE_FILE" up --build -d

echo "[deploy] waiting for app health (up to 5 min)..."
deadline=$((SECONDS + 300))
until curl -fsS "${APP_URL%/}/api/healthz" >/dev/null 2>&1 || curl -fsS "http://localhost:${APP_PORT:-3000}/api/healthz" >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    echo "[deploy] health check timed out; inspect: docker compose -f $COMPOSE_FILE logs -f app" >&2
    exit 1
  fi
  sleep 5
done

echo "[deploy] ok"
echo "  App: ${APP_URL:-http://localhost:${APP_PORT:-3000}}"
echo "  Login: ${APP_URL:-http://localhost:${APP_PORT:-3000}}/login"
echo "  Operating loop: ${APP_URL:-http://localhost:${APP_PORT:-3000}}/backend/insights/operating-loop/today"
echo "  Logs: docker compose -f $COMPOSE_FILE logs -f app"
