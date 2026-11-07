import { sleep, type PlayRequest, type Speaker, type SpeakerDriver } from './types.js';

/** Simulated speakers for demos and UI development (ATHAN_MOCK=1). Nothing is actually played. */
export const MOCK_SPEAKERS: Array<Omit<Speaker, 'lastSeen'>> = [
  { id: 'sonos:mock-living', type: 'sonos', name: 'Living Room', host: '192.168.1.21', port: 1400, model: 'Sonos Era 300', mock: true },
  { id: 'sonos:mock-kitchen', type: 'sonos', name: 'Kitchen', host: '192.168.1.22', port: 1400, model: 'Sonos One', mock: true },
  { id: 'cast:mock-bedroom', type: 'cast', name: 'Bedroom Display', host: '192.168.1.31', port: 8009, model: 'Google Nest Hub', mock: true },
  { id: 'cast:mock-group', type: 'cast', name: 'Whole House', host: '192.168.1.32', port: 8009, model: 'Google Cast Group', mock: true },
  { id: 'airplay:mock-homepod', type: 'airplay', name: 'HomePod mini', host: '192.168.1.41', port: 7000, model: 'AudioAccessory5,1', mock: true },
];

export const mockDriver = {
  async play(_sp: Speaker, req: PlayRequest): Promise<void> {
    await sleep(Math.min(req.durationSec, 6) * 1000, req.signal);
  },
} satisfies Pick<SpeakerDriver, 'play'>;
