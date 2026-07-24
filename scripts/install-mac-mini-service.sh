#!/usr/bin/env bash
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
HOST="${LEARNING_HUB_HOST:-b@100.109.41.60}"
SSH_KEY="${LEARNING_HUB_SSH_KEY:-$HOME/.ssh/id_ed25519_personal}"
LABEL="com.brianmills.learning-hub"
LEGACY_LABEL="com.brianmills.learning-environment-pilot"
PLIST="/Users/b/Library/LaunchAgents/$LABEL.plist"

ssh -i "$SSH_KEY" "$HOST" "mkdir -p /Users/b/Library/LaunchAgents /Users/b/Library/Logs /Users/b/Sites/learning-environment-pilot"
scp -i "$SSH_KEY" "$ROOT/ops/mac-mini/$LABEL.plist" "$HOST:$PLIST"
ssh -i "$SSH_KEY" "$HOST" "launchctl bootout gui/\$(id -u)/$LEGACY_LABEL 2>/dev/null || true; launchctl bootout gui/\$(id -u)/$LABEL 2>/dev/null || true; launchctl bootstrap gui/\$(id -u) '$PLIST'; launchctl kickstart -k gui/\$(id -u)/$LABEL"

printf 'Installed %s on %s\n' "$LABEL" "$HOST"
