#!/usr/bin/env bash
# Loads the database dump and photo archive made by scripts/export-data.ps1.
#
#   bash deploy/import-data.sh ~/deploy-export
#
# REPLACES the server's database with the dump. Meant for a fresh install,
# before anyone has signed up there. The stack must have been started once
# (`docker compose up -d --build`) so the images exist.
set -euo pipefail

src="${1:?usage: import-data.sh <folder containing sabtou.dump and media.tgz>}"
# `pwd -W` exists only in Git Bash on Windows, where Docker needs C:/… paths;
# on Linux it fails and plain `pwd` answers.
src="$(cd "$src" && { pwd -W 2>/dev/null || pwd; })"
for file in sabtou.dump media.tgz; do
  [ -f "$src/$file" ] || { echo "missing $src/$file" >&2; exit 1; }
done

cd "$(dirname "$0")"
compose() { docker compose -f docker-compose.prod.yml "$@"; }

echo "==> Stopping the application (the database stays up)"
compose up -d --wait postgres redis
compose stop caddy frontend worker api

echo "==> Restoring the database"
compose cp "$src/sabtou.dump" postgres:/tmp/sabtou.dump
# --clean drops what the fresh install created (empty tables, seeded
# categories) before recreating everything from the dump; --no-owner lets the
# server's database user own objects the local `lf` user owned.
# Single quotes on purpose: the variables belong to the container, not this shell.
# shellcheck disable=SC2016
compose exec -T postgres sh -c '
  pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/sabtou.dump
  status=$?
  rm -f /tmp/sabtou.dump
  exit $status'

echo "==> Restoring photos"
# Runs as the API image's own user, so the files end up owned the way the API
# expects to read and delete them.
compose run --rm --no-deps -v "$src:/import:ro" --entrypoint sh api \
  -c 'tar xzf /import/media.tgz -C /app/media'

echo "==> Starting everything"
compose up -d
echo "Done. Existing accounts keep their passwords."
