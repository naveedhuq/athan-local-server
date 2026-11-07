#!/usr/bin/env bash
# Run Athan automatically at login on macOS (launchd). Run from the extracted bundle:
#   ./service/install-macos.sh
#   ./service/install-macos.sh --uninstall
set -euo pipefail
LABEL=com.athan.server
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"; echo "Removed. Your data folder was left in place."; exit 0
fi

APP="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "Node.js 20+ is required: brew install node (or https://nodejs.org)"; exit 1; }
LOGS="$HOME/Library/Logs/Athan"; mkdir -p "$LOGS" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$APP/athan.mjs</string></array>
  <key>WorkingDirectory</key><string>$APP</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/athan.log</string>
  <key>StandardErrorPath</key><string>$LOGS/athan.err.log</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin</string></dict>
</dict></plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Athan will now start automatically when you log in. Open http://localhost:8080"
echo "If macOS asks to allow Node to find devices on your local network, choose Allow."
echo "Logs: $LOGS"
