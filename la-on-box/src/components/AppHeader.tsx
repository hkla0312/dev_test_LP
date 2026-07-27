import type { ConnectionStatus } from '../types';
export function AppHeader({ status = 'online' }: { status?: ConnectionStatus }) { return <header className="app-header"><div><b>LA_ON-BOX</b><small>AUDIO LIVE CONNECTION</small></div><span className={`badge ${status}`}>{status === 'online' ? 'SYSTEM ONLINE' : status.toUpperCase()}</span></header>; }
