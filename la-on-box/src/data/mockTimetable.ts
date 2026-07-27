import type { BroadcastSlot } from '../types';
import { env } from '../config/env';
const artists = [{ id: 'artist-a', name: 'ARTIST A' }, { id: 'artist-b', name: 'ARTIST B' }, { id: 'artist-c', name: 'ARTIST C' }];
export const generateMockTimetable = (now = new Date()): BroadcastSlot[] => {
  const duration = env.debug ? 3 * 60_000 : 30 * 60_000;
  const anchor = Math.floor(now.getTime() / duration) * duration;
  return artists.map((artist, i) => ({ id: `slot-${i + 1}`, eventId: 'event-debug-001', artistId: artist.id, broadcasterId: artist.id, artistName: artist.name, thumbnailUrl: '', backgroundImageUrl: '', startsAt: new Date(anchor + i * duration).toISOString(), endsAt: new Date(anchor + (i + 1) * duration).toISOString(), audioStreamKey: `audio-${artist.id}`, streamStatus: 'standby', isPublished: true }));
};
