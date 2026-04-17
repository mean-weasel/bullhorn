#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Bullhorn Self-Hosted Supabase Setup ==="

# Clone official Supabase Docker setup if not present
if [ ! -d "supabase-docker" ]; then
  echo "Cloning Supabase Docker setup..."
  git clone --depth 1 https://github.com/supabase/supabase.git supabase-docker
else
  echo "Supabase Docker setup already cloned."
fi

# Copy Docker Compose and env if not already present
if [ ! -f "docker-compose.yml" ]; then
  cp supabase-docker/docker/docker-compose.yml docker-compose.yml
  echo "Copied docker-compose.yml"
fi

if [ ! -f ".env" ]; then
  cp supabase-docker/docker/.env.example .env
  echo "Copied .env — EDIT THIS FILE with your secrets!"
  echo ""
  echo "  Generate secrets with: openssl rand -base64 32"
  echo "  Generate JWT keys at: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys"
else
  echo ".env already exists."
fi

# Copy volumes directory if not present
if [ ! -d "volumes" ]; then
  cp -r supabase-docker/docker/volumes volumes
  echo "Copied volumes directory"
fi

echo ""
echo "Next steps:"
echo "  1. Edit self-hosted/.env with generated secrets"
echo "  2. Optionally remove unused services from docker-compose.yml:"
echo "     - realtime, imgproxy, edge-runtime, logflare, vector"
echo "  3. Run: docker compose up -d"
echo ""
echo "Supabase will be available at:"
echo "  API:    http://localhost:8000"
echo "  Studio: http://localhost:3001"
