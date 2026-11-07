import { sleep, type PlayRequest, type Speaker, type SpeakerDriver } from './types.js';

/** Simulated speakers for demos and UI development (ATHAN_MOCK=1). Nothing is actually played. */
export const MOCK_SPEAKERS: Array<Omit<Speaker, 'lastSeen'>> = [
  { id: 'sonos:mock-living', type: 'sonos', name: 'Living Room', host: '192.168.1.21', port: 1400, model: 'Sonos Era 300', mock: true },
  { id: 'sonos:mock-kitchen', type: 'sonos', name: 'Kitchen', host: '192.168.1.22', port: 1400, model: 'Sonos One', mock: true },
  { id: 'sonos:mock-roam', type: 'sonos', name: 'Patio', host: '192.168.1.23', port: 1400, model: 'Sonos Roam', mock: true },
  { id: 'sonos:mock-beam', type: 'sonos', name: 'Family Room', host: '192.168.1.24', port: 1400, model: 'Sonos Beam', mock: true },
  { id: 'cast:mock-hub', type: 'cast', name: 'Bedroom Display', host: '192.168.1.31', port: 8009, model: 'Google Nest Hub', mock: true },
  { id: 'cast:mock-mini', type: 'cast', name: 'Garage Mini', host: '192.168.1.33', port: 8009, model: 'Google Home Mini', mock: true },
  { id: 'cast:mock-home', type: 'cast', name: 'Office Speaker', host: '192.168.1.34', port: 8009, model: 'Google Home', mock: true },
  { id: 'cast:mock-group', type: 'cast', name: 'Whole House', host: '192.168.1.32', port: 8009, model: 'Google Cast Group', mock: true },
  { id: 'airplay:mock-homepod', type: 'airplay', name: 'HomePod mini', host: '192.168.1.41', port: 7000, model: 'AudioAccessory5,1', mock: true },
  { id: 'airplay:mock-homepod2', type: 'airplay', name: 'Master Bedroom', host: '192.168.1.42', port: 7000, model: 'AudioAccessory6,1', mock: true },
  { id: 'airplay:mock-atv', type: 'airplay', name: 'Family Room Apple TV', host: '192.168.1.43', port: 7000, model: 'AppleTV14,1', mock: true },
  { id: 'airplay:mock-jbl', type: 'airplay', name: 'Pool JBL', host: '192.168.1.51', port: 7000, model: 'JBL Charge 5', mock: true },
  { id: 'airplay:mock-marshall', type: 'airplay', name: 'Den', host: '192.168.1.52', port: 7000, model: 'Marshall Stanmore III', mock: true },
  { id: 'airplay:mock-denon', type: 'airplay', name: 'Theater Receiver', host: '192.168.1.53', port: 7000, model: 'Denon AVR-X3800H', mock: true },
  { id: 'cast:mock-kef', type: 'cast', name: 'Study', host: '192.168.1.54', port: 8009, model: 'KEF LSX II', mock: true },
  { id: 'cast:mock-chromecast', type: 'cast', name: 'Guest Room TV', host: '192.168.1.55', port: 8009, model: 'Chromecast', mock: true },
  { id: 'airplay:mock-bo', type: 'airplay', name: 'Hallway', host: '192.168.1.56', port: 7000, model: 'Beosound A1', mock: true },
  { id: 'cast:mock-tv', type: 'cast', name: 'LG Soundbar', host: '192.168.1.35', port: 8009, model: 'LG Soundbar', mock: true },
];

export const mockDriver = {
  async play(_sp: Speaker, req: PlayRequest): Promise<void> {
    await sleep(Math.min(req.durationSec, 6) * 1000, req.signal);
  },
} satisfies Pick<SpeakerDriver, 'play'>;
