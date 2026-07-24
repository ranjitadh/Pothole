#!/bin/bash
# Deploy script - builds, submits to Play Store, and pushes OTA update
# Usage: ./deploy.sh "commit message"

set -e

MESSAGE="${1:-Production deploy $(date +%Y-%m-%d)}"

echo "=== Step 1: Run tests ==="
npm test -- --silent

echo ""
echo "=== Step 2: Commit changes ==="
git add -A
if ! git diff --cached --quiet; then
  git commit -m "$MESSAGE"
fi

echo ""
echo "=== Step 3: Push to GitHub ==="
git push

echo ""
echo "=== Step 4: Build + Auto-Submit to Play Store ==="
eas build --platform android --profile production --auto-submit --non-interactive

echo ""
echo "=== Step 5: Push OTA update ==="
eas update --auto --message "$MESSAGE" --platform android --non-interactive

echo ""
echo "=== Done! ==="
