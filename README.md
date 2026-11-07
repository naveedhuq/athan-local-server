# Athan Local Server

A self-hosted athan (adhan) server for a Raspberry Pi. It calculates prayer times for your location and plays the call to prayer on your **Sonos**, **Google Cast / Nest**, **AirPlay** speakers, or the Pi's own audio output. Everything is controlled from a responsive web UI.

## Features
- **Speakers**: automatic discovery (Sonos via SSDP, Cast and AirPlay via mDNS), manual add by IP, per-speaker enable/volume/nickname, multiple speakers at once. Sonos and Cast return to what they were playing afterwards.
- **Per-prayer control**: skip any prayer (e.g. Fajr), choose athan, speakers, volume, minute offset, weekdays, quiet-hours behaviour.
- **Prayer times**: [Aladhan](https://aladhan.com/prayer-times-api) (16 calculation methods, cached) with automatic fallback to built-in offline calculation ([adhan-js](https://github.com/batoulapps/adhan-js)); optional fixed mosque timetable; Hanafi/standard Asr; high-latitude rules.
- **Location**: city search (Open-Meteo geocoding), detect by IP/device, or raw coordinates. Time zone is derived offline.
- **Athan library**: upload audio, or download from a link; preview in the browser.
- **Quiet hours, pause/snooze, master switch**, **MQTT + Home Assistant discovery**, **webhooks** (ntfy etc.).

## Install on the Pi
```bash
git clone <this repo> && cd athan-local-server
sudo ./deploy/install.sh        # installs Node 22, mpv, pyatv, builds, enables systemd service
```
Open `http://<pi-address>:8080`. Or with Docker: `docker compose up -d` (host networking is required for discovery).

## Development
```bash
npm install
ATHAN_MOCK=1 npm run dev        # API on :8080, UI on :5173, with simulated speakers
npm test
```
Data (config, athan files) lives in `./data` (`DATA_DIR`).

## Notes and limits
- No login: keep it on your LAN.
- Speakers fetch audio from `http://<pi-ip>:8080/audio/...`; set a *Public address override* in Settings if the wrong IP is detected.
- **AirPlay** playback uses [pyatv](https://pyatv.dev)'s `atvremote` (RAOP); multiple AirPlay speakers are not sample-synchronised. Sonos players that are grouped play together.
- Athan recordings are not bundled (licensing). Add your own in the Library.
- Hardware playback (Sonos/Cast/AirPlay/local) is implemented against the libraries' APIs but has only been exercised with simulated speakers so far.
