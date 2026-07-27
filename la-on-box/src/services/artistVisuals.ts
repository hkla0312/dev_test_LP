import type { ArtistVisualSettings } from '../types';
const key = (slotId: string) => `la_on_box_visuals_${slotId}`;
export const artistVisuals = { get(slotId: string): ArtistVisualSettings | null { try { return JSON.parse(localStorage.getItem(key(slotId)) || 'null'); } catch { return null; } }, save(value: ArtistVisualSettings) { localStorage.setItem(key(value.slotId), JSON.stringify(value)); return value; } };
