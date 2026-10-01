# Putting sabtou online — for free

The whole platform (website, API, AI matching worker, database, photos) runs
on **one Linux server** with Docker, exactly as it runs on your PC. Caddy sits
in front and gets a free HTTPS certificate automatically. Nothing is migrated
and nothing is rewritten.

| Option | Cost | Needs | Online |
|--------|------|-------|--------|
| **A. Oracle Cloud Always Free** (recommended) | Free, no time limit | A bank card to verify your identity (not charged) | 24/7 |
| **B. Azure for Students** | Free, from a $100 student credit (~3 months) | A university email, no card | 24/7 while the credit lasts |
| **C. Your own PC + Cloudflare tunnel** | Free | Nothing | Only while your PC is on |

Why not a "free app host" like Render, Railway or Vercel? The AI worker needs
about 1.5 GB of memory to hold its two models; free app plans give 512 MB and
put the app to sleep after 15 minutes. A free virtual machine has no such limits.

---

## Option A — Oracle Cloud Always Free (recommended)

Free forever: an ARM machine with 2 CPUs and 12 GB of memory, about four times
what this stack needs.

### 1. Create the server

1. Sign up at <https://www.oracle.com/cloud/free/>. Pick a **home region** in
   Europe close to Algeria — **Marseille** or **Paris** (it cannot be changed later).
2. **Compute → Instances → Create instance**:
   - **Image**: Canonical Ubuntu 24.04.
   - **Shape**: Ampere → `VM.Standard.A1.Flex`, **2 OCPUs, 12 GB memory**.
   - **Networking**: keep the defaults, with "Assign a public IPv4 address" on.
   - **SSH keys**: "Generate a key pair" and **download the private key**.
   - Create. If you get *"Out of capacity"*, pick another availability domain
     or try again an hour later — free ARM capacity comes and goes.
3. Open the web ports: on the instance page, open its **Subnet → Security List →
   Add Ingress Rules**, source `0.0.0.0/0`, TCP, destination port `80`. Repeat
   for port `443`.
4. Note the instance's **Public IP address**.

### 2. Connect and prepare it

From PowerShell on your PC (use the key file you downloaded):

```powershell
ssh -i C:\path\to\ssh-key.key ubuntu@YOUR_SERVER_IP
```

Then, on the server:

```bash
git clone https://github.com/naimgacem/lasauce.git sabtou
cd sabtou
bash deploy/setup-server.sh
exit
```

(If the repository is private, GitHub asks for your username and a
**personal access token** — create one at GitHub → Settings → Developer
settings → Personal access tokens, with read access to the repository.)

Log back in with the same `ssh` command — that is what lets you run `docker`
without `sudo`.

### 3. Configure and start

```bash
cd ~/sabtou/deploy
cp .env.example .env
# Generates the two secrets and a free HTTPS hostname from the server's IP:
sed -i \
  -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" \
  -e "s/^JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$(openssl rand -hex 32)/" \
  -e "s/^DOMAIN=.*/DOMAIN=$(curl -s https://api.ipify.org | tr . -).sslip.io/" \
  .env
grep DOMAIN .env        # your site's address, e.g. 141-147-20-5.sslip.io

docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes **15–25 minutes** (the AI libraries are large). When
`docker compose -f docker-compose.prod.yml ps` shows every service running,
open `https://YOUR-DOMAIN` in a browser.

The AI worker downloads its models (~470 MB) the first time it starts, so the
first reports take a few extra minutes to get matched.

### 4. Create your admin account

```bash
docker compose -f docker-compose.prod.yml exec api \
    python -m app.db.create_admin you@example.com --create --name "Your Name"
```

It asks for a password. Sign in on the site, then **Admin console** is in the
account menu.

### 5. (Optional) Bring your current reports, accounts and photos

Starting empty is fine — but to present with the content you already have:

1. On your PC, with the local stack running (`docker compose up -d`):
   ```powershell
   powershell -File scripts/export-data.ps1
   scp -i C:\path\to\ssh-key.key -r deploy-export ubuntu@YOUR_SERVER_IP:~/
   ```
2. On the server:
   ```bash
   bash ~/sabtou/deploy/import-data.sh ~/deploy-export
   ```

This **replaces** the server's database, so do it before anyone signs up
there. Every existing account keeps its password, including your local admin.

### Keeping it running past a week

Oracle may reclaim a free machine that sits almost idle (CPU, network *and*
memory all under 20%) for seven days. For a presentation that is irrelevant;
to keep the site up long-term, upgrade the account to **Pay As You Go** —
Always Free resources stay free, and only usage beyond them would be billed.

---

## Option B — Azure for Students (no bank card)

1. Activate the free credit at <https://azure.microsoft.com/free/students> with
   your university email.
2. **Create a virtual machine**:
   - **Region**: France Central (or West Europe).
   - **Image**: Ubuntu Server 24.04 LTS — x64.
   - **Size**: `Standard_B2s` (2 vCPUs, 4 GB) — about $30–40 a month of the credit.
   - **Authentication**: SSH public key; download the key it generates.
   - **Inbound ports**: allow **SSH (22), HTTP (80), HTTPS (443)**.
   - On the Networking tab, make the public IP **Static**, so the address —
     and therefore your site's hostname — survives a restart.
3. Continue with **Option A from step 2**, connecting as `azureuser` instead of
   `ubuntu`.

To save credit between demos, **Stop** the VM from the portal and start it
again before presenting; everything comes back on its own.

---

## Option C — your own PC, today, in two minutes

No account and no server: the site is public for as long as your PC runs it.
With the app running locally on port 3000 (`cd frontend; npm run dev`, plus
`docker compose up -d` for the backend):

```powershell
winget install --id Cloudflare.cloudflared -e     # once
powershell -File scripts/share.ps1
```

It prints a `https://….trycloudflare.com` link. The link changes every time,
and dies when you close the window — a good backup for presentation day, not
a home for the site.

---

## Day-to-day

Run these in `~/sabtou/deploy` on the server.

| Task | Command |
|------|---------|
| Status | `docker compose -f docker-compose.prod.yml ps` |
| Logs (e.g. the AI worker) | `docker compose -f docker-compose.prod.yml logs -f worker` |
| Deploy new code | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Stop / start | `docker compose -f docker-compose.prod.yml stop` / `... up -d` |
| Back up the database | `docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > backup-$(date +%F).dump` |

Everything restarts by itself after a server reboot. Database, photos, model
weights and certificates live in Docker volumes and survive rebuilds —
`docker compose down -v` is the one command that deletes them.

## Going further (when there is a budget)

- **Your own domain** (e.g. `sabtou.dz` or a `.com`): point an A record at the
  server's IP, set `DOMAIN=` in `deploy/.env`, and run `up -d` again — Caddy
  fetches the new certificate itself.
- **Real payments**: once the Chargily account is live, set
  `PAYMENT_PROVIDER=chargily`, `CHARGILY_SECRET_KEY`, the live `CHARGILY_API_BASE`
  and `APP_ENV=production`, then register `https://YOUR-DOMAIN/api/v1/billing/webhook`
  in the Chargily dashboard.
- **Email** (password reset links): not sent yet — the API only logs them.
  Needs an SMTP provider and the SMTP backend in `backend/app/core/email.py`.
