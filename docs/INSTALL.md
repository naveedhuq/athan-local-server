# Installing Athan

Athan is a small server. Run it on any computer that stays on and sits on the **same network as your speakers**: a Raspberry Pi, an old PC, a Mac mini, a NAS, a home server. Then open `http://<that-computer>:8080` from any phone or laptop.

| Where you're installing | Best option |
|---|---|
| Linux server, NAS, Raspberry Pi with Docker | [Docker Compose](#docker-linux-nas-raspberry-pi) (recommended) |
| Linux, macOS or Windows without Docker | [Release bundle](#without-docker-linux-macos-windows) + Node.js |
| Raspberry Pi / Debian / Ubuntu, built from source | [`deploy/install.sh`](#raspberry-pi--debian--ubuntu-from-source) |
| Docker Desktop on macOS / Windows | Works, with [limits](#docker-desktop-macos--windows) – native install is better |

## Before you start: networking (important)

Speakers are found with multicast (mDNS for Google Cast and AirPlay, SSDP for Sonos), and they **download the athan audio from this server**. So:

- The server and the speakers must be on the same network / VLAN, and your router must not block multicast between Wi-Fi and Ethernet ("client isolation", "AP isolation").
- Allow **inbound TCP 8080** (the web UI and the audio files) on the server's firewall for your home network.
- If automatic discovery can't work (VLANs, Docker bridge networking), use **Speakers → Add by IP**. That works for Sonos, Cast and AirPlay.
- If the server picks the wrong IP address for the audio URL (several network cards, VPN, Docker), set the **Public address override** in Settings (or the `PUBLIC_URL` environment variable) to e.g. `http://192.168.1.20:8080`.

There is no login. Only run it on a network you trust.

## Docker (Linux, NAS, Raspberry Pi)

Images are published for **amd64 and arm64** to `ghcr.io/naveedhuq/athan-local-server`.

```bash
git clone https://github.com/naveedhuq/athan-local-server.git
cd athan-local-server
docker compose up -d
```

Open `http://<server-ip>:8080`. Data (settings, athan files) lives in the `athan-data` volume.

- **Host networking is required** (the compose file sets it) so speaker discovery works.
- **Update:** `docker compose pull && docker compose up -d`
- **Logs:** `docker compose logs -f`
- **Time zone:** `TZ=America/New_York docker compose up -d` (prayer times use your location's zone regardless).
- **Plain `docker run`:** `docker run -d --name athan --network host -v athan-data:/data --restart unless-stopped ghcr.io/naveedhuq/athan-local-server:latest`
- **Play through the server's own speakers:** build the image yourself with local audio support: `docker compose build --build-arg WITH_LOCAL_AUDIO=1`, then uncomment the `devices`/`group_add` lines in the compose file.
- **Build locally instead of pulling:** `docker compose up -d --build`

> If the package is private after the first publish, set it to **Public** in GitHub → your profile → Packages → athan-local-server → Package settings, so others can pull it.

### Docker Desktop (macOS / Windows)

Docker Desktop runs containers in a VM, so host networking doesn't reach your real network and multicast discovery can't work. It still runs, with these limits:

```bash
PUBLIC_URL=http://192.168.1.20:8080 docker compose -f docker-compose.bridge.yml up -d
```

Use your computer's LAN address for `PUBLIC_URL`, and add speakers with **Add by IP**. For a hassle-free setup on a Mac or PC, use the native install below.

## Without Docker (Linux, macOS, Windows)

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org); `brew install node`; `winget install OpenJS.NodeJS.LTS`).

1. Download `athan-server-<version>.zip` (or `.tar.gz`) from the project's **Releases** page and extract it anywhere.
2. Start it:
   - macOS / Linux: `./start.sh`
   - Windows: double-click `start.cmd`
   - or anywhere: `node athan.mjs`
3. Open `http://localhost:8080`.

Settings and athan files are stored outside the program folder, so upgrading never touches them:

| OS | Data folder |
|---|---|
| Windows | `%APPDATA%\Athan` |
| macOS | `~/Library/Application Support/Athan` |
| Linux | `~/.local/share/athan` |

### Start automatically

Run the matching script from the extracted folder:

| OS | Command | Uninstall |
|---|---|---|
| Linux (systemd) | `sudo ./service/install-linux.sh` | `sudo ./service/install-linux.sh --uninstall` |
| macOS (launchd, at login) | `./service/install-macos.sh` | `./service/install-macos.sh --uninstall` |
| Windows (at login) | `.\service\install-windows.ps1` in PowerShell (run once as Administrator to also open the firewall) | `.\service\install-windows.ps1 -Uninstall` |

macOS may ask to let Node find devices on your local network: choose **Allow**. Windows may show a firewall prompt: allow it on **Private** networks.

**Upgrade:** stop the server, extract the new release over a fresh folder, start it again.

### Optional extras

| For | Install |
|---|---|
| AirPlay speakers | [pyatv](https://pyatv.dev): `pipx install pyatv` |
| Playing through this computer's own speakers | `mpv` (`apt install mpv` · `brew install mpv` · `winget install mpv`). macOS can also use its built-in `afplay`. |

## Raspberry Pi / Debian / Ubuntu, from source

```bash
git clone https://github.com/naveedhuq/athan-local-server.git
cd athan-local-server
sudo ./deploy/install.sh
```

This installs Node 22, mpv and pyatv, builds the app, and sets up a systemd service (`systemctl status athan`).

## Settings you can change with environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Web UI / audio port |
| `HOST` | `0.0.0.0` | Interface to listen on |
| `DATA_DIR` | per-OS folder (see above); `/data` in Docker | Where settings and athan files live |
| `PUBLIC_URL` | auto-detected LAN address | The address speakers use to fetch audio |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## Troubleshooting

- **No speakers appear:** same network? Multicast allowed? (Docker: host networking.) Otherwise use **Add by IP**.
- **A speaker is found but stays silent:** it can't reach the server. Check the firewall for port 8080 and the *Public address override*.
- **AirPlay does nothing:** install `pyatv` (the Speakers page shows a warning when it's missing).
- **Wrong prayer times:** set the right calculation method in Settings → Prayer time calculation.
