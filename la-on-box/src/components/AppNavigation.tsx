const items = [
  ['HOME', 'ホーム', 'USER INFO'],
  ['ENTITY', 'entity', '生命体'],
  ['YOYAKU', 'yoyaku', '予約'],
  ['SIGNAL', 'signal', 'SIGNAL'],
  ['SETTINGS', '設定', 'SYSTEM'],
  ['LOGOUT', 'ログアウト', 'END SESSION'],
] as const;

export function AppNavigation() {
  return <nav className="app-navigation" aria-label="Application functions">
    <p>APPLICATION MENU <span>MOCK / OFFLINE</span></p>
    <div>{items.map(([code, label, note]) => <button key={code} type="button" aria-disabled="true" title="初期UIのモック機能です"><b>{code}</b><span>{label}</span><small>{note}</small></button>)}</div>
  </nav>;
}
