#!/usr/bin/env bash
set -euo pipefail

# Configuration
REMOTE_HOST="yandex"
REMOTE_DIR="~/diplomka"
REPO_URL="https://github.com/w0nsdoof/diplomka.git"
COMPOSE_FILE="podman-compose.yml"

# Determine branch: use argument or current local branch
BRANCH="${1:-$(git branch --show-current)}"

echo "==> Deploying branch '$BRANCH' to $REMOTE_HOST"

# Step 1: Ensure remote has a git clone (first-time setup)
ssh "$REMOTE_HOST" bash <<SETUP
  if [ ! -d "$REMOTE_DIR/.git" ]; then
    echo "--- First-time setup: cloning repo"
    # Preserve .env if it exists
    if [ -f "$REMOTE_DIR/.env" ]; then
      cp "$REMOTE_DIR/.env" /tmp/.env.backup
    fi
    rm -rf "$REMOTE_DIR"
    git clone "$REPO_URL" "$REMOTE_DIR"
    # Restore .env
    if [ -f /tmp/.env.backup ]; then
      mv /tmp/.env.backup "$REMOTE_DIR/.env"
      echo "--- Restored .env"
    fi
  fi
SETUP

# Step 2: Pull latest code
echo "==> Pulling latest code"
ssh "$REMOTE_HOST" bash <<PULL
  cd "$REMOTE_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  echo "--- On commit: \$(git log --oneline -1)"
PULL

# Step 3: Rebuild and restart
echo "==> Rebuilding and restarting containers"
ssh "$REMOTE_HOST" bash <<DEPLOY
  cd "$REMOTE_DIR"
  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
  docker compose -f "$COMPOSE_FILE" build
  docker compose -f "$COMPOSE_FILE" up -d
  echo "--- Waiting for backend to become healthy..."
  timeout 60 bash -c 'until docker inspect taskmanager-backend --format="{{.State.Health.Status}}" 2>/dev/null | grep -q healthy; do sleep 3; done' \
    && echo "--- Backend is healthy" \
    || echo "--- WARNING: Backend did not become healthy in 60s"
  echo "--- Container status:"
  docker compose -f "$COMPOSE_FILE" ps
DEPLOY

echo "==> Deploy complete!"
