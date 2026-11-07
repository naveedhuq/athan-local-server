#!/usr/bin/env bash
# Run Athan as a systemd service on any Linux distro. Run from the extracted bundle:
#   sudo ./service/install-linux.sh            install + start
#   sudo ./service/install-linux.sh --uninstall
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Please run with sudo."; exit 1; }
UNIT=/etc/systemd/system/athan.service

if [ "${1:-}" = "--uninstall" ]; then
  systemctl disable --now athan 2>/dev/null || true
  rm -f "$UNIT" && systemctl daemon-reload
  echo "Removed. Your data folder was left in place."; exit 0
fi

APP="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "Node.js 20+ is required. Install it from https://nodejs.org or your package manager."; exit 1; }
USER_NAME="${SUDO_USER:-root}"
USER_HOME="$(getent passwd "$USER_NAME" | cut -d: -f6)"

cat > "$UNIT" <<UNIT
[Unit]
Description=Athan server
After=network-online.target sound.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$APP
Environment=HOME=$USER_HOME
ExecStart=$NODE $APP/athan.mjs
Restart=always
RestartSec=5
SupplementaryGroups=audio

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now athan
echo "Athan is running as a service (user: $USER_NAME)."
echo "Open http://$(hostname -I 2>/dev/null | awk '{print $1}'):8080"
echo "Logs: journalctl -u athan -f"
