#!/usr/bin/env bash
# Deploy backend (Convex) and frontend (Vercel production).
#
# Usage:
#   ./scripts/deploy.sh          # Convex + Vercel
#   ./scripts/deploy.sh --convex # Convex only
#   ./scripts/deploy.sh --vercel # Vercel only
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

DEPLOY_CONVEX=1
DEPLOY_VERCEL=1

while [ $# -gt 0 ]; do
	case "$1" in
		--convex)
			DEPLOY_CONVEX=1
			DEPLOY_VERCEL=0
			;;
		--vercel)
			DEPLOY_CONVEX=0
			DEPLOY_VERCEL=1
			;;
		*)
			echo "Unknown option: $1" >&2
			exit 1
			;;
	esac
	shift
done

if [ "${DEPLOY_CONVEX}" -eq 1 ]; then
	echo "→ Deploying Convex…"
	npx convex deploy -y
fi

if [ "${DEPLOY_VERCEL}" -eq 1 ]; then
	echo "→ Deploying Vercel…"
	vercel deploy --prod -y
fi

echo "✓ Deploy complete"
