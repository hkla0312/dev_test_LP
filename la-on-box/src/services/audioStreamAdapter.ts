import type { AudioStreamStatus, ConnectionStatus } from '../types';
type Listener = (status: AudioStreamStatus) => void;
class MockAudioStreamAdapter {
  private status: ConnectionStatus = 'standby'; private stream: MediaStream | null = null; private listeners = new Set<Listener>();
  private publish(message: string) { const value = { status: this.status, message }; this.listeners.forEach(fn => fn(value)); }
  async connect() { this.status = 'connecting'; this.publish('CONNECTING AUDIO'); await new Promise(r => setTimeout(r, 350)); this.status = 'online'; this.publish('AUDIO CONNECTION ESTABLISHED'); }
  disconnect() { this.status = 'offline'; this.publish('AUDIO DISCONNECTED'); }
  async startBroadcast(stream: MediaStream) { this.stream = stream; this.status = 'online'; this.publish('MOCK AUDIO BROADCAST LIVE'); }
  stopBroadcast() { this.stream?.getAudioTracks().forEach(track => track.stop()); this.stream = null; this.status = 'offline'; this.publish('BROADCAST STOPPED'); }
  getAudioStream() { return this.stream; } getConnectionStatus() { return this.status; }
  subscribeToStatus(listener: Listener) { this.listeners.add(listener); listener({ status: this.status, message: 'STANDBY' }); return () => this.listeners.delete(listener); }
}
export const audioStreamAdapter = new MockAudioStreamAdapter();
