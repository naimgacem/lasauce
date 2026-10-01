# Packs the LOCAL database and photos so a server can start with the same
# content — every report, account, match and photo you have now.
#
#   powershell -File scripts/export-data.ps1
#
# Writes deploy-export/sabtou.dump and deploy-export/media.tgz (git-ignored:
# the dump holds every user's email and password hash). The local stack must
# be running (`docker compose up -d`). Load them on the server with
# deploy/import-data.sh — see deploy/README.md.

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root "deploy-export"
New-Item -ItemType Directory -Force $out | Out-Null

Push-Location $root
try {
    Write-Host "Dumping the database..." -ForegroundColor Cyan
    # Written inside the container and copied out, never piped: PowerShell 5.1's
    # `>` re-encodes a program's output as text, which corrupts a binary dump.
    docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges --file=/tmp/sabtou.dump'
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed - is the local stack running? (docker compose up -d)" }
    docker compose cp postgres:/tmp/sabtou.dump (Join-Path $out "sabtou.dump")
    docker compose exec -T postgres rm /tmp/sabtou.dump

    Write-Host "Archiving photos..." -ForegroundColor Cyan
    # `--volumes-from` reaches the photo volume through the API container, so
    # this works whatever Compose named the volume.
    $api = docker compose ps -q api
    if (-not $api) { throw "The api container is not running (docker compose up -d)." }
    docker run --rm --volumes-from $api -v "${out}:/out" alpine tar czf /out/media.tgz -C /app/media .
    if ($LASTEXITCODE -ne 0) { throw "Archiving photos failed." }
} finally {
    Pop-Location
}

Get-ChildItem $out | ForEach-Object {
    "{0,-12} {1,8:N1} MB" -f $_.Name, ($_.Length / 1MB)
}
Write-Host "`nDone. Copy the deploy-export folder to the server (see deploy/README.md)." -ForegroundColor Green
