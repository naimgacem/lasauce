# Opens a public HTTPS URL to the local app, for testing with someone who isn't
# on your network.
#
# Quick tunnels are anonymous and disposable: every run mints a NEW random
# hostname, and the old one dies the moment this window closes. That is the
# whole trade — no account, no DNS, no router config, but nothing is permanent.
#
#   powershell -File scripts/share.ps1
#
# Only port 3000 is exposed. The browser reaches the API and photos through the
# /api/v1/* and /media/* proxies in frontend/next.config.mjs, so the backend on
# :8000 stays private and no hostname is baked into the bundle.
#
# Leave this window OPEN — closing it kills the link. Ctrl+C to stop.

$ErrorActionPreference = "Stop"

$exe = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $exe) { $exe = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
if (-not (Test-Path $exe)) {
    Write-Host "cloudflared not found. Install it with:" -ForegroundColor Red
    Write-Host "  winget install --id Cloudflare.cloudflared -e"
    exit 1
}

# The tunnel forwards blindly: without the app up, your friend gets 502s that
# look like the link is broken. Fail here instead, where the cause is obvious.
try {
    Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {
    Write-Host "Nothing is serving http://localhost:3000." -ForegroundColor Red
    Write-Host "Start the app first:  cd frontend; npm run dev"
    Write-Host "...and the backend:   docker compose up -d"
    exit 1
}

Write-Host "Requesting a public URL (this takes a few seconds)..." -ForegroundColor Cyan
Write-Host "Share the https://...trycloudflare.com link it prints below.`n"

& $exe tunnel --url http://localhost:3000 --no-autoupdate
