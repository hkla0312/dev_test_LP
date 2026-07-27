import { generateMockTimetable } from '../data/mockTimetable';
import type { BroadcastSlot } from '../types';
export const getSlots = () => generateMockTimetable();
export const currentSlot = (slots: BroadcastSlot[], now = Date.now()) => slots.find(s => new Date(s.startsAt).getTime() <= now && now < new Date(s.endsAt).getTime()) || slots[0];
export const nextSlot = (slots: BroadcastSlot[], slot?: BroadcastSlot) => slot ? slots[(slots.findIndex(s => s.id === slot.id) + 1) % slots.length] : slots[0];
export const slotEligibility = (slot: BroadcastSlot, broadcasterId: string, now = Date.now()) => {
  const starts = new Date(slot.startsAt).getTime(), ends = new Date(slot.endsAt).getTime();
  if (slot.broadcasterId !== broadcasterId) return { allowed: false, reason: 'THIS SLOT IS ASSIGNED TO ANOTHER BROADCASTER' };
  if (now < starts) return { allowed: false, reason: `YOUR SLOT HAS NOT STARTED · ${Math.ceil((starts - now) / 1000)} SEC` };
  if (now >= ends) return { allowed: false, reason: 'YOUR SLOT HAS ENDED' };
  return { allowed: true, reason: 'TIME SLOT UNLOCKED' };
};
