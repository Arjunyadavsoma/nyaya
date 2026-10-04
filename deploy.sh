#!/bin/bash
# Nyaya — One-click deployment script
# Run this on your local machine (NOT in the sandbox)
#
# Prerequisites:
#   1. GitHub account
#   2. Vercel account (https://vercel.com)
#   3. Turso account (https://turso.tech)
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh

set -e

echo "🚀 Nyaya Deployment Script"
echo "=========================="
echo ""

# Step 1: GitHub
echo "📦 Step 1: Push to GitHub"
echo "-------------------------"
if ! command -v gh &> /dev/null; then
  echo "Installing GitHub CLI..."
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update && sudo apt install gh -y
fi

if ! gh auth status &> /dev/null; then
  echo "Please login to GitHub:"
  gh auth login
fi

REPO_NAME="nyaya"
if gh repo view $REPO_NAME &> /dev/null; then
  echo "Repo $REPO_NAME already exists. Pushing..."
  git remote add origin "https://github.com/$(gh api user --jq .login)/$REPO_NAME.git" 2>/dev/null || true
  git push -u origin main
else
  echo "Creating GitHub repo: $REPO_NAME"
  gh repo create $REPO_NAME --public --source=. --push
fi
echo "✅ Code pushed to GitHub"
echo ""

# Step 2: Turso
echo "🗄️  Step 2: Create Turso Database"
echo "----------------------------------"
if ! command -v turso &> /dev/null; then
  echo "Installing Turso CLI..."
  curl -sSfL https://get.tur.so/install.sh | bash
  export PATH="$HOME/.turso:$PATH"
fi

if ! turso auth whoami &> /dev/null; then
  echo "Please login to Turso:"
  turso auth login
fi

echo "Creating Turso database: nyaya"
turso db create nyaya 2>/dev/null || echo "Database may already exist"

TURSO_URL=$(turso db show nyaya --url)
TURSO_TOKEN=$(turso db tokens create nyaya)
echo "✅ Turso database created"
echo "   URL: $TURSO_URL"
echo ""

# Step 3: Apply schema + seed
echo "🌱 Step 3: Apply Schema + Seed Data"
echo "------------------------------------"
export TURSO_DATABASE_URL="$TURSO_URL"
export TURSO_AUTH_TOKEN="$TURSO_TOKEN"
export DATABASE_URL="${TURSO_URL}?authToken=${TURSO_TOKEN}"

echo "Applying Prisma schema..."
bun run db:push

echo "Seeding rights articles, playbooks, judges, helplines, templates..."
bun run src/lib/seed/run.ts

echo "Importing 16,459 police stations (this takes ~2 minutes)..."
bun run src/lib/seed/import-police.ts

echo "Importing 26,687 Supreme Court judgments (this takes ~1 minute)..."
bun run src/lib/seed/import-sc-judgments.ts

echo "✅ Database seeded"
echo ""

# Step 4: Deploy to Vercel
echo "▲ Step 4: Deploy to Vercel"
echo "--------------------------"
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel
fi

if ! vercel whoami &> /dev/null; then
  echo "Please login to Vercel:"
  vercel login
fi

echo "Deploying to Vercel (production)..."
vercel --prod --yes

echo ""
echo "Setting environment variables..."
DEPLOYMENT_URL=$(vercel ls --yes 2>/dev/null | head -5 | grep "https://" | awk '{print $2}')
vercel env add TURSO_DATABASE_URL production <<< "$TURSO_URL"
vercel env add TURSO_AUTH_TOKEN production <<< "$TURSO_TOKEN"
vercel env add GROQ_API_KEY_1 production <<< "YOUR_GROQ_API_KEY"
vercel env add GROQ_MODEL_PRIMARY production <<< "llama-3.3-70b-versatile"
vercel env add GROQ_MODEL_FAST production <<< "llama-3.1-8b-instant"
vercel env add NYAYA_USE_ZAI_FALLBACK production <<< "true"

echo "Re-deploying with env vars..."
vercel --prod --yes

echo ""
echo "=============================="
echo "🎉 Nyaya is LIVE!"
echo "=============================="
echo ""
echo "Your app is deployed at: $(vercel ls --yes 2>/dev/null | grep "https://" | head -1 | awk '{print $2}')"
echo ""
echo "Next steps:"
echo "  1. Visit your deployment URL"
echo "  2. Test the chat: ask 'What are my rights if arrested?'"
echo "  3. Test emergency: type 'I crashed into a car'"
echo "  4. Test /nearby (16,459 police stations)"
echo "  5. Test /judgments (26,687 SC judgments)"
echo ""
