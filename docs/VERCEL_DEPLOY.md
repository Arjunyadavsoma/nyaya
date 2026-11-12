# Deploying Nyaya to Vercel (production)

`main` is deploy-ready (verified with a clean-clone build: compiled, 16/16
static pages, 60 routes). This is the one-time setup.

## 1. Connect the repo (one time, ~2 minutes)

1. Go to **vercel.com → Add New → Project**
2. Import the GitHub repo **Arjunyadavsoma/nyaya**
3. Vercel reads `vercel.json` automatically (framework: Next.js, region
   `bom1` for India, build: `prisma generate && next build`)
4. **Before clicking Deploy**, add the environment variables (below)
5. Deploy. Every future push to `main` auto-deploys.

## 2. Database — choose one

### Option A — Turso (recommended, free tier, persistent)
1. `turso db create nyaya` → then `turso db show nyaya --url` and
   `turso db tokens create nyaya`
2. Populate it from the local DB (rehearsed, see `scripts/rehearse-turso.sh`):
   `turso db create nyaya --from-file prisma/db/custom.db`
3. Set in Vercel:
   - `TURSO_DATABASE_URL=libsql://nyaya-<org>.turso.io`
   - `TURSO_AUTH_TOKEN=<token>`

### Option B — bundled SQLite (demo only, NOT production)
On serverless, files are ephemeral: data resets on cold starts and document
uploads only live in `/tmp`. Set:
- `DATABASE_URL=file:/tmp/nyaya/db.sqlite`
The first request bootstraps nothing — run `prisma migrate deploy` once with
`DATABASE_URL` pointed at a Turso DB, or seed locally and use Option A.

**Do not use Option B for anything real.**

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Required:
| Key | Value |
|---|---|
| `DATABASE_URL` | `file:/tmp/nyaya/db.sqlite` (demo) — or omit when Turso vars are set |
| `GROQ_API_KEY` | your Groq key (console.groq.com/keys) |

Optional:
| Key | Purpose |
|---|---|
| `GROQ_API_KEY_2`, `GROQ_API_KEYS` | extra free-tier keys for the KeyPool |
| `SEARXNG_URL` | self-hosted metasearch for research (`docker run -d -p 8888:8080 searxng/searxng`) |
| `OLLAMA_BASE_URL` | local Ollama fallback provider |
| `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` |
| `DOC_STORAGE_DIR` | override document storage (defaults to `/tmp/nyaya-documents` on Vercel) |

## 4. Post-deploy checklist

1. `curl https://<app>.vercel.app/api/v1/health` → `{"status":"ok",...,"checks":{"db":true}}`
2. Live Groq smoke (from any machine with egress):
   `GROQ_SMOKE=1 GROQ_API_KEY=... bun run scripts/groq-smoke.ts`
3. Provision the first admin (needs a Turso/DB):
   `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... bun run src/lib/seed/provision-admin.ts`
4. Seed the legal-aid directory: `bun run scripts/seed-legal-aid.ts` (idempotent)

## 5. Runtime notes on serverless

- Uploaded documents are stored per-instance in `/tmp` — for durable
  storage, add an S3/R2 adapter at `src/lib/documents/processing.ts`
  (the interface is 4 functions: save/read/delete + root).
- `/api/*` routes are `force-dynamic` (never cached, DB-backed).
- Static pages (landing, workflows, info) are prerendered at build.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails `DATABASE_URL` | set it (Option B value) or the Turso pair |
| 500 on DB routes | check Turso vars; run `prisma migrate deploy` against Turso once |
| AI answers say "unavailable" | `GROQ_API_KEY` missing/invalid in Vercel env |
| Research without sources | optional `SEARXNG_URL` not set (official-source direct fetch still works) |
