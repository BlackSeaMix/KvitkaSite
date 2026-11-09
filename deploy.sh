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
