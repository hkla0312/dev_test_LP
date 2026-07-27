import type { StreamStatus } from '../types';
export const presence = { set(slotId: string, status: StreamStatus) { localStorage.setItem(`la_on_box_presence_${slotId}`, status); }, get(slotId: string): StreamStatus { return (localStorage.getItem(`la_on_box_presence_${slotId}`) as StreamStatus) || 'standby'; } };
