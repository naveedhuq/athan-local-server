#!/usr/bin/env bash
# Rebuild and redeploy to /opt/athan, then restart the service.
# Used by the CI/CD self-hosted runner. Run deploy/install.sh once first.
# Needs: /opt/athan writable by the current user, and passwordless
# `sudo systemctl restart athan` (see README "Automatic deploys").
set -euo pipefail

npm ci
npm run build

tar --exclude=node_modules --exclude='server/src' --exclude='web/src' --exclude='server/test' \
  -cf - package.json package-lock.json server web | tar -xf - -C /opt/athan
(cd /opt/athan && npm ci --omit=dev --workspaces --include-workspace-root)

sudo -n systemctl restart athan

# Fail the pipeline if the new version doesn't come up.
for i in $(seq 1 20); do
  if curl -fsS http://localhost:8080/api/system >/dev/null 2>&1; then
    echo "Deployed. Server is healthy."
    exit 0
  fi
  sleep 1
done
echo "Server did not become healthy after deploy" >&2
journalctl -u athan -n 30 --no-pager || true
exit 1
