# Athan Local Server

A self-hosted athan (adhan) server for any always-on computer: Raspberry Pi, PC, Mac, NAS or home server, with or without Docker. It calculates prayer times for your location and plays the call to prayer on your **Sonos**, **Google Cast / Nest**, **AirPlay** speakers, or the computer's own audio output. Everything is controlled from a responsive web UI.

## Features
- **Speakers**: automatic discovery (Sonos via SSDP, Cast and AirPlay via mDNS), manual add by IP, per-speaker enable/volume/nickname, multiple speakers at once. Sonos and Cast return to what they were playing afterwards.
- **Per-prayer control**: skip any prayer (e.g. Fajr), choose athan, speakers, volume, minute offset, weekdays, quiet-hours behaviour.
- **Prayer times**: [Aladhan](https://aladhan.com/prayer-times-api) (16 calculation methods, cached) with automatic fallback to built-in offline calculation ([adhan-js](https://github.com/batoulapps/adhan-js)); optional fixed mosque timetable; Hanafi/standard Asr; high-latitude rules.
- **Location**: city search (Open-Meteo geocoding), detect by IP/device, or raw coordinates. Time zone is derived offline.
- **Daily sync** (default 3:00 AM local time): refreshes prayer times for the current month plus the next 5 months (configurable), rescans for speakers, and updates the Islamic calendar. Catches up if the server was off, retries if the internet was down.
- **Calendar**: month grid and table of prayer times with Hijri dates and Islamic events (Ramadan, both Eids, Ashura, Laylat al-Qadr…), plus a Hijri date adjustment for local moon sighting.
- **Athan library**: upload audio, or download from a link; preview in the browser.
- **Quiet hours, pause/snooze, master switch**, **MQTT + Home Assistant discovery**, **webhooks** (ntfy etc.).

## Install
Run it on any always-on computer on the same network as your speakers: Raspberry Pi, PC, Mac, NAS or home server. Details, networking rules and troubleshooting are in **[docs/INSTALL.md](docs/INSTALL.md)**.

```bash
# Docker (Linux / NAS / Raspberry Pi) – amd64 and arm64
docker compose up -d
```
- **Without Docker:** download the release bundle for Windows, macOS or Linux (needs Node.js 20+), run `node athan.mjs`, and optionally install it as a service with the scripts in `service/`.
- **Raspberry Pi / Debian from source:** `sudo ./deploy/install.sh`

Then open `http://<computer-address>:8080`.

## Development
```bash
npm install
ATHAN_MOCK=1 npm run dev        # API on :8080, UI on :5173, with simulated speakers
npm test
```
Data (config, athan files) lives in `./data` (`DATA_DIR`).

## Notes and limits
- No login: keep it on your LAN.
- Speaker discovery needs multicast on the same network. Docker needs host networking (Linux); on macOS/Windows Docker Desktop use a native install or add speakers by IP.
- Speakers fetch audio from `http://<pi-ip>:8080/audio/...`; set a *Public address override* in Settings if the wrong IP is detected.
- **AirPlay** playback uses [pyatv](https://pyatv.dev)'s `atvremote` (RAOP); multiple AirPlay speakers are not sample-synchronised. Sonos players that are grouped play together.
- Athan recordings are not bundled (licensing). Add your own in the Library.
- Hardware playback (Sonos/Cast/AirPlay/local) is implemented against the libraries' APIs but has only been exercised with simulated speakers so far.

## Automatic deploys (CI/CD)
`.github/workflows/ci.yml` typechecks, tests and builds every push and pull request. Pushes to the default branch then deploy to the Pi through a **self-hosted runner** that lives on the Pi (it only makes outbound connections, so no ports need opening).

One-time setup on the Pi (after running `deploy/install.sh` once):
1. In GitHub: **Settings → Actions → Runners → New self-hosted runner → Linux / ARM64**, and follow the commands it shows. When asked for labels, add `athan-pi`. Install it as a service (`sudo ./svc.sh install && sudo ./svc.sh start`).
2. Let the runner user update the app and restart only this service (replace `RUNNER` with the user the runner runs as):
   ```bash
   sudo chown -R RUNNER:athan /opt/athan
   echo 'RUNNER ALL=(root) NOPASSWD: /usr/bin/systemctl restart athan' | sudo tee /etc/sudoers.d/athan-deploy
   sudo chmod 440 /etc/sudoers.d/athan-deploy
   ```
3. Make sure Node 22 is installed on the Pi (the installer does this).

Security: only trusted people should be able to push to the default branch (use branch protection), because that code runs on your Pi. The workflow never deploys from pull requests.
