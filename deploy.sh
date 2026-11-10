#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Only develop/main may ever be deployed to production (see CLAUDE.md).
# This is the single shared deploy path — enforce it here, not just in docs,
# so a stray feature-branch checkout can't accidentally become production.
ALLOWED_BRANCHES="develop main"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if ! grep -qw "$CURRENT_BRANCH" <<< "$ALLOWED_BRANCHES"; then
  echo "✗ Refusing to deploy from branch '$CURRENT_BRANCH'."
  echo "  Only 'develop' or 'main' may be deployed to production."
  echo "  Testing a feature branch? Use a preview deploy instead:"
  echo "    npx vercel          # preview, not production"
  echo "    npx vercel remove <url> --yes   # clean it up once confirmed good"
  exit 1
fi

# Being on the right branch name isn't enough — a stale local checkout of
# develop/main (not pulled recently) would otherwise silently deploy old
# code while still passing the check above. This has actually happened
# (see CLAUDE.md, 2026-11-11 entry) — require the local branch to exactly
# match origin before proceeding.
echo "== Checking '$CURRENT_BRANCH' is up to date with origin =="
git fetch origin "$CURRENT_BRANCH" --quiet
LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse "origin/$CURRENT_BRANCH")
if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
  echo "✗ Local '$CURRENT_BRANCH' doesn't match origin/$CURRENT_BRANCH — refusing to deploy."
  echo "  Local:  $LOCAL_HEAD"
  echo "  Origin: $REMOTE_HEAD"
  echo "  Pull first: git pull origin $CURRENT_BRANCH"
  exit 1
fi

echo "== Building locally first =="
npm run build

echo
echo "== Deploying to Vercel production =="
OUTPUT=$(npx vercel --prod --yes)
echo "$OUTPUT"

URL=$(echo "$OUTPUT" | grep -oE '"productionUrl": *"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')

if [ -z "$URL" ]; then
  echo
  echo "✗ Could not find a production URL in Vercel's output. Check the output above."
  exit 1
fi

echo
echo "== Checking $URL =="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$CODE" = "200" ]; then
  echo "✓ Live and responding 200: $URL"
else
  echo "✗ Got HTTP $CODE from $URL — open it and check before walking in."
  exit 1
fi
