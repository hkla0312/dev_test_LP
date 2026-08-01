const items = [
  ['HOME', 'ホーム', 'USER INFO'],
  ['ENERGY', 'energy', 'COMING SOON'],
] as const;

export function AppNavigation() {
  return <nav className="app-navigation" aria-label="Application functions">
    <p>APPLICATION MENU <span>MOCK / OFFLINE</span></p>
    <div>{items.map(([code, label, note]) => <button key={code} type="button" aria-disabled={code === 'HOME' ? undefined : 'true'} title={code === 'HOME' ? 'LA_OS MEMBER HOME' : '初期UIのモック機能です'} onClick={() => { if (code === 'HOME') window.location.assign(new URL('../LA_OS/index.html', window.location.href).href); }}><b>{code}</b><span>{label}</span><small>{note}</small></button>)}</div>
  </nav>;
}
