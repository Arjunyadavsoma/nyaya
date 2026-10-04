# Deploying Nyaya to Vercel (Free Tier)

This guide walks you through deploying Nyaya to Vercel with a free Turso cloud database.

## Why Turso?
- Vercel's serverless functions don't have persistent filesystem access, so local SQLite won't work in production.
- **Turso** is SQLite over HTTP — free tier includes 500 databases, 9GB storage, 1 billion row reads/month.
- Prisma supports it natively via `@prisma/adapter-libsql`.
- No schema changes needed (it's SQLite-compatible).

## Prerequisites
1. A [Vercel account](https://vercel.com) (free)
2. A [Turso account](https://turso.tech) (free)
3. A [GitHub account](https://github.com) (free)
4. The Groq API key (already configured in `.env`)

## Step 1: Push to GitHub

```bash
cd /home/z/my-project

# Initialize git repo (if not already done)
git init
git add -A
git commit -m "Nyaya — production-ready PWA for Indian legal information"

# Create a GitHub repo and push
# Option A: Using GitHub CLI
gh repo create nyaya --public --source=. --push

# Option B: Manual
# 1. Go to github.com/new — create a repo named "nyaya"
# 2. Run:
git remote add origin https://github.com/YOUR_USERNAME/nyaya.git
git branch -M main
git push -u origin main
```

## Step 2: Create a Turso Database (Free)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login (opens browser)
turso auth login

# Create a database
turso db create nyaya

# Get the database URL
turso db show nyaya --url
# → libsql://nyaya-YOUR-USERNAME.turso.io

# Create an auth token
turso db tokens create nyaya
# → YOUR_TURSO_TOKEN_HERE

# Apply the Prisma schema to Turso
# (Turso uses the same SQLite schema — no changes needed)
turso db shell nyaya < prisma/migrations/init.sql
# OR use prisma db push with the Turso URL:
TURSO_DATABASE_URL="libsql://nyaya-YOUR-USERNAME.turso.io" \
TURSO_AUTH_TOKEN="YOUR_TOKEN" \
DATABASE_URL="libsql://nyaya-YOUR-USERNAME.turso.io?authToken=YOUR_TOKEN" \
bun run db:push
```

## Step 3: Seed the Turso Database

The app has 16,459 police stations + 26,687 SC judgments + 41 rights articles + 8 playbooks + 15 judges. Run the seed scripts against Turso:

```bash
# Set Turso env vars
export TURSO_DATABASE_URL="libsql://nyaya-YOUR-USERNAME.turso.io"
export TURSO_AUTH_TOKEN="YOUR_TOKEN"
export DATABASE_URL="libsql://nyaya-YOUR-USERNAME.turso.io?authToken=YOUR_TOKEN"

# Seed rights articles, playbooks, judges, helplines, templates, glossary
bun run src/lib/seed/run.ts

# Import 16,459 police stations from Govt of India GeoJSON
bun run src/lib/seed/import-police.ts

# Import 26,687 Supreme Court judgments
bun run src/lib/seed/import-sc-judgments.ts
```

## Step 4: Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo: `nyaya`
3. Vercel auto-detects Next.js — no build config needed
4. Add environment variables (see below)
5. Click **Deploy**

### Option B: Via Vercel CLI

```bash
cd /home/z/my-project

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

## Step 5: Set Environment Variables on Vercel

In the Vercel dashboard → Settings → Environment Variables, add:

| Key | Value | Notes |
|-----|-------|-------|
| `TURSO_DATABASE_URL` | `libsql://nyaya-YOUR-USERNAME.turso.io` | From Step 2 |
| `TURSO_AUTH_TOKEN` | `YOUR_TURSO_TOKEN_HERE
| `GROQ_API_KEY_1` | `YOUR_GROQ_API_KEY_HERE` | Your Groq key |
| `GROQ_MODEL_PRIMARY` | `llama-3.3-70b-versatile` | |
| `GROQ_MODEL_FAST` | `llama-3.1-8b-instant` | |
| `NYAYA_USE_ZAI_FALLBACK` | `true` | Fallback if Groq fails |

## Step 6: Verify

After deployment:
- Visit `https://nyaya.vercel.app` (or your custom domain)
- Test the chat: ask "What are my rights if I'm arrested?"
- Test emergency: type "I crashed into a car" → should get the Road Accident playbook
- Test /nearby → should show 16,459 police stations
- Test /judgments → should show 26,687 SC judgments

## Free Tier Limits

| Service | Free Tier | Nyaya Usage |
|---------|-----------|------------|
| **Vercel** (Hobby) | 100 GB bandwidth, unlimited deploys | Well within limits |
| **Turso** (Free) | 9 GB storage, 1B reads/month | ~50 MB DB, well within |
| **Groq** (Free) | 30 req/min, 1K req/day per model | May hit limits under heavy use |
| **z-ai-web-dev-sdk** | Unlimited (sandbox) | Fallback when Groq exhausted |

## Troubleshooting

### Build fails with Prisma error
Ensure `prisma generate` runs before `next build` — already configured in `vercel.json`.

### Database connection fails
Check that `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in Vercel env vars.

### Chat returns errors
Check Vercel function logs. If Groq returns 403, the KeyPool will fall back to z-ai automatically.

### Map doesn't load
Leaflet loads tiles from OpenStreetMap — no API key needed. If it fails, check network connectivity.

## Custom Domain (Optional)

In Vercel dashboard → Settings → Domains:
1. Add your domain (e.g., `nyaya.in`)
2. Add the DNS records Vercel shows you
3. SSL is automatic

---
Nyaya is now live — free legal information for every Indian. 🇮🇳
