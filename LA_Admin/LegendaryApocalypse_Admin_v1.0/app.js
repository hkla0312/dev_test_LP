/* global firebase, FIREBASE_CONFIG */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
  const timestampText = value => value && value.toDate ? value.toDate().toLocaleString('ja-JP') : (value || '—');
  const timestampValue = value => value && value.toDate ? value.toDate().getTime() : (Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0);
  const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();
  const ADMIN_LOGIN_URL = localStorage.getItem('la-admin-login-url') || 'login/index.html';
  const ARTIST_THEME_COLOR_ENDPOINT = 'https://us-central1-laconsole-12985.cloudfunctions.net/generateArtistThemeColors';
  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
  let sessionTimer = null;
  const state = {
    db: null, storage: null, user: null, view: 'events', busy: false,
    environment: localStorage.getItem('la-admin-environment') || 'dev',
    selectedMember: null, selectedArtist: null, showDeletedSignals: false,
    data: { events: [], artists: [], members: [], reservations: [], artistSignals: [], errorReports: [], adminLogs: [] },
    settings: { signalEnabled: true, systemEnabled: true }, unsubscribers: [], collectionErrors: {}
  };
  const ACTIONS = ['EVENT_CREATE','EVENT_UPDATE','EVENT_ARCHIVE','EVENT_RESTORE','EVENT_DELETE','ARTIST_CREATE','ARTIST_UPDATE','ARTIST_DELETE','ARTIST_THEME_COLOR_GENERATE','SIGNAL_AGGREGATE_RESET','MEMBER_DELETE','MEMBER_RESTORE','MEMBER_FINANCE_EDIT','MEMBER_FINANCE_LOCK','PROGRESS_ADD','LICENSE_CHANGE','SIGNAL_DELETE','SIGNAL_RESTORE','ERROR_REPORT_RESOLVE'];
  const ERROR_TYPE_CATALOG = [
    ['LAOS-AUTH-001','認証','メールアドレス重複','登録済みのメールアドレスです。'],
    ['LAOS-AUTH-002','認証','メール形式不正','メールアドレスの形式を確認してください。'],
    ['LAOS-AUTH-003','認証','パスワード条件不足','パスワードは6文字以上必要です。'],
    ['LAOS-AUTH-004','認証','認証情報不一致','メールアドレスまたはパスワードが一致しません。'],
    ['LAOS-AUTH-005','認証','未ログイン / セッション切れ','再ログインしてください。'],
    ['LAOS-NET-001','通信','通信エラー','通信状態を確認して再試行してください。'],
    ['LAOS-SRV-001','サーバー','保存権限不足','Firestore Rulesまたは管理者権限を確認してください。'],
    ['LAOS-SYNC-001','サーバー','会員情報未同期','少し待ってから再試行してください。'],
    ['LAOS-QUO-001','サーバー','送信上限','時間をおいて再試行してください。'],
    ['LAOS-SRV-002','サーバー','Firebase一時停止','時間をおいて再試行してください。'],
    ['LAOS-SRV-003','サーバー','内部エラー / タイムアウト','エラーコードを添えて運営へ報告してください。'],
    ['LAOS-UNK-001','サーバー','未分類エラー','エラーコードを添えて運営へ報告してください。']
  ];
  state.filters = { eventSearch:'', eventStatus:'all', artistSearch:'', artistRole:'all', memberSearch:'', memberStatus:'active', reservationDate:'all', signalSource:'all', signalStatus:'all', signalBonus:'all', signalAxis:'all' };

  function toast(message, isError = false) {
    const node = document.createElement('div'); node.className = 'toast'; node.textContent = message;
    if (isError) node.style.background = '#c83445';
    $('#toastRoot').append(node); setTimeout(() => node.remove(), 4200);
  }
  function errorMessage(error, action) {
    const code = error && error.code || '';
    if (code.includes('permission-denied')) return `${action}する権限がありません。Firestore Rules と管理者権限を確認してください。`;
    if (code.includes('unauthenticated')) return '認証状態を確認できません。管理者ログインページからやり直してください。';
    if (code.includes('storage/')) return '画像ストレージへの接続に失敗しました。Storage の有効化とルールを確認してください。';
    if (code.includes('unavailable')) return 'Firebase に接続できません。通信状態を確認してください。';
    return `${action}に失敗しました。時間をおいて再度お試しください。`;
  }
  function setBanner(message) { const node = $('#firebaseBanner'); node.textContent = message; node.hidden = !message; }
  function modal(title, html, submit, submitLabel = '保存') {
    $('#modalRoot').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><header class="modal-head"><h2 id="modalTitle">${escapeHtml(title)}</h2><button class="text-button modal-close" aria-label="閉じる">×</button></header><div class="modal-body">${html}</div><p id="modalSaveState" class="save-state" hidden>未保存の変更があります。</p><footer class="modal-footer"><button class="secondary modal-cancel">キャンセル</button><button class="primary modal-submit">${escapeHtml(submitLabel)}</button></footer></section></div>`;
    const close = () => { $('#modalRoot').innerHTML = ''; };
    $('.modal-close').onclick = close; $('.modal-cancel').onclick = close;
    $('.modal-backdrop').onclick = event => { if (event.target === event.currentTarget) close(); };
    const form = $('.modal-body form');
    if (form) $$('.modal-body input, .modal-body textarea, .modal-body select').forEach(field => field.addEventListener('input', () => { $('#modalSaveState').hidden = false; }, { once:false }));
    $('.modal-submit').onclick = async () => {
      if (state.busy) return; state.busy = true; $('.modal-submit').disabled = true; $('.modal-submit').textContent = '保存中…';
      try { await submit(); close(); } catch (error) { toast(errorMessage(error, title), true); $('.modal-submit').disabled = false; }
      finally { state.busy = false; }
    };
    $('.modal-submit').focus();
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') $('#modalRoot').innerHTML = ''; });
  function confirmAction(title, message, action, label = '実行') { modal(title, `<p>${escapeHtml(message)}</p>`, action, label); }
  async function adminLog(actionType, targetType, targetId, targetLabel, detail = '') {
    if (!ACTIONS.includes(actionType)) return;
    await state.db.collection('adminLogs').add({ actionType, targetType, targetId, targetLabel, detail, adminUid: state.user.uid, adminDisplayName: state.user.displayName || state.user.email || 'ADMIN', createdAt: serverTime() });
  }
  function collectionSnapshot(name) {
    state.unsubscribers.push(state.db.collection(name).onSnapshot(snapshot => {
      state.data[name] = snapshot.docs.map(document => ({ ...document.data(), id: document.id }));
      delete state.collectionErrors[name];
      if (name === 'errorReports') {
        const badge = $('#errorReportBadge');
        if (badge) { const open = state.data.errorReports.filter(report => report.status !== 'resolved').length; badge.textContent = `ERROR: ${open}`; badge.classList.toggle('off', open === 0); }
      }
      if (state.view) render();
    }, error => { state.collectionErrors[name] = error; setBanner(errorMessage(error, 'データ取得')); if (state.view) render(); }));
  }
  function level(progress) {
    let points = Math.max(0, Number(progress || 0)), current = 1, used = 0, needed = 5;
    while (current < 100 && points >= used + needed) { used += needed; current += 1; needed = Math.ceil(5 + (current - 1) * 1.25); }
    return { label: `v${(current / 100).toFixed(2)}`, current, start: used, next: current === 100 ? 0 : needed, ratio: current === 100 ? 100 : Math.min(100, Math.round((points - used) / needed * 100)) };
  }
  function openOperations() {
    const signal = state.settings.signalEnabled !== false;
    const system = state.settings.systemEnabled !== false;
    modal('運用設定', `<div class="form-grid"><label class="field">SIGNAL送信<select id="operationSignal"><option value="true" ${signal ? 'selected' : ''}>ON</option><option value="false" ${!signal ? 'selected' : ''}>OFF</option></select></label><label class="field">システム稼働<select id="operationSystem"><option value="true" ${system ? 'selected' : ''}>ON</option><option value="false" ${!system ? 'selected' : ''}>緊急停止</option></select></label></div><p class="sub">設定はLA_OS側の操作制御に反映されます。</p>`, async () => {
      const signalEnabled = $('#operationSignal').value === 'true';
      const systemEnabled = $('#operationSystem').value === 'true';
      await state.db.collection('settings').doc('system').set({ signalEnabled, systemEnabled, updatedAt:serverTime(), updatedBy:state.user.uid }, { merge:true });
      toast('運用設定を保存しました。');
    }, '設定を保存');
  }
  function pageHead(title, description, button = '') { return `<div class="page-head"><div><h1>${title}</h1><p class="sub">${description}</p></div>${button}</div>`; }
  function table(items, headers, row, empty = 'データはありません。') { return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${items.length ? items.map(row).join('') : `<tr><td class="empty" colspan="99">${empty}</td></tr>`}</tbody></table></div>`; }
  function eventPage() {
    const active = state.data.events.filter(event => event.status !== 'archived').sort((a,b) => String(a.eventDate).localeCompare(String(b.eventDate)));
    const archived = state.data.events.filter(event => event.status === 'archived');
    const row = event => `<tr><td>${escapeHtml(event.title)}</td><td>${escapeHtml(event.eventDate)}</td><td>${escapeHtml(event.venue)}</td><td>${event.environment === 'prod' && event.lpVisible ? '公開中' : 'DEV / 非公開'}</td><td class="actions"><button class="secondary" data-event-edit="${event.id}">編集</button><button class="secondary" data-event-publish="${event.id}">${event.environment === 'prod' ? 'DEVへ戻す' : '本番公開'}</button>${event.status === 'archived' ? `<button class="secondary" data-event-restore="${event.id}">復元</button>` : `<button class="danger" data-event-archive="${event.id}">アーカイブ</button>`}<button class="danger" data-event-delete="${event.id}">削除</button></td></tr>`;
    return pageHead('EVENT', 'イベント管理', '<button class="primary" data-action="event-new">新規イベントを追加</button>') + `<section class="card"><h2>開催予定</h2>${table(active, ['タイトル','開催日','会場','LP','操作'], row)}</section><details class="card"><summary>アーカイブ済み（${archived.length}件）</summary>${table(archived, ['タイトル','開催日','会場','LP','操作'], row, 'アーカイブ済みのイベントはありません。')}</details>`;
  }
  function artistPage() {
    const row = artist => `<tr><td>${escapeHtml(artist.artistKey || '—')}</td><td>${escapeHtml(artist.name)}</td><td>${escapeHtml(artist.role || 'FRESH')}</td><td>${Number(artist.appearanceCount || 0)}</td><td>${escapeHtml(artist.genre || '—')}</td><td>${artist.environment === 'prod' && artist.lpVisible ? '公開中' : 'DEV / 非公開'}</td><td class="actions"><button class="secondary" data-artist-edit="${artist.id}">編集</button><button class="secondary" data-artist-publish="${artist.id}">${artist.environment === 'prod' ? 'DEVへ戻す' : '本番公開'}</button><button class="danger" data-artist-delete="${artist.id}">削除</button></td></tr>`;
    return pageHead('ARTIST', 'アーティスト管理', '<button class="primary" data-action="artist-new">新規アーティストを追加</button>') + `<section class="card">${table(state.data.artists, ['ARTIST KEY','名前','ロール','出演回数','ジャンル','LP','操作'], row)}</section>`;
  }
  function memberPage() {
    const row = member => { const version = level(member.progress); return `<tr><td>${escapeHtml(member.memberId)}</td><td>${escapeHtml(member.displayName)}</td><td>${version.label}</td><td>${escapeHtml(member.email)}</td><td>${member.emailVerified ? '認証済み' : '未認証'}</td><td>${Number(member.progress || 0)} pt</td><td>${escapeHtml(member.licenseType || 'NONE')}</td><td>${escapeHtml(member.accountStatus || 'active')}</td><td><button class="secondary" data-member-select="${member.id}">選択</button><button class="danger" data-member-delete="${member.id}">削除</button></td></tr>`; };
    const current = state.selectedMember ? `<section class="card"><h2>選択中：${escapeHtml(state.selectedMember.displayName)}</h2><p>${escapeHtml(state.selectedMember.memberId)} / ${level(state.selectedMember.progress).label} / ${Number(state.selectedMember.progress || 0)} pt</p><label class="field">ライセンス<select id="licenseSelect">${['NONE','STANDARD','PREMIUM'].map(value => `<option ${state.selectedMember.licenseType === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="primary" data-action="license-save">ライセンスを変更</button></section>` : '';
    return pageHead('MEMBER', 'メンバー情報はFirebase Authenticationと連携しています。') + `<section class="card">${table(state.data.members, ['MEMBER ID','表示名','VERSION','メール','認証','PROGRESS','ライセンス','状態','操作'], row)}</section>${current}`;
  }
  function numberText(value) { return Number(value || 0).toLocaleString('ja-JP'); }
  function licenseDescription(type) { return ({ NONE:'アーカイブ視聴不可', STANDARD:'直近3公演を視聴可能', PREMIUM:'公開中の全アーカイブを視聴可能' }[type] || 'アーカイブ視聴不可'); }
  function memberSignals(member) {
    const all = state.data.artistSignals.filter(signal => signal.memberUid === member.id || (member.memberId && signal.memberId === member.memberId));
    return { active: all.filter(signal => !signal.isDeleted).length, total: all.length };
  }
  function reservationPage() {
    const filter = state.filters;
    const reservations = [...state.data.reservations]
      .filter(reservation => filter.reservationDate === 'all' || reservation.eventDate === filter.reservationDate)
      .sort((a, b) => String(a.eventDate || '9999-12-31').localeCompare(String(b.eventDate || '9999-12-31')) || timestampValue(b.updatedAt || b.createdAt) - timestampValue(a.updatedAt || a.createdAt));
    const dates = [...new Set(state.data.reservations.map(reservation => reservation.eventDate).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    const statusLabel = status => ({ active: '予約中', canceled: 'キャンセル済み', cancelled: 'キャンセル済み' }[status] || String(status || '-'));
    const row = reservation => `<tr><td>${escapeHtml(reservation.eventDate || '-')}</td><td>${escapeHtml(reservation.eventTitle || '-')}</td><td>${escapeHtml(reservation.memberDisplayName || reservation.displayName || '-')}<br><small>${escapeHtml(reservation.memberId || reservation.memberUid || '')}</small></td><td>${escapeHtml(reservation.actName || reservation.artistName || '-')}</td><td>${Number(reservation.ticketCount || 0)}</td><td>${escapeHtml(statusLabel(reservation.status))}</td><td>${timestampText(reservation.updatedAt || reservation.createdAt)}</td></tr>`;
    const filterBar = `<div class="list-filter"><select id="reservationDate"><option value="all">すべての公演日</option>${dates.map(date => `<option value="${escapeHtml(date)}" ${filter.reservationDate === date ? 'selected' : ''}>${escapeHtml(date)}</option>`).join('')}</select><span class="filter-count">${reservations.length}件</span></div>`;
    return pageHead('RESERVATION', '予約一覧を公演日で確認できます。') + `<section class="card">${filterBar}${table(reservations, ['公演日','イベント','ユーザー名','お目当てのアーティスト','枚数','状態','更新日'], row, '予約はまだありません。')}</section>`;
  }
  function reportPage() {
    const catalogRows = ERROR_TYPE_CATALOG.map(([code, category, type, action]) => `<tr><td><code>${escapeHtml(code)}</code></td><td>${escapeHtml(category)}</td><td>${escapeHtml(type)}</td><td>${escapeHtml(action)}</td></tr>`).join('');
    const directReports = [...state.data.errorReports];
    const reportIds = new Set(directReports.map(report => report.id));
    const logFallbacks = state.data.adminLogs.filter(log => log.actionType === 'ERROR_REPORT_CREATE' && !reportIds.has(log.targetId)).map(log => ({ id:`log-${log.id}`, createdAt:log.createdAt, source:'SYSTEM LOG', area:'—', action:log.detail || 'エラー報告', errorCode:log.targetLabel || 'ERROR_REPORT_CREATE', message:'errorReportsの詳細を取得できないため、変更履歴から表示しています。', displayName:log.adminDisplayName || 'SYSTEM', status:'log-only', isLogFallback:true }));
    const reports = [...directReports, ...logFallbacks].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const openCount = reports.filter(report => report.status !== 'resolved').length;
    const loadError = state.collectionErrors.errorReports ? `<p class="banner">errorReportsの読み込みに失敗しました。権限または接続を確認してください。変更履歴にある報告のみ補助表示しています。</p>` : '';
    const row = report => `<tr><td>${timestampText(report.createdAt)}</td><td>${escapeHtml(report.source || 'LA_OS')}</td><td>${escapeHtml(report.area || '—')}</td><td>${escapeHtml(report.action || '—')}</td><td>${escapeHtml(report.errorCode || 'unknown')}</td><td>${escapeHtml(report.message || '—')}</td><td>${escapeHtml(report.displayName || report.memberId || '—')}</td><td>${escapeHtml(report.status || 'new')}</td><td>${report.isLogFallback ? '<span class="tag off">LOG</span>' : (report.status !== 'resolved' ? `<button class="secondary" data-report-resolve="${report.id}">解決済みにする</button>` : '<span class="tag off">RESOLVED</span>')}</td></tr>`;
    return pageHead('REPORT', 'LA_OSから届いたエラー報告と、発生しうるエラー種別を確認します。', `<span class="tag off">未解決 ${openCount}</span>`) + `<section class="card"><details class="error-type-catalog"><summary><span>LA_OS エラー種別一覧</span><small>${ERROR_TYPE_CATALOG.length} 種</small></summary><div class="error-type-catalog-body"><p class="sub">展開すると、エラーコード・分類・案内内容を確認できます。</p><div class="table-wrap"><table><thead><tr><th>コード</th><th>分類</th><th>種類</th><th>案内内容</th></tr></thead><tbody>${catalogRows}</tbody></table></div></div></details></section>${loadError}<section class="card"><h2>受信済み報告</h2>${table(reports, ['日時','送信元','画面','操作','コード','内容','ユーザー','状態','操作'], row, '報告はありません。')}</section>`;
  }
  function onboxPage() {
    const artists = state.data.artists.length ? state.data.artists : [{ id:'', artistKey:'ART-0000', name:'アーティスト未登録' }];
    const options = artists.map(artist => `<option value="${escapeHtml(artist.id)}">${escapeHtml(artist.artistKey)} / ${escapeHtml(artist.name)}</option>`).join('');
    const slot = (start, end) => `<div class="onbox-slot"><label>開始<input type="time" value="${start}"></label><label>終了<input type="time" value="${end}"></label><label class="onbox-artist">アーティストキー<select>${options}</select></label><span class="tag">待機</span><button class="text-button" type="button" data-onbox-remove>×</button></div>`;
    return pageHead('ONBOX 配信設定', '配信当日の設定・進行・コメントモデレーションを管理します。', '<span class="onbox-ui-only">UI PREVIEW</span>') +
      `<section class="card"><h2>1. 配信日程</h2><div class="form-grid"><label class="field">配信日<input type="date"></label><label class="field">配信タイトル<input placeholder="例：LA ONBOX #01"></label><label class="field wide">配信URL<input type="url" placeholder="配信URLは接続実装時に使用します"></label></div></section>` +
      `<section class="card"><div class="onbox-section-head"><div><h2>2. タイムテーブル</h2><p class="sub">アーティストキーの選択内容を、出演者表示へ同期する想定です。</p></div><button class="secondary" type="button" data-onbox-add-slot>枠を追加</button></div><div id="onboxTimetable" class="onbox-timetable">${slot('18:00','18:30')}${slot('18:35','19:05')}${slot('19:10','19:40')}</div></section>` +
      `<section class="onbox-grid"><section class="card"><h2>3. 背景・出演者表示</h2><div class="onbox-background-preview">BACKGROUND PREVIEW</div><label class="field">背景画像<input type="file" accept="image/png,image/jpeg,image/webp"></label><p class="sub">背景画像保存とアーティスト写真同期は、配信機能接続時に有効化します。</p></section><section class="card"><h2>4. オンエア制御</h2><div class="onbox-onair"><span class="onbox-live-dot"></span><strong>ON AIR PREVIEW</strong></div><audio controls class="onbox-audio"></audio><div class="onbox-control-actions"><button class="primary" type="button" data-onbox-action="listen">オンエアを聴く</button><button class="secondary" type="button" data-onbox-action="next">次の配信者へ強制切替</button><button class="danger" type="button" data-onbox-action="stop">配信を停止</button></div></section></section>` +
      `<section class="card"><div class="onbox-section-head"><div><h2>5. コメントのリアルタイムモデレーション</h2><p class="sub">オンエア中のコメントとユーザーIDを確認し、コメント単位の非表示またはユーザー単位のコメント禁止を行う想定です。</p></div><span class="tag">UIモック</span></div><div class="table-wrap"><table><thead><tr><th>受信時刻</th><th>ユーザーID</th><th>表示名</th><th>コメント</th><th>状態</th><th>操作</th></tr></thead><tbody><tr><td>18:22:15</td><td>MEM-7K2P</td><td>LA MEMBER</td><td>最高！</td><td><span class="tag">表示中</span></td><td class="onbox-row-actions"><button class="secondary" type="button" data-onbox-comment="hide">非表示</button><button class="danger" type="button" data-onbox-comment="ban">コメント禁止</button></td></tr><tr><td>18:24:03</td><td>MEM-A4X9</td><td>APOCALYPSE</td><td>音が少し小さいかもです</td><td><span class="tag off">確認中</span></td><td class="onbox-row-actions"><button class="secondary" type="button" data-onbox-comment="show">表示</button><button class="danger" type="button" data-onbox-comment="ban">コメント禁止</button></td></tr></tbody></table></div><p class="onbox-note">コメント禁止はユーザーIDに紐づけ、解除時刻・実行者・理由を記録する設計を想定しています。</p></section>` +
      `<section class="onbox-grid"><section class="card"><div class="onbox-section-head"><div><h2>6. コメントアーカイブ</h2><p class="sub">イベント終了後は配信日ごとにコメントを確認し、必要に応じて削除できる想定です。</p></div><button class="secondary" type="button" data-onbox-archive="open">アーカイブを表示</button></div><label class="field onbox-filter-field">対象配信日<input type="date"></label><div class="onbox-archive-list"><div><span>2026/07/19 19:12</span><strong>MEM-7K2P</strong><p>とても楽しかったです！</p><button class="danger" type="button" data-onbox-archive="delete">アーカイブから削除</button></div><div><span>2026/07/19 20:05</span><strong>MEM-A4X9</strong><p>次回も楽しみにしています。</p><button class="danger" type="button" data-onbox-archive="delete">アーカイブから削除</button></div></div></section><section class="card"><div class="onbox-section-head"><div><h2>7. ENERGY 履歴</h2><p class="sub">投げ銭（ENERGY）は配信日ごとに記録し、運用画面からは原則削除不可とします。</p></div><span class="tag">削除不可</span></div><label class="field onbox-filter-field">対象配信日<input type="date"></label><div class="table-wrap"><table><thead><tr><th>時刻</th><th>ユーザーID</th><th>対象</th><th>ENERGY</th><th>メッセージ</th></tr></thead><tbody><tr><td>18:31</td><td>MEM-7K2P</td><td>ART-0001</td><td class="onbox-energy">+500</td><td>応援しています！</td></tr><tr><td>19:08</td><td>MEM-A4X9</td><td>ART-0002</td><td class="onbox-energy">+1,000</td><td>最高のステージ！</td></tr></tbody></table></div><p class="onbox-note">履歴には決済ID・付与先・金額・日時・送信者IDを保存する前提です。</p></section></section>`;
  }
  function progressPage() {
    const selected = state.selectedMember;
    const choices = state.data.members.filter(member => member.accountStatus !== 'deleted').sort((a,b) => String(a.displayName).localeCompare(String(b.displayName)));
    const reasonOptions = [['ログイン',1],['DANMAKU送信',2],['SIGNAL送信',3],['来場',10],['物販：小物',5],['物販：ドリンク',10],['物販：アーカイブライセンス',25],['物販：アパレル',60],['イベント特典',50],['運営調整','']];
    return pageHead('PROGRESS', 'メンバーを選択し、付与内容を確認してから実行します。') + `<section class="split"><section class="card"><h2>1. メンバー選択</h2><label class="field">MEMBER IDを直接入力<input id="progressMemberId" value="${escapeHtml(selected ? selected.memberId : '')}" placeholder="例：A7K2"></label><button class="secondary" data-action="progress-id-select">IDで選択</button><label class="field">登録済みメンバーから選択<select id="progressMemberList"><option value="">選択してください</option>${choices.map(member => `<option value="${member.id}" ${selected && member.id === selected.id ? 'selected' : ''}>${escapeHtml(member.memberId)} / ${escapeHtml(member.displayName)}</option>`).join('')}</select></label>${selected ? `<p><strong>${escapeHtml(selected.displayName)}</strong><br>${escapeHtml(selected.memberId)} / ${level(selected.progress).label} / ${Number(selected.progress || 0)} pt</p>` : '<p class="sub">対象メンバーを選択してください。</p>'}</section><form class="card" id="progressForm"><h2>2. PROGRESS付与</h2><div class="preset-grid">${[1,2,3,5,10,25,50,60,100,300,500].map(value => `<button type="button" class="secondary" data-progress-preset="${value}">+${value}</button>`).join('')}</div><label class="field">付与ポイント<input name="amount" type="number" min="1" required></label><label class="field">理由<select name="reason" required><option value="">選択してください</option>${reasonOptions.map(([label, value]) => `<option value="${escapeHtml(label)}" data-points="${value}">${escapeHtml(label)}${value !== '' ? `（+${value}）` : ''}</option>`).join('')}</select></label><button class="primary" ${selected ? '' : 'disabled'}>確認して付与</button></form></section>`;
  }
  // These helpers only expose the server-authored audit record. They never classify or calculate points in the browser.
  function auditValue(signal, keys, fallback = '') { for (const key of keys) { const value = key.split('.').reduce((item, part) => item && item[part], signal); if (value !== undefined && value !== null && value !== '') return value; } return fallback; }
  function auditAxes(signal) { const axes = auditValue(signal, ['commentAxes','classification.axes','axes','axisScores','radarAxes'], {}); return axes && typeof axes === 'object' && !Array.isArray(axes) ? axes : {}; }
  function auditSourceKey(signal) { const source = String(auditValue(signal, ['source','submissionSource'], '')).toLowerCase(); return source === 'lp_public' ? 'lp' : source; }
  function auditStatus(signal) { return auditValue(signal, ['classificationStatus','commentClassificationStatus','commentStatus','classification.status','moderationStatus'], '—'); }
  function auditBonus(signal) { return Number(auditValue(signal, ['commentBonusPoints','commentAdditionalPoints','commentPoints','additionalPoints','commentAxisPoints'], 0)) || 0; }
  function auditReason(signal) { return auditValue(signal, ['classificationReason','unclassifiedReason','blockedReason','errorReason','processingError','classification.reason','moderationReasons'], '—'); }
  function auditAxisText(signal) { const axes = auditAxes(signal); const entries = Object.entries(axes); return entries.length ? entries.map(([name, value]) => `${name}: ${value}`).join(' / ') : '—'; }
  function signalPage() {
    const artist = state.selectedArtist, filter = state.filters;
    const axisNames = [...new Set(state.data.artistSignals.flatMap(signal => Object.keys(auditAxes(signal))))].sort();
    const signals = (artist ? state.data.artistSignals.filter(signal => [signal.artistId, signal.artistKey].map(value => String(value || '')).filter(Boolean).some(value => [artist.id, artist.artistKey].map(item => String(item || '')).includes(value))) : [])
      .filter(signal => state.showDeletedSignals || !signal.isDeleted)
      .filter(signal => filter.signalSource === 'all' || auditSourceKey(signal) === filter.signalSource)
      .filter(signal => filter.signalStatus === 'all' || String(auditStatus(signal)).toLowerCase() === filter.signalStatus)
      .filter(signal => filter.signalBonus === 'all' || (filter.signalBonus === 'added' ? auditBonus(signal) > 0 : auditBonus(signal) === 0))
      .filter(signal => filter.signalAxis === 'all' || Object.prototype.hasOwnProperty.call(auditAxes(signal), filter.signalAxis))
      .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
    const statuses = [...new Set(state.data.artistSignals.map(auditStatus).filter(value => value !== '—'))].sort();
    const filterBar = `<div class="signal-audit-filters"><label class="field">投稿元<select id="signalSource"><option value="all">すべて</option><option value="lp" ${filter.signalSource === 'lp' ? 'selected' : ''}>LP</option><option value="os" ${filter.signalSource === 'os' ? 'selected' : ''}>OS</option></select></label><label class="field">分類状態<select id="signalStatus"><option value="all">すべて</option>${statuses.map(value => `<option value="${escapeHtml(String(value).toLowerCase())}" ${String(value).toLowerCase() === filter.signalStatus ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label class="field">コメント追加点<select id="signalBonus"><option value="all">すべて</option><option value="added" ${filter.signalBonus === 'added' ? 'selected' : ''}>加点あり</option><option value="none" ${filter.signalBonus === 'none' ? 'selected' : ''}>加点なし</option></select></label><label class="field">6軸<select id="signalAxis"><option value="all">すべて</option>${axisNames.map(value => `<option value="${escapeHtml(value)}" ${value === filter.signalAxis ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><span class="filter-count">${signals.length}件</span></div>`;
    const body = !artist ? '<p class="empty">アーティストを選択してください。</p>' : table(signals, ['投稿日時','投稿元','MEMBER ID','3択','3択加点','OSコメント','分類状態','6軸','コメント追加点','理由','処理済み日時','判定ルール版','操作'], signal => `<tr><td>${timestampText(signal.createdAt)}</td><td>${escapeHtml(auditValue(signal, ['source','submissionSource'], '—'))}</td><td>${escapeHtml(signal.memberId || signal.memberUid || '—')}<br><small>${escapeHtml(signal.memberDisplayName || '')}</small></td><td>${escapeHtml(signal.signalType || '—')}</td><td>${escapeHtml(auditValue(signal, ['signalPoints','choicePoints','basePoints','threeChoicePoints','baseSignalPoints'], '—'))}</td><td class="signal-comment">${escapeHtml(auditValue(signal, ['comment','osComment'], '—'))}</td><td><span class="tag ${String(auditStatus(signal)).toLowerCase() === 'unclassified' ? 'off' : ''}">${escapeHtml(auditStatus(signal))}</span></td><td class="signal-axes">${escapeHtml(auditAxisText(signal))}</td><td>${auditBonus(signal)}</td><td class="signal-reason">${escapeHtml(auditReason(signal))}</td><td>${timestampText(auditValue(signal, ['processedAt','classificationProcessedAt','commentProcessedAt'], null))}</td><td>${escapeHtml(auditValue(signal, ['classificationRuleVersion','ruleVersion','classification.ruleVersion'], '—'))}</td><td>${signal.isDeleted ? `<button class="secondary" data-signal-restore="${signal.id}">復元</button>` : `<button class="danger" data-signal-delete="${signal.id}">削除</button>`}</td></tr>`, '条件に一致するSIGNALはありません。');
    return pageHead('SIGNAL', 'Functions / Firestore が確定した投稿・分類・加点監査情報を表示します。ブラウザ側では判定・集計を行いません。') + `<section class="card"><label class="field">アーティスト<select id="signalArtist"><option value="">選択してください</option>${state.data.artists.map(item => `<option value="${item.id}" ${artist && item.id === artist.id ? 'selected' : ''}>${escapeHtml(item.artistKey)} / ${escapeHtml(item.name)}</option>`).join('')}</select></label><label><input type="checkbox" id="signalDeletedToggle" ${state.showDeletedSignals ? 'checked' : ''}> 削除済みを表示</label></section><section class="card">${artist ? filterBar : ''}${body}</section>`;
  }
  function logPage() {
    const actions = [...new Set(state.data.adminLogs.map(log => log.actionType))];
    return pageHead('CHANGE LOG', '主要な操作履歴（読み取り専用）') + `<section class="card"><div class="form-grid"><label class="field">操作種別<select id="logAction"><option value="">すべて</option>${actions.map(action => `<option>${escapeHtml(action)}</option>`).join('')}</select></label><label class="field">対象検索<input id="logSearch" placeholder="対象名で検索"></label><label class="field">開始日<input id="logFrom" type="date"></label><label class="field">終了日<input id="logTo" type="date"></label></div></section><section class="card"><div id="logTable">${renderLogs()}</div></section>`;
  }
  function renderLogs() { return table([...state.data.adminLogs].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))), ['日時','管理者','操作','対象','詳細'], log => `<tr><td>${timestampText(log.createdAt)}</td><td>${escapeHtml(log.adminDisplayName)}</td><td>${escapeHtml(log.actionType)}</td><td>${escapeHtml(log.targetLabel)}</td><td>${escapeHtml(log.detail)}</td></tr>`); }
  function actionMenu(content) { return `<details class="action-menu"><summary>操作</summary><div class="action-menu-body">${content}</div></details>`; }
  function filterText(item, keys, query) { return !query || keys.some(key => String(item[key] || '').toLowerCase().includes(query.toLowerCase())); }
  function eventPage() {
    const filter = state.filters;
    const matches = event => filterText(event, ['title','venue','eventDate'], filter.eventSearch) && (filter.eventStatus === 'all' || (filter.eventStatus === 'published' ? event.environment === 'prod' && event.lpVisible : event.environment !== 'prod' || !event.lpVisible));
    const active = state.data.events.filter(event => event.status !== 'archived' && matches(event)).sort((a,b) => String(a.eventDate).localeCompare(String(b.eventDate)));
    const archived = state.data.events.filter(event => event.status === 'archived' && matches(event));
    const row = event => `<tr><td>${escapeHtml(event.title)}</td><td>${escapeHtml(event.eventDate)}</td><td>${escapeHtml(event.venue)}</td><td>${event.environment === 'prod' && event.lpVisible ? '公開中' : 'DEV / 非公開'}</td><td><button class="primary compact" data-event-edit="${event.id}">編集</button>${actionMenu(`<button class="secondary" data-event-publish="${event.id}">${event.environment === 'prod' ? 'DEVへ戻す' : '本番公開'}</button>${event.status === 'archived' ? `<button class="secondary" data-event-restore="${event.id}">復元</button>` : `<button class="secondary" data-event-archive="${event.id}">アーカイブ</button>`}<button class="danger" data-event-delete="${event.id}">削除</button>`)}</td></tr>`;
    const filterBar = `<div class="list-filter"><input id="eventSearch" value="${escapeHtml(filter.eventSearch)}" placeholder="タイトル・会場・開催日で検索"><select id="eventStatus"><option value="all">公開状態：すべて</option><option value="published" ${filter.eventStatus === 'published' ? 'selected' : ''}>LP公開中</option><option value="private" ${filter.eventStatus === 'private' ? 'selected' : ''}>DEV / 非公開</option></select><span class="filter-count">${active.length}件</span></div>`;
    return pageHead('EVENT', 'イベント管理', '<button class="primary" data-action="event-new">新規イベントを追加</button>') + `<section class="card"><h2>開催予定</h2>${filterBar}${table(active, ['タイトル','開催日','会場','LP','操作'], row)}</section><details class="card"><summary>アーカイブ済み（${archived.length}件）</summary>${table(archived, ['タイトル','開催日','会場','LP','操作'], row, 'アーカイブ済みのイベントはありません。')}</details>`;
  }
  function artistPage() {
    const filter = state.filters;
    const artists = state.data.artists.filter(artist => filterText(artist, ['artistKey','name','genre'], filter.artistSearch) && (filter.artistRole === 'all' || artist.role === filter.artistRole));
    const row = artist => `<tr><td>${escapeHtml(artist.artistKey || '—')}</td><td>${escapeHtml(artist.name)}</td><td>${escapeHtml(artist.role || 'FRESH')}</td><td>${Number(artist.appearanceCount || 0)}</td><td>${escapeHtml(artist.genre || '—')}</td><td>${artist.environment === 'prod' && artist.lpVisible ? '公開中' : 'DEV / 非公開'}</td><td><button class="primary compact" data-artist-edit="${artist.id}">編集</button>${actionMenu(`<button class="secondary" data-artist-publish="${artist.id}">${artist.environment === 'prod' ? 'DEVへ戻す' : '本番公開'}</button><button class="danger" data-artist-delete="${artist.id}">削除</button>`)}</td></tr>`;
    return pageHead('ARTIST', 'アーティスト管理', '<button class="secondary" data-action="signal-aggregate-rebuild">SIGNAL集計を再構築</button><button class="primary" data-action="artist-new">新規アーティストを追加</button>') + `<section class="card"><div class="artist-theme-tools"><div><h2>画像テーマカラー</h2><p class="sub">画像から主要な色を抽出し、LPのアーティスト画像背景へ反映します。既存画像にも一括で適用できます。</p></div><button class="secondary" type="button" data-action="artist-theme-generate">登録済み画像から一括生成</button></div><div class="list-filter"><input id="artistSearch" value="${escapeHtml(filter.artistSearch)}" placeholder="名前・キー・ジャンルで検索"><select id="artistRole"><option value="all">ロール：すべて</option>${['REGULAR','CORE','FRESH','ORGANIZER'].map(role => `<option ${filter.artistRole === role ? 'selected' : ''}>${role}</option>`).join('')}</select><span class="filter-count">${artists.length}件</span></div>${table(artists, ['ARTIST KEY','名前','ロール','出演回数','ジャンル','LP','操作'], row)}</section>`;
  }
  function memberPage() {
    const filter = state.filters;
    const members = state.data.members.filter(member => filterText(member, ['memberId','displayName','email'], filter.memberSearch) && (filter.memberStatus === 'all' || member.accountStatus !== 'deleted'));
    const row = member => { const version = level(member.progress); return `<tr><td>${escapeHtml(member.memberId)}</td><td>${escapeHtml(member.displayName)}</td><td>${version.label}</td><td>${escapeHtml(member.email)}</td><td>${member.emailVerified ? '認証済み' : '未認証'}</td><td>${Number(member.progress || 0)} pt</td><td>${escapeHtml(member.licenseType || 'NONE')}</td><td>${escapeHtml(member.accountStatus || 'active')}</td><td><button class="primary compact" data-member-select="${member.id}">詳細</button>${member.accountStatus !== 'deleted' ? actionMenu(`<button class="danger" data-member-delete="${member.id}">削除</button>`) : ''}</td></tr>`; };
    const current = state.selectedMember ? memberDetailPanel(state.selectedMember) : '';
    return pageHead('MEMBER', 'メンバー情報はFirebase Authenticationと連携しています。') + `<section class="card"><div class="list-filter"><input id="memberSearch" value="${escapeHtml(filter.memberSearch)}" placeholder="ID・表示名・メールで検索"><select id="memberStatus"><option value="active">有効メンバー</option><option value="all" ${filter.memberStatus === 'all' ? 'selected' : ''}>削除履歴を含む</option></select><span class="filter-count">${members.length}件</span></div>${table(members, ['MEMBER ID','表示名','VERSION','メール','認証','PROGRESS','ライセンス','状態','操作'], row)}</section>${current}`;
  }
  function memberDetailPanel(member) {
    const version = level(member.progress), signals = memberSignals(member), licenseType = member.licenseType || 'NONE';
    const isDeleted = member.accountStatus === 'deleted', financeLocked = member.financeLocked !== false;
    const deletedInfo = isDeleted ? `<p class="sub">削除日：${timestampText(member.deletedAt)} ／ 実行者：${escapeHtml(member.deletedBy || '記録なし')}</p>` : '';
    const restoredInfo = member.restoredAt ? `<p class="sub">復元日：${timestampText(member.restoredAt)} ／ 実行者：${escapeHtml(member.restoredBy || '記録なし')}</p>` : '';
    const dates = `<dl class="detail-list"><div><dt>Firebase UID</dt><dd>${escapeHtml(member.id)}</dd></div><div><dt>登録日</dt><dd>${timestampText(member.registeredAt || member.createdAt)}</dd></div><div><dt>最終更新日</dt><dd>${timestampText(member.updatedAt)}</dd></div><div><dt>最終ログイン日</dt><dd>${timestampText(member.lastLoginAt)}</dd></div></dl>`;
    const progress = `<dl class="detail-list"><div><dt>現在VERSION</dt><dd>${version.label}</dd></div><div><dt>総PROGRESS</dt><dd>${numberText(member.progress)} pt</dd></div><div><dt>現レベル開始後</dt><dd>${numberText(Number(member.progress || 0) - version.start)} pt</dd></div><div><dt>次のレベルに必要</dt><dd>${version.next ? `${numberText(version.next)} pt` : '到達済み'}</dd></div><div><dt>残り必要PROGRESS</dt><dd>${version.next ? `${numberText(Math.max(0, version.next - (Number(member.progress || 0) - version.start)))} pt` : '0 pt'}</dd></div></dl>`;
    const finance = `<section class="detail-section"><div class="detail-section-head"><h3>課金・ENERGY（モック）</h3><span class="tag ${financeLocked ? 'off' : ''}">${financeLocked ? 'ロック中' : '編集中'}</span></div><div class="form-grid"><label class="field">累計課金額（円）<input id="memberTotalPaid" type="number" min="0" step="1" value="${Number(member.totalPaidYen || 0)}" ${financeLocked ? 'disabled' : ''}></label><label class="field">ENERGY残高<input id="memberEnergyBalance" type="number" min="0" step="1" value="${Number(member.energyBalance || 0)}" ${financeLocked ? 'disabled' : ''}></label></div>${financeLocked ? '<button class="secondary" data-member-finance-edit="true">編集</button>' : '<button class="primary" data-member-finance-lock="true">保存してロック</button>'}</section>`;
    return `<section class="card member-detail"><h2>メンバー詳細：${escapeHtml(member.displayName || '名称未設定')}</h2><p>${escapeHtml(member.memberId || 'MEMBER ID未設定')} ／ ${escapeHtml(member.email || 'メール未設定')}</p>${deletedInfo}${restoredInfo}<section class="detail-section"><h3>アカウント情報</h3>${dates}</section><section class="detail-section"><h3>PROGRESS</h3>${progress}</section><section class="detail-section"><h3>利用状況</h3><dl class="detail-list"><div><dt>SIGNAL利用数</dt><dd>${signals.active}件</dd></div><div><dt>SIGNAL総送信数（削除済み含む）</dt><dd>${signals.total}件</dd></div><div><dt>アーカイブライセンス</dt><dd>${licenseType} ／ ${licenseDescription(licenseType)}</dd></div></dl></section><section class="detail-section"><h3>ライセンス変更</h3><label class="field">ライセンス<select id="licenseSelect" ${isDeleted ? 'disabled' : ''}>${['NONE','STANDARD','PREMIUM'].map(value => `<option ${licenseType === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>${isDeleted ? `<button class="primary" data-member-restore="${member.id}">復元する</button>` : '<button class="primary" data-action="license-save">ライセンスを変更</button>'}</section>${finance}</section>`;
  }
  function render() {
    if (!state.user || !state.view) return;
    const pages = { events: eventPage, reservations: reservationPage, artists: artistPage, members: memberPage, progress: progressPage, signals: signalPage, onbox: onboxPage, reports: reportPage, logs: logPage };
    $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
    $('#content').innerHTML = pages[state.view](); bindPage();
  }
  function formValue(form) { const values = Object.fromEntries(new FormData(form)); Object.entries(values).forEach(([key, value]) => { if (value instanceof File) delete values[key]; }); ['advancePrice','doorPrice','streamingPrice','specialAppearanceCount'].forEach(key => { if (key in values) values[key] = Number(values[key] || 0); }); values.lpVisible = values.lpVisible === 'true'; return values; }
  function eventForm(event = {}) { return `<form id="eventForm"><div class="form-grid"><label class="field">タイトル<input name="title" required value="${escapeHtml(event.title)}"></label><label class="field">開催日<input name="eventDate" type="date" required value="${escapeHtml(event.eventDate)}"></label><label class="field">会場<input name="venue" required value="${escapeHtml(event.venue)}"></label><label class="field">OPEN<input name="openTime" type="time" value="${escapeHtml(event.openTime)}"></label><label class="field">START<input name="startTime" type="time" value="${escapeHtml(event.startTime)}"></label><label class="field">前売料金<input name="advancePrice" type="number" min="0" value="${Number(event.advancePrice || 0)}"></label><label class="field">当日料金<input name="doorPrice" type="number" min="0" value="${Number(event.doorPrice || 0)}"></label><label class="field">配信料金<input name="streamingPrice" type="number" min="0" value="${Number(event.streamingPrice || 0)}"></label><label class="field">ツイキャスURL<input name="streamingUrl" type="url" value="${escapeHtml(event.streamingUrl)}"></label><label class="field">LP公開<select name="lpVisible"><option value="true" ${event.lpVisible !== false ? 'selected' : ''}>ON</option><option value="false" ${event.lpVisible === false ? 'selected' : ''}>OFF</option></select></label><div class="wide"><h3>出演アーティスト</h3><button class="secondary" type="button" data-action="event-artist-picker">アーティストを追加</button><div id="eventArtists" class="artist-list">${eventArtistTags(event.artistIds || [])}</div></div></div></form>`; }
  function eventArtistTags(ids) { return ids.map(id => state.data.artists.find(artist => artist.id === id)).filter(Boolean).map(artist => `<span class="artist-tag" draggable="true" data-artist-id="${artist.id}">${escapeHtml(artist.name)} <button type="button" class="text-button" data-event-artist-remove="${artist.id}" aria-label="${escapeHtml(artist.name)}を外す">×</button></span>`).join('') || '<p class="sub">出演アーティストは未設定です。</p>'; }
  function artistImageUrl(artist = {}) { return ['imageUrl','artistImageUrl','iconUrl','photoUrl','avatarUrl','image'].map(key => String(artist[key] || '').trim()).find(url => /^https?:\/\//i.test(url)) || ''; }
  function artistForm(artist = {}) { const roles = ['REGULAR','CORE','FRESH','ORGANIZER']; const themeColor = normalizeThemeColor(artist.imageThemeColor) || '#e8e8ec'; const imageUrl = artistImageUrl(artist); const imageState = imageUrl ? `<div class="artist-image-sync is-synced"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(artist.name || 'アーティスト画像')}のプレビュー"><div><strong>LPと同期済み</strong><span>Firestoreの画像URLを参照しています</span></div></div>` : `<div class="artist-image-sync"><div><strong>画像は未登録です</strong><span>アップロード後、LPと同じ画像URLを参照します</span></div></div>`; return `<form id="artistForm"><div class="form-grid"><label class="field">名前<input name="name" required value="${escapeHtml(artist.name)}"></label><label class="field">ロール<select name="role">${roles.map(role => `<option ${artist.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label><label class="field">ジャンル<input name="genre" value="${escapeHtml(artist.genre)}" placeholder="自由入力"></label><label class="field">過去出演特別カウント<input name="specialAppearanceCount" type="number" min="0" value="${Number(artist.specialAppearanceCount || 0)}"></label><label class="field wide">プロフィール<textarea name="profile">${escapeHtml(artist.profile)}</textarea></label><label class="field">X<input name="xUrl" type="url" value="${escapeHtml(artist.xUrl)}"></label><label class="field">YouTube<input name="youtubeUrl" type="url" value="${escapeHtml(artist.youtubeUrl)}"></label><label class="field">SNSリンク1<input name="snsUrl1" type="url" value="${escapeHtml(artist.snsUrl1)}"></label><label class="field">SNSリンク2<input name="snsUrl2" type="url" value="${escapeHtml(artist.snsUrl2)}"></label><label class="field">LP掲載<select name="lpVisible"><option value="true" ${artist.lpVisible !== false ? 'selected' : ''}>ON</option><option value="false" ${artist.lpVisible === false ? 'selected' : ''}>OFF</option></select></label><label class="field">アーティスト画像<input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="field">画像テーマカラー<input name="imageThemeColor" type="color" value="${themeColor}"></label></div>${imageState}<p class="sub">画像をアップロードするとテーマカラーを自動生成します。必要な場合のみ手動で調整してください。</p><p class="sub">イベント出演回数と過去出演特別カウントを合算して表示します。</p></form>`; }
  async function nextArtistKey() { return state.db.runTransaction(async transaction => { const ref = state.db.collection('counters').doc('artist'); const snap = await transaction.get(ref); const number = Number(snap.exists ? snap.data().value || 0 : 0) + 1; transaction.set(ref, { value: number }, { merge: true }); return `ART-${String(number).padStart(4,'0')}`; }); }
  async function uploadImage(file, folder) {
    if (!file) return null;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('storage/invalid-file');
    const ref = state.storage.ref().child(`${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    const task = ref.put(file, { contentType: file.type });
    return new Promise((resolve, reject) => task.on('state_changed', snapshot => setBanner(`画像をアップロード中：${Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)}%`), reject, async () => { setBanner(''); resolve(await task.snapshot.ref.getDownloadURL()); }));
  }
  function normalizeThemeColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : ''; }
  function imageToThemeColor(source) {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.crossOrigin = 'anonymous';
      image.onload = () => {
        const size = 84, scale = Math.min(size / image.naturalWidth, size / image.naturalHeight, 1);
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data, buckets = new Map();
        for (let index = 0; index < pixels.length; index += 16) {
          const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2], alpha = pixels[index + 3];
          const max = Math.max(red, green, blue), min = Math.min(red, green, blue), saturation = max ? (max - min) / max : 0;
          if (alpha < 220 || (max > 244 && min > 225) || max < 18) continue;
          const key = [red, green, blue].map(value => Math.min(240, Math.round(value / 24) * 24)).join(',');
          const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
          buckets.set(key, (buckets.get(key) || 0) + 0.45 + saturation * 1.3 + (luminance > 0.15 && luminance < 0.88 ? 0.25 : 0));
        }
        const selected = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
        if (!selected) { resolve('#e8e8ec'); return; }
        resolve(`#${selected[0].split(',').map(value => Number(value).toString(16).padStart(2, '0')).join('')}`);
      };
      image.onerror = () => reject(new Error('theme-image-load-failed'));
      image.src = source;
    });
  }
  function themeColorFromFile(file) { return imageToThemeColor(URL.createObjectURL(file)).finally(() => URL.revokeObjectURL(file)); }
  async function themeColorFromUrl(url) {
    try { const response = await fetch(url, { mode:'cors', cache:'no-store' }); if (!response.ok) throw new Error('theme-image-fetch-failed'); return themeColorFromFile(await response.blob()); }
    catch (fetchError) { const ref = state.storage.refFromURL(url); if (typeof ref.getBlob !== 'function') throw fetchError; return themeColorFromFile(await ref.getBlob()); }
  }
  async function generateArtistThemeColors() {
    const targets = state.data.artists.filter(artist => artistImageUrl(artist));
    if (!targets.length) { toast('画像が登録されたアーティストがいません。', true); return; }
    setBanner(`テーマカラーを生成中：${targets.length}件`);
    const token = await state.user.getIdToken();
    const response = await fetch(ARTIST_THEME_COLOR_ENDPOINT, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ data:{ artistIds:targets.map(artist => artist.id) } }) });
    const payload = await response.json().catch(() => ({}));
    setBanner('');
    if (!response.ok) throw new Error(payload?.error?.message || 'theme-color-generation-failed');
    const result = payload.data || {};
    await adminLog('ARTIST_THEME_COLOR_GENERATE', 'artist', '', `${Number(result.updated || 0)}/${targets.length}`, '登録済み画像からテーマカラーを一括生成');
    toast(Number(result.failed || 0) ? `${Number(result.updated || 0)}件を更新しました。${Number(result.failed || 0)}件は画像URLを確認してください。` : `${Number(result.updated || 0)}件のテーマカラーを更新しました。`);
  }
  function openEvent(event) {
    const isNew = !event; const draft = event ? { ...event, artistIds: [...(event.artistIds || [])] } : { artistIds: [], lpVisible: true };
    modal(isNew ? '新規イベント' : 'イベントを編集', eventForm(draft), async () => {
      const form = $('#eventForm'), values = formValue(form); values.artistIds = draft.artistIds; values.environment = event ? event.environment || state.environment : state.environment; values.updatedAt = serverTime();
      const file = form.elements.flyer && form.elements.flyer.files[0]; if (file) values.flyerUrl = await uploadImage(file, 'events');
      if (event) { await state.db.collection('events').doc(event.id).update(values); await adminLog('EVENT_UPDATE','event',event.id,values.title,'イベントを更新'); }
      else { values.status = 'active'; values.createdAt = serverTime(); const ref = await state.db.collection('events').add(values); await adminLog('EVENT_CREATE','event',ref.id,values.title,'イベントを作成'); }
      toast('イベントを保存しました。');
    });
    const imageField = document.createElement('label');
    imageField.className = 'field';
    imageField.innerHTML = 'フライヤー画像<input name="flyer" type="file" accept="image/png,image/jpeg,image/webp">';
    $('#eventForm .form-grid').append(imageField);
    const refreshTags = () => { $('#eventArtists').innerHTML = eventArtistTags(draft.artistIds); bindEventArtistTags(); };
    const bindEventArtistTags = () => $$('[data-event-artist-remove]').forEach(button => button.onclick = () => { draft.artistIds = draft.artistIds.filter(id => id !== button.dataset.eventArtistRemove); refreshTags(); });
    bindEventArtistTags();
    $('[data-action="event-artist-picker"]').onclick = () => openArtistPicker(draft, refreshTags);
  }
  function openArtistPicker(draft, refresh) {
    const tags = state.data.artists.map(artist => `<button type="button" class="artist-select-tag ${draft.artistIds.includes(artist.id) ? 'selected' : ''}" data-picker-id="${artist.id}">${escapeHtml(artist.name)} <small>${escapeHtml(artist.role || 'FRESH')}</small></button>`).join('');
    modal('アーティストを追加', `<p>タグをクリックして選択します。重複追加はされません。</p><div class="artist-picker">${tags || '<p class="empty">登録済みアーティストはいません。</p>'}</div><hr><label class="field">未登録アーティスト名<input id="quickArtistName" placeholder="名前だけで新規登録"></label><button type="button" class="secondary" id="quickArtistAdd">名前だけで新規追加</button>`, async () => { refresh(); toast('イベントの出演アーティストを更新しました。'); }, '追加を確定');
    $$('[data-picker-id]').forEach(button => button.onclick = () => { const id = button.dataset.pickerId; draft.artistIds = draft.artistIds.includes(id) ? draft.artistIds.filter(value => value !== id) : [...draft.artistIds, id]; button.classList.toggle('selected', draft.artistIds.includes(id)); });
    $('#quickArtistAdd').onclick = async () => {
      const name = $('#quickArtistName').value.trim(); if (!name) { toast('名前を入力してください。', true); return; }
      try { const key = await nextArtistKey(); const ref = await state.db.collection('artists').add({ artistKey:key, name, profileCompleted:false, role:'FRESH', lpVisible:false, environment:state.environment, specialAppearanceCount:0, appearanceCount:0, createdAt:serverTime(), updatedAt:serverTime() }); draft.artistIds = [...new Set([...draft.artistIds, ref.id])]; await adminLog('ARTIST_CREATE','artist',ref.id,name,'イベント編集から簡易登録'); toast('アーティストを追加しました。'); $('#modalRoot').innerHTML = ''; openArtistPicker(draft, refresh); } catch (error) { toast(errorMessage(error, 'アーティスト追加'), true); }
    };
  }
  function openArtist(artist) {
    const isNew = !artist;
    modal(isNew ? '新規アーティスト' : 'アーティストを編集', artistForm(artist || { lpVisible:true, role:'FRESH' }), async () => {
      const form = $('#artistForm'), values = formValue(form); values.updatedAt = serverTime(); values.environment = artist ? artist.environment || state.environment : state.environment;
      const special = Number(values.specialAppearanceCount || 0), eventCount = state.data.events.filter(event => (event.artistIds || []).includes(artist && artist.id)).length; values.eventAppearanceCount = eventCount; values.appearanceCount = eventCount + special;
      const file = form.elements.image.files[0]; if (file) { values.imageThemeColor = await themeColorFromFile(file); values.imageUrl = await uploadImage(file, 'artists'); }
      else if (artistImageUrl(artist)) values.imageUrl = artistImageUrl(artist);
      values.imageThemeColor = normalizeThemeColor(values.imageThemeColor) || '#e8e8ec';
      if (artist) { await state.db.collection('artists').doc(artist.id).update(values); await adminLog('ARTIST_UPDATE','artist',artist.id,values.name,'アーティストを更新'); }
      else { values.artistKey = await nextArtistKey(); values.createdAt = serverTime(); const ref = await state.db.collection('artists').add(values); await adminLog('ARTIST_CREATE','artist',ref.id,values.name,'アーティストを作成'); }
      toast('アーティストを保存しました。');
    });
  }
  async function setEnvironment(collection, item, environment) { const warning = environment === 'prod' ? '本番公開します。LPへ表示される設定です。' : '開発環境へ戻します。'; confirmAction(environment === 'prod' ? '本番公開' : 'DEVへ戻す', warning, async () => { await state.db.collection(collection).doc(item.id).update({ environment, updatedAt:serverTime() }); await adminLog(collection === 'events' ? 'EVENT_UPDATE' : 'ARTIST_UPDATE', collection.slice(0,-1), item.id, item.title || item.name, `environment を ${environment} に変更`); localStorage.setItem('la-admin-environment', environment); toast('環境設定を更新しました。'); }, environment === 'prod' ? '本番公開する' : 'DEVへ戻す'); }
  async function rebuildSignalAggregates() {
    const functionsApi = typeof firebase.functions === 'function' ? firebase.functions() : null;
    if (!functionsApi) throw new Error('functions-unavailable');
    const result = await functionsApi.httpsCallable('rebuildSignalAggregates')({});
    const data = result?.data || {};
    toast(`SIGNAL集計を再構築しました（${Number(data.includedSignals || 0)}件）。`);
  }
  function bindPage() {
    $('[data-action="event-new"]') && ($('[data-action="event-new"]').onclick = () => openEvent());
    $('[data-action="artist-new"]') && ($('[data-action="artist-new"]').onclick = () => openArtist());
    $('[data-action="signal-aggregate-rebuild"]') && ($('[data-action="signal-aggregate-rebuild"]').onclick = () => confirmAction('SIGNAL集計を再構築', '有効な本番SIGNAL原票から全アーティストの六軸集計を再計算します。', rebuildSignalAggregates, '再構築する'));
    $('[data-action="artist-theme-generate"]') && ($('[data-action="artist-theme-generate"]').onclick = () => confirmAction('画像テーマカラーを一括生成', '画像を登録済みの全アーティストへ、主要色を抽出して保存します。LPにも順次反映されます。', generateArtistThemeColors, '生成する'));
    $$('[data-event-edit]').forEach(button => button.onclick = () => openEvent(state.data.events.find(item => item.id === button.dataset.eventEdit)));
    $$('[data-artist-edit]').forEach(button => button.onclick = () => openArtist(state.data.artists.find(item => item.id === button.dataset.artistEdit)));
    $$('[data-event-publish]').forEach(button => button.onclick = () => setEnvironment('events', state.data.events.find(item => item.id === button.dataset.eventPublish), state.data.events.find(item => item.id === button.dataset.eventPublish).environment === 'prod' ? 'dev' : 'prod'));
    $$('[data-artist-publish]').forEach(button => button.onclick = () => setEnvironment('artists', state.data.artists.find(item => item.id === button.dataset.artistPublish), state.data.artists.find(item => item.id === button.dataset.artistPublish).environment === 'prod' ? 'dev' : 'prod'));
    $$('[data-event-archive]').forEach(button => button.onclick = () => confirmAction('イベントをアーカイブ', 'LPから非表示になります。', async () => { const item = state.data.events.find(event => event.id === button.dataset.eventArchive); await state.db.collection('events').doc(item.id).update({ status:'archived', updatedAt:serverTime() }); await adminLog('EVENT_ARCHIVE','event',item.id,item.title,'アーカイブ'); toast('アーカイブしました。'); }, 'アーカイブ'));
    $$('[data-event-restore]').forEach(button => button.onclick = () => confirmAction('イベントを復元', '開催予定へ戻します。', async () => { const item = state.data.events.find(event => event.id === button.dataset.eventRestore); await state.db.collection('events').doc(item.id).update({ status:'active', updatedAt:serverTime() }); await adminLog('EVENT_RESTORE','event',item.id,item.title,'復元'); toast('復元しました。'); }, '復元'));
    $$('[data-event-delete]').forEach(button => button.onclick = () => confirmAction('イベントを削除', '物理削除します。この操作は元に戻せません。', async () => { const item = state.data.events.find(event => event.id === button.dataset.eventDelete); await state.db.collection('events').doc(item.id).delete(); await adminLog('EVENT_DELETE','event',item.id,item.title,'物理削除'); toast('削除しました。'); }, '削除する'));
    $$('[data-artist-delete]').forEach(button => button.onclick = () => confirmAction('アーティストを削除', '物理削除します。この操作は元に戻せません。', async () => { const item = state.data.artists.find(artist => artist.id === button.dataset.artistDelete); await state.db.collection('artists').doc(item.id).delete(); await adminLog('ARTIST_DELETE','artist',item.id,item.name,'物理削除'); toast('削除しました。'); }, '削除する'));
    $$('[data-member-select]').forEach(button => button.onclick = () => { state.selectedMember = state.data.members.find(member => member.id === button.dataset.memberSelect); render(); });
    $$('[data-member-delete]').forEach(button => button.onclick = () => confirmAction('メンバーを削除', '削除履歴として一覧に残します。', async () => { const member = state.data.members.find(item => item.id === button.dataset.memberDelete); await state.db.collection('members').doc(member.id).update({ accountStatus:'deleted', deletedAt:serverTime(), deletedBy:state.user.uid, updatedAt:serverTime() }); await adminLog('MEMBER_DELETE','member',member.id,member.displayName,'論理削除'); toast('メンバーを削除しました。'); }, '削除する'));
    $$('[data-member-restore]').forEach(button => button.onclick = () => confirmAction('メンバーを復元', 'アカウント状態を有効へ戻します。削除履歴は保持されます。', async () => { const member = state.data.members.find(item => item.id === button.dataset.memberRestore); await state.db.collection('members').doc(member.id).update({ accountStatus:'active', restoredAt:serverTime(), restoredBy:state.user.uid, updatedAt:serverTime() }); await adminLog('MEMBER_RESTORE','member',member.id,member.displayName,'論理削除から復元'); toast('メンバーを復元しました。'); }, '復元する'));
    $$('[data-member-finance-edit]').forEach(button => button.onclick = () => confirmAction('課金・ENERGYの編集を開始', '数値欄のロックを解除します。編集後は保存して再ロックしてください。', async () => { const member = state.selectedMember; await state.db.collection('members').doc(member.id).update({ financeLocked:false, financeUnlockedAt:serverTime(), financeUnlockedBy:state.user.uid, updatedAt:serverTime() }); await adminLog('MEMBER_FINANCE_EDIT','member',member.id,member.displayName,'課金・ENERGY編集のロックを解除'); toast('編集を開始しました。'); }, 'ロックを解除'));
    $$('[data-member-finance-lock]').forEach(button => button.onclick = () => { const member = state.selectedMember, totalPaidYen = Number($('#memberTotalPaid').value), energyBalance = Number($('#memberEnergyBalance').value); if (!Number.isInteger(totalPaidYen) || totalPaidYen < 0 || !Number.isInteger(energyBalance) || energyBalance < 0) { toast('課金額とENERGYは0以上の整数で入力してください。', true); return; } confirmAction('課金・ENERGYを保存してロック', `${member.displayName} の累計課金額を ${numberText(totalPaidYen)}円、ENERGY残高を ${numberText(energyBalance)} に更新します。`, async () => { await state.db.collection('members').doc(member.id).update({ totalPaidYen, energyBalance, financeLocked:true, financeLockedAt:serverTime(), financeLockedBy:state.user.uid, updatedAt:serverTime() }); await adminLog('MEMBER_FINANCE_LOCK','member',member.id,member.displayName,`累計課金額 ${totalPaidYen}円 / ENERGY ${energyBalance}`); toast('課金・ENERGYを保存してロックしました。'); }, '保存してロック'); });
    $('[data-action="license-save"]') && ($('[data-action="license-save"]').onclick = () => { const value = $('#licenseSelect').value, member = state.selectedMember; confirmAction('ライセンスを変更', `${member.displayName} のライセンスを ${value} に変更します。`, async () => { await state.db.collection('members').doc(member.id).update({ licenseType:value, updatedAt:serverTime() }); await adminLog('LICENSE_CHANGE','member',member.id,member.displayName,`licenseType: ${value}`); toast('ライセンスを更新しました。'); }, '変更する'); });
    $('[data-action="progress-id-select"]') && ($('[data-action="progress-id-select"]').onclick = () => { const id = $('#progressMemberId').value.trim().toUpperCase(); const member = state.data.members.find(item => String(item.memberId).toUpperCase() === id); if (!member) { toast('一致するMEMBER IDがありません。', true); return; } state.selectedMember = member; render(); });
    $('#progressMemberList') && ($('#progressMemberList').onchange = event => { state.selectedMember = state.data.members.find(member => member.id === event.target.value) || null; render(); });
    $$('[data-progress-preset]').forEach(button => button.onclick = () => { $('#progressForm').elements.amount.value = button.dataset.progressPreset; });
    $('#progressForm') && ($('#progressForm').onsubmit = event => { event.preventDefault(); const form = event.currentTarget, amount = Number(form.elements.amount.value), reason = form.elements.reason.value; if (!Number.isInteger(amount) || amount < 1 || !reason) { toast('ポイントと理由を入力してください。', true); return; } const member = state.selectedMember, before = Number(member.progress || 0), after = before + amount; confirmAction('PROGRESSを付与', `${member.displayName}（${member.memberId}）へ付与します。現在：${before} pt / ${level(before).label} → 付与後：${after} pt / ${level(after).label}。理由：${reason}`, async () => { const memberRef = state.db.collection('members').doc(member.id), logRef = state.db.collection('progressLogs').doc(), adminRef = state.db.collection('adminLogs').doc(); await state.db.runTransaction(async transaction => { const snap = await transaction.get(memberRef); transaction.update(memberRef, { progress:Number(snap.data().progress || 0) + amount, updatedAt:serverTime() }); transaction.set(logRef, { memberUid:member.id, memberId:member.memberId, amount, reason, grantedBy:state.user.uid, createdAt:serverTime() }); transaction.set(adminRef, { actionType:'PROGRESS_ADD', targetType:'member', targetId:member.id, targetLabel:member.displayName, detail:`+${amount} / ${reason}`, adminUid:state.user.uid, adminDisplayName:state.user.displayName || state.user.email, createdAt:serverTime() }); }); toast('PROGRESSを付与しました。'); }, '付与する'); });
    $('#signalArtist') && ($('#signalArtist').onchange = event => { state.selectedArtist = state.data.artists.find(item => item.id === event.target.value) || null; render(); });
    $('#signalDeletedToggle') && ($('#signalDeletedToggle').onchange = event => { state.showDeletedSignals = event.target.checked; render(); });
    [['signalSource','signalSource'],['signalStatus','signalStatus'],['signalBonus','signalBonus'],['signalAxis','signalAxis']].forEach(([id, key]) => {
      const node = $(`#${id}`); if (!node) return;
      node.onchange = event => { state.filters[key] = event.target.value; render(); };
    });
    $$('[data-signal-delete]').forEach(button => button.onclick = () => confirmAction('SIGNALを削除', '削除済みとして非表示にします。', async () => { const item = state.data.artistSignals.find(signal => signal.id === button.dataset.signalDelete); await state.db.collection('artistSignals').doc(item.id).update({ isDeleted:true, deletedAt:serverTime(), deletedBy:state.user.uid }); await adminLog('SIGNAL_DELETE','signal',item.id,item.memberDisplayName || item.memberId,'論理削除'); toast('SIGNALを削除しました。'); }, '削除する'));
    $$('[data-signal-restore]').forEach(button => button.onclick = () => confirmAction('SIGNALを復元', '削除状態を解除します。', async () => { const item = state.data.artistSignals.find(signal => signal.id === button.dataset.signalRestore); await state.db.collection('artistSignals').doc(item.id).update({ isDeleted:false, deletedAt:null, deletedBy:null }); await adminLog('SIGNAL_RESTORE','signal',item.id,item.memberDisplayName || item.memberId,'復元'); toast('SIGNALを復元しました。'); }, '復元する'));
    $$('[data-report-resolve]').forEach(button => button.onclick = () => confirmAction('報告を解決済みにする', 'この報告を解決済みとして記録します。', async () => { const report = state.data.errorReports.find(item => item.id === button.dataset.reportResolve); await state.db.collection('errorReports').doc(report.id).update({ status:'resolved', resolvedAt:serverTime(), resolvedBy:state.user.uid }); await adminLog('ERROR_REPORT_RESOLVE','errorReport',report.id,report.errorCode || report.id,'解決済みに変更'); toast('報告を解決済みにしました。'); }, '解決済みにする'));
    $('[data-onbox-add-slot]') && ($('[data-onbox-add-slot]').onclick = () => { const first = $('#onboxTimetable .onbox-slot'); if (first) $('#onboxTimetable').insertAdjacentHTML('beforeend', first.outerHTML); });
    $$('[data-onbox-remove]').forEach(button => button.onclick = () => { const slots = $$('.onbox-slot'); if (slots.length > 1) button.closest('.onbox-slot').remove(); else toast('タイムテーブルには1枠以上必要です。', true); });
    $$('[data-onbox-action], [data-onbox-comment]').forEach(button => button.onclick = () => toast('ONBOXの実行処理は、配信基盤接続時に有効化します。'));
    ['logAction','logSearch','logFrom','logTo'].forEach(id => { const node = $(`#${id}`); if (node) node.oninput = filterLogs; });
    [['eventSearch','eventSearch'],['eventStatus','eventStatus'],['reservationDate','reservationDate'],['artistSearch','artistSearch'],['artistRole','artistRole'],['memberSearch','memberSearch'],['memberStatus','memberStatus']].forEach(([id, key]) => {
      const node = $(`#${id}`); if (!node) return;
      const apply = () => { state.filters[key] = node.value; render(); };
      node.onchange = apply;
      if (node.tagName === 'INPUT') node.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); apply(); } };
    });
  }
  function filterLogs() { const action = $('#logAction').value, search = $('#logSearch').value.toLowerCase(), from = $('#logFrom').value, to = $('#logTo').value; const filtered = state.data.adminLogs.filter(log => { const date = log.createdAt && log.createdAt.toDate ? log.createdAt.toDate().toISOString().slice(0,10) : ''; return (!action || log.actionType === action) && (!search || String(log.targetLabel || '').toLowerCase().includes(search)) && (!from || date >= from) && (!to || date <= to); }); $('#logTable').innerHTML = table(filtered, ['日時','管理者','操作','対象','詳細'], log => `<tr><td>${timestampText(log.createdAt)}</td><td>${escapeHtml(log.adminDisplayName)}</td><td>${escapeHtml(log.actionType)}</td><td>${escapeHtml(log.targetLabel)}</td><td>${escapeHtml(log.detail)}</td></tr>`); }
  async function isAdmin(user) { const [singular, plural] = await Promise.all([state.db.collection('admin').doc(user.uid).get(), state.db.collection('admins').doc(user.uid).get()]); return singular.exists || plural.exists; }
  function showSessionWaiting() { $('#loginView').hidden = false; $('#appView').hidden = true; }
  function redirectToLogin(reason) {
    sessionStorage.setItem('la-admin-exit-reason', reason);
    location.assign(ADMIN_LOGIN_URL);
  }
  function endExpiredSession() {
    clearTimeout(sessionTimer);
    firebase.auth().signOut().finally(() => redirectToLogin('timeout'));
  }
  function refreshSessionTimeout() {
    if (!state.user) return;
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(endExpiredSession, SESSION_TIMEOUT_MS);
  }
  async function start(user) {
    state.user = user;
    if (!await isAdmin(user)) { await firebase.auth().signOut(); redirectToLogin('role'); return; }
    $('#adminName').textContent = user.displayName || user.email || 'ADMIN'; $('#loginView').hidden = true; $('#appView').hidden = false;
    $('#environmentToggle').value = state.environment;
    collectionSnapshot('events'); collectionSnapshot('artists'); collectionSnapshot('members'); collectionSnapshot('reservations'); collectionSnapshot('artistSignals'); collectionSnapshot('errorReports'); collectionSnapshot('adminLogs');
    state.unsubscribers.push(state.db.collection('settings').doc('system').onSnapshot(snapshot => { state.settings = { ...state.settings, ...(snapshot.exists ? snapshot.data() : {}) }; const status = $('#systemStatus'); status.textContent = state.settings.systemEnabled === false ? 'SYSTEM: STOP' : 'SYSTEM: ON'; status.classList.toggle('off', state.settings.systemEnabled === false); }));
    render();
    refreshSessionTimeout();
  }
  function bindShell() {
    $$('.nav-item[data-view]').forEach(button => button.onclick = () => { state.view = button.dataset.view; $('.sidebar').classList.remove('open'); render(); });
    ['siteSettingsNav', 'danmakuReviewNav', 'lpDanmakuReviewNav'].forEach(id => {
      const button = $(`#${id}`);
      if (button) button.addEventListener('click', () => { state.view = null; });
    });
    $('#operationsButton').onclick = openOperations;
    $('#environmentToggle').onchange = event => { state.environment = event.target.value; localStorage.setItem('la-admin-environment', state.environment); toast(`新規データの環境を ${state.environment.toUpperCase()} に設定しました。`); };
    $('#themeButton').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('la-admin-theme', dark ? 'dark' : 'light'); $('#themeButton').textContent = dark ? 'Light' : 'Dark'; };
    $('#logoutButton').onclick = async () => { clearTimeout(sessionTimer); await firebase.auth().signOut(); if (ADMIN_LOGIN_URL) location.assign(ADMIN_LOGIN_URL); };
    $('#menuButton').onclick = () => $('.sidebar').classList.toggle('open');
  }
  async function init() {
    const savedTheme = localStorage.getItem('la-admin-theme'); if (savedTheme === 'dark') { document.documentElement.dataset.theme = 'dark'; $('#themeButton').textContent = 'Light'; }
    if (!window.FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) { setBanner('Firebase設定がありません。firebase-config.js を確認してください。'); return; }
    firebase.initializeApp(FIREBASE_CONFIG); state.db = firebase.firestore(); state.storage = firebase.storage(); bindShell();
    try { await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION); }
    catch (_) { setBanner('認証セッションを保存できません。localhost または本番URLから開いてください。'); }
    firebase.auth().onAuthStateChanged(async user => {
      state.unsubscribers.forEach(unsubscribe => unsubscribe()); state.unsubscribers = [];
      if (!user) { clearTimeout(sessionTimer); state.user = null; showSessionWaiting(); redirectToLogin('auth'); return; }
      try { await start(user); } catch (error) { showSessionWaiting(); redirectToLogin('error'); }
    });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => document.addEventListener(eventName, refreshSessionTimeout, { passive: true }));
  init();
})();
