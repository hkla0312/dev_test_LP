export type StreamStatus = 'standby' | 'live' | 'offline' | 'connecting';
export type ConnectionStatus = 'online' | 'connecting' | 'offline' | 'standby' | 'no-signal';
export interface MemberSession { memberId: string; displayName: string; uid?: string; expiresAt: number }
export interface BroadcasterSession { broadcasterId: string; artistName: string; expiresAt: number }
export interface Artist { id: string; name: string; thumbnailUrl?: string; backgroundImageUrl?: string }
export interface BroadcastEvent { id: string; name: string; startsAt: string; endsAt: string }
export interface BroadcastSlot { id: string; eventId: string; artistId: string; broadcasterId: string; artistName: string; thumbnailUrl: string; backgroundImageUrl: string; startsAt: string; endsAt: string; audioStreamKey: string; streamStatus: StreamStatus; isPublished: boolean }
export interface ArtistVisualSettings { eventId: string; slotId: string; thumbnailUrl: string; backgroundImageUrl: string; updatedAt: string }
export interface AudioStreamStatus { status: ConnectionStatus; message: string }
export interface DanmakuComment { id: string; eventId: string; slotId: string; memberId: string; displayName: string; body: string; createdAt: string; status: 'approved' | 'pending' | 'rejected' }
