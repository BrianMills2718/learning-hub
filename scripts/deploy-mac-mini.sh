#!/usr/bin/env bash
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
CODE_ROOT="$(CDPATH= cd -- "$ROOT/.." && pwd)"
HOST="${LEARNING_HUB_HOST:-b@100.109.41.60}"
REMOTE_ROOT="${LEARNING_HUB_REMOTE_ROOT:-/Users/b/Sites/learning-environment-pilot}"
STAGING_ROOT="${REMOTE_ROOT}-next"
PREVIOUS_ROOT="${REMOTE_ROOT}-previous"
SSH_KEY="${LEARNING_HUB_SSH_KEY:-$HOME/.ssh/id_ed25519_personal}"

verify_and_build_app() {
  local directory="$1"
  (cd "$CODE_ROOT/$directory" && npm run check)
}

verify_and_build_app godel-concept-ladder
verify_and_build_app learning-map-ladder
verify_and_build_app second-brain-ladder
verify_and_build_app category-ladder
verify_and_build_app claude-ladder

ssh -i "$SSH_KEY" "$HOST" "rm -rf '$STAGING_ROOT'; mkdir -p '$STAGING_ROOT/godel' '$STAGING_ROOT/learning-map' '$STAGING_ROOT/second-brain' '$STAGING_ROOT/category' '$STAGING_ROOT/claude'"
scp -i "$SSH_KEY" "$ROOT/index.html" "$ROOT/styles.css" "$ROOT/app.js" "$HOST:$STAGING_ROOT/"
scp -i "$SSH_KEY" -r "$CODE_ROOT/godel-concept-ladder/dist/." "$HOST:$STAGING_ROOT/godel/"
scp -i "$SSH_KEY" -r "$CODE_ROOT/learning-map-ladder/dist/." "$HOST:$STAGING_ROOT/learning-map/"
scp -i "$SSH_KEY" -r "$CODE_ROOT/second-brain-ladder/dist/." "$HOST:$STAGING_ROOT/second-brain/"
scp -i "$SSH_KEY" -r "$CODE_ROOT/category-ladder/dist/." "$HOST:$STAGING_ROOT/category/"
scp -i "$SSH_KEY" -r "$CODE_ROOT/claude-ladder/dist/." "$HOST:$STAGING_ROOT/claude/"
ssh -i "$SSH_KEY" "$HOST" "rm -rf '$PREVIOUS_ROOT'; test ! -e '$REMOTE_ROOT' || mv '$REMOTE_ROOT' '$PREVIOUS_ROOT'; mv '$STAGING_ROOT' '$REMOTE_ROOT'"

printf 'Deployed Learning Hub to %s\n' "$HOST"
