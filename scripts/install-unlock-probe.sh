#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="fanchengliu"
REPO_NAME="komari-next-pro"
RELEASE_TAG="v26.04.24-pingblocks-fix"
ASSET_NAME="komari-unlock-probe-v26.04.24.tar.gz"
DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}/${ASSET_NAME}"
INSTALL_DIR_DEFAULT="/opt/komari-next-pro-unlock-probe"

log(){ printf '\n== %s ==\n' "$1"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }; }
choose_compose(){
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
}

need curl
need tar
need docker
COMPOSE_CMD="$(choose_compose)"
if [ -z "$COMPOSE_CMD" ]; then
  echo "Missing docker compose (plugin or docker-compose)." >&2
  exit 1
fi

INSTALL_DIR="${INSTALL_DIR:-$INSTALL_DIR_DEFAULT}"
PORT="${UNLOCK_PROBE_PORT:-19116}"
KOMARI_BASE="${KOMARI_BASE:-http://127.0.0.1:25774}"
KOMARI_USER="${KOMARI_USER:-admin}"
KOMARI_PASS="${KOMARI_PASS:-change-me}"

log "target settings"
printf 'INSTALL_DIR=%s\n' "$INSTALL_DIR"
printf 'UNLOCK_PROBE_PORT=%s\n' "$PORT"
printf 'KOMARI_BASE=%s\n' "$KOMARI_BASE"
printf 'KOMARI_USER=%s\n' "$KOMARI_USER"
printf 'KOMARI_PASS=%s\n' "***"
printf 'DOWNLOAD_URL=%s\n' "$DOWNLOAD_URL"

mkdir -p "$INSTALL_DIR"
TMP_TAR="$(mktemp /tmp/komari-unlock-probe.XXXXXX.tar.gz)"
trap 'rm -f "$TMP_TAR"' EXIT

log "download release asset"
curl -fL "$DOWNLOAD_URL" -o "$TMP_TAR"

log "extract bundle"
tar -xzf "$TMP_TAR" -C "$INSTALL_DIR"

log "prepare env"
ENV_FILE="$INSTALL_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  echo ".env already exists, leaving it unchanged: $ENV_FILE"
else
  cat > "$ENV_FILE" <<EOT
KOMARI_BASE=$KOMARI_BASE
KOMARI_USER=$KOMARI_USER
KOMARI_PASS=$KOMARI_PASS
UNLOCK_PROBE_PORT=$PORT
EOT
  chmod 600 "$ENV_FILE" || true
  echo "Wrote $ENV_FILE"
fi

log "docker compose up"
(
  cd "$INSTALL_DIR"
  $COMPOSE_CMD up -d
)

log "health check hint"
printf 'Local health URL: http://127.0.0.1:%s/healthz\n' "$PORT"
printf 'Status URL:       http://127.0.0.1:%s/status\n' "$PORT"

log "nginx reverse proxy example"
printf 'See: %s\n' "$INSTALL_DIR/docs/nginx-example.conf"
printf 'Typical route: /unlock-probe/ -> http://127.0.0.1:%s/\n' "$PORT"

log "common commands"
printf 'cd %s && %s ps\n' "$INSTALL_DIR" "$COMPOSE_CMD"
printf 'cd %s && %s logs -f unlock-probe\n' "$INSTALL_DIR" "$COMPOSE_CMD"
printf 'cd %s && %s restart unlock-probe\n' "$INSTALL_DIR" "$COMPOSE_CMD"

if [ "$KOMARI_PASS" = "change-me" ]; then
  printf '\nWARNING: You are still using the placeholder password change-me. Edit %s before production use.\n' "$ENV_FILE"
fi

echo
printf 'Done. unlock-probe bundle installed under: %s\n' "$INSTALL_DIR"
