#!/usr/bin/env bash
# Install on Raspberry Pi OS / Debian / Ubuntu. Run from the repo root: sudo ./deploy/install.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "Installing Node.js 22…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y mpv python3-pip pipx >/dev/null   # local audio + AirPlay helper (optional)
PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin pipx install pyatv || true

id athan >/dev/null 2>&1 || useradd --system --home /var/lib/athan --create-home --groups audio athan
npm ci
npm run build
rm -rf /opt/athan && mkdir -p /opt/athan
cp -r package.json server web /opt/athan/
(cd /opt/athan && npm ci --omit=dev --workspaces --include-workspace-root)
chown -R athan:athan /opt/athan
install -m 644 deploy/athan.service /etc/systemd/system/athan.service
systemctl daemon-reload
systemctl enable --now athan
echo "Done. Open http://$(hostname -I | awk '{print $1}'):8080"
