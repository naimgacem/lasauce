# 07 — Admin console

The operator's side of the platform: `/{locale}/admin` in the web app, backed by
`/api/v1/admin/*`. Available in French, Arabic and English.

| Page | What it is for |
|------|----------------|
| **Overview** | Headline figures, new reports per day (30 days), AI pipeline health with a retry button, match quality, community figures, latest admin actions. |
| **Users** | Search accounts; suspend or reactivate, change role, verify an email, grant match unlocks. |
| **Reports** | Every report, closed ones included. Close with a reason, reopen, re-run AI processing, remove a photo. See its suggestions and claims in full. |
| **Matches** | Every suggestion with its raw scores and the owners' verdicts. Withdraw a bad one. |
| **Payments** | Every checkout and the gateway's raw payload. Read-only. |
| **Activity log** | Every change made from the console: who, what, when, why. |

## Getting access

The console promotes people, but the first administrator has to come from the
server itself:

```bash
# Promote an existing account (sign up in the app first)
docker compose exec api python -m app.db.create_admin you@example.com

# Or create the account outright; the password comes from ADMIN_PASSWORD or a prompt
docker compose exec -e ADMIN_PASSWORD='…' api \
    python -m app.db.create_admin you@example.com --create --name "Your Name"
```

The command is idempotent and writes an audit entry attributed to `cli`. Once
signed in, an administrator reaches the console from the account menu
(**Admin console**) and can promote others from **Users**.

## Rules the console enforces

These are enforced by the API, not just the interface.

- **Every change is recorded with the change.** The audit row is written in the
  same database transaction as the action, so a change without a record cannot
  exist. Entries are never edited or deleted.
- **A reason is required where someone else is affected**: suspending an
  account, changing a role, closing a report, granting unlocks. Reasons are
  internal — users are notified that something happened, never shown the note.
- **Nobody changes their own role or status.** This is what keeps the platform
  from locking itself out, and it guarantees at least one active administrator
  always remains.
- **Administrators undo administrator decisions, not the reporter's.** A report
  a moderator closed (`removed`, `duplicate`, `expired`) can be reopened; one the
  reporter closed (`withdrawn`, `recovered`) cannot.
- **Money is not moved from here.** Payments are settled only by the gateway's
  signed webhook. If a customer is owed something, grant them unlocks — the grant
  is recorded in their credit ledger with its note.

## What each action does to people

| Action | Effect | Who is notified |
|--------|--------|-----------------|
| Suspend | Signed out on every device immediately; cannot sign in. Reports stay public. | — |
| Reactivate | Can sign in again. | — |
| Change role | Grants or removes console access. | — |
| Verify email | Marks the address verified. | — |
| Grant unlocks | Adds 1–100 unlocks to the balance (never expire). | The user |
| Close report | Leaves search; live suggestions withdrawn; pending claims declined. | Reporter and claimants |
| Reopen report | Back in search with its previous status and the suggestions the close withdrew; re-matched against newer reports. | Reporter |
| Re-run AI | Re-analyses and re-matches the report. | — |
| Remove photo | Deleted from the report and storage; report re-matched. | — |
| Withdraw suggestion | Both owners stop seeing it. Not counted as an engine error when tuning. | — |

## Known limits

- The public item endpoints (`PATCH`/`DELETE /items/{id}`) still accept an
  administrator's token on someone else's report, as they did before the
  console existed, and those calls are not audited. The interface never uses
  that path — moderation goes through `/admin` — but the API allows it.
- The overview's figures are computed on each load (refreshed every minute).
  That is instant at the current scale; it would want caching at hundreds of
  thousands of reports.

## Development

- Backend: `app/services/admin/` (one module per area), `app/api/v1/endpoints/admin.py`,
  migration `0009`. Tests: `tests/test_admin_routes.py` (access rules, no database)
  and `tests/test_admin_integration.py` (needs `TEST_DATABASE_URL`, see `tests/conftest.py`).
- Frontend: `src/features/admin/` (views, components, hooks), routes under
  `src/app/[locale]/admin/`, strings under the `admin` namespace of each
  `messages/*.json`. With `NEXT_PUBLIC_USE_MOCKS=true` the console runs on
  in-memory data.
