/* global firebase, FIREBASE_CONFIG */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
  const timestampText = value => value && value.toDate ? value.toDate().toLocaleString('ja-JP') : (value || '?');
  const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();
  const ADMIN_LOGIN_URL = localStorage.getItem('la-admin-login-url') || 'login/index.html';
  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
  let sessionTimer = null;
  const state = {
    db: null, storage: null, user: null, view: 'events', busy: false,
    environment: localStorage.getItem('la-admin-environment') || 'dev',
    selectedMember: null, selectedArtist: null, showDeletedSignals: false,
    data: { events: [], artists: [], members: [], artistSignals: [], errorReports: [], adminLogs: [] },
    settings: { signalEnabled: true, systemEnabled: true }, unsubscribers: []
  };
  const ACTIONS = ['EVENT_CREATE','EVENT_UPDATE','EVENT_ARCHIVE','EVENT_RESTORE','EVENT_DELETE','ARTIST_CREATE','ARTIST_UPDATE','ARTIST_DELETE','MEMBER_DELETE','PROGRESS_ADD','LICENSE_CHANGE','SIGNAL_DELETE','SIGNAL_RESTORE','ERROR_REPORT_CREATE','ERROR_REPORT_RESOLVE'];
  state.filters = { eventSearch:'', eventStatus:'all', artistSearch:'', artistRole:'all', memberSearch:'', memberStatus:'active' };

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
      state.data[name] = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      if (state.view) render();
    }, error => { setBanner(errorMessage(error, 'データ取得')); }));
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
    const row = artist => `<tr><td>${escapeHtml(artist.artistKey || '?')}</td><td>${escapeHtml(artist.name)}</td><td>${escapeHtml(artist.role || 'FRESH')}</td><td>${Number(artist.appearanceCount || 0)}</td><td>${escapeHtml(artist.genre || '?')}</td><td>${artist.environment === 'prod' && artist.lpVisible ? '公開中' : 'DEV / 非公開'}</td><td class="actions"><button class="secondary" data-artist-edit="${artist.id}">編集</button><button class="secondary" data-artist-publish="${artist.id}">${artist.environment === 'prod' ? 'DEVへ戻す' : '本番公開'}</button><button class="danger" data-artist-delete="${artist.id}">削除</button></td></tr>`;
    return pageHead('ARTIST', 'アーティスト管理', '<button class="primary" data-action="artist-new">新規アーティストを追加</button>') + `<section class="card">${table(state.data.artists, ['ARTIST KEY','名前','ロール','出演回数','ジャンル','LP','操作'], row)}</section>`;
  }
  function memberPage() {
    const row = member => { const version = level(member.progress); return `<tr><td>${escapeHtml(member.memberId)}</td><td>${escapeHtml(member.displayName)}</td><td>${version.label}</td><td>${escapeHtml(member.email)}</td><td>${member.emailVerified ? '認証済み' : '未認証'}</td><td>${Number(member.progress || 0)} pt</td><td>${escapeHtml(member.licenseType || 'NONE')}</td><td>${escapeHtml(member.accountStatus || 'active')}</td><td><button class="secondary" data-member-select="${member.id}">選択</button><button class="danger" data-member-delete="${member.id}">削除</button></td></tr>`; };
    const current = state.selectedMember ? `<section class="card"><h2>選択中：${escapeHtml(state.selectedMember.displayName)}</h2><p>${escapeHtml(state.selectedMember.memberId)} / ${level(state.selectedMember.progress).label} / ${Number(state.selectedMember.progress || 0)} pt</p><label class="field">ライセンス<select id="licenseSelect">${['NONE','STANDARD','PREMIUM'].map(value => `<option ${state.selectedMember.licenseType === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="primary" data-action="license-save">ライセンスを変更</button></section>` : '';
    return pageHead('MEMBER', 'メンバー情報はFirebase Authenticationと連携しています。') + `<section class="card">${table(state.data.members, ['MEMBER ID','表示名','VERSION','メール','認証','PROGRESS','ライセンス','状態','操作'], row)}</section>${current}`;
  }
  function progressPage() {
    const selected = state.selectedMember;
    const choices = state.data.members.filter(member => member.accountStatus !== 'deleted').sort((a,b) => String(a.displayName).localeCompare(String(b.displayName)));
    const reasonOptions = [['ログイン',1],['DANMAKU送信',2],['SIGNAL送信',3],['来場',10],['物販：小物',5],['物販：ドリンク',10],['物販：アーカイブライセンス',25],['物販：アパレル',60],['イベント特典',50],['運営調整','']];
    return pageHead('PROGRESS', 'メンバーを選択し、付与内容を確認してから実行します。') + `<section class="split"><section class="card"><h2>1. メンバー選択</h2><label class="field">MEMBER IDを直接入力<input id="progressMemberId" value="${escapeHtml(selected ? selected.memberId : '')}" placeholder="例：A7K2"></label><button class="secondary" data-action="progress-id-select">IDで選択</button><label class="field">登録済みメンバーから選択<select id="progressMemberList"><option value="">選択してください</option>${choices.map(member => `<option value="${member.id}" ${selected && member.id === selected.id ? 'selected' : ''}>${escapeHtml(member.memberId)} / ${escapeHtml(member.displayName)}</option>`).join('')}</select></label>${selected ? `<p><strong>${escapeHtml(selected.displayName)}</strong><br>${escapeHtml(selected.memberId)} / ${level(selected.progress).label} / ${Number(selected.progress || 0)} pt</p>` : '<p class="sub">対象メンバーを選択してください。</p>'}</section><form class="card" id="progressForm"><h2>2. PROGRESS付与</h2><div class="preset-grid">${[1,2,3,5,10,25,50,60,100,300,500].map(value => `<button type="button" class="secondary" data-progress-preset="${value}">+${value}</button>`).join('')}</div><label class="field">付与ポイント<input name="amount" type="number" min="1" required></label><label class="field">理由<select name="reason" required><option value="">選択してください</option>${reasonOptions.map(([label, value]) => `<option value="${escapeHtml(label)}" data-points="${value}">${escapeHtml(label)}${value !== '' ? `（+${value}）` : ''}</option>`).join('')}</select></label><button class="primary" ${selected ? '' : 'disabled'}>確認して付与</button></form></section>`;
  }
  function signalPage() {
    const filter = state.filters;
    const signals = [...state.data.artistSignals]
      .filter(signal => state.showDeletedSignals || !signal.isDeleted)
      .filter(signal => filter.signalArtist === 'all' || signal.artistId === filter.signalArtist)
      .filter(signal => filter.signalType === 'all' || signal.signalType === filter.signalType)
      .filter(signal => filterText(signal, ['memberId', 'memberDisplayName', 'comment', 'artistName'], filter.signalSearch))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const stats = {
      total: state.data.artistSignals.length,
      visible: signals.length,
      deleted: state.data.artistSignals.filter(signal => signal.isDeleted).length,
    };
    const filterBar = `<div class="list-filter"><input id="signalSearch" value="${escapeHtml(filter.signalSearch)}" placeholder="MEMBER ID・表示名・コメントで検索"><select id="signalArtistFilter"><option value="all">全アーティスト</option>${state.data.artists.map(item => `<option value="${item.id}" ${filter.signalArtist === item.id ? 'selected' : ''}>${escapeHtml(item.artistKey)} / ${escapeHtml(item.name)}</option>`).join('')}</select><select id="signalTypeFilter"><option value="all">全種別</option>${['song','stage','character','other'].map(type => `<option value="${type}" ${filter.signalType === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select><span class="filter-count">${signals.length}件</span></div>`;
    const summary = `<div class="form-grid"><div class="summary">総数 ${stats.total}</div><div class="summary">表示中 ${stats.visible}</div><div class="summary">削除済み ${stats.deleted}</div><div class="summary">${state.showDeletedSignals ? '削除済み表示中' : '削除済み非表示'}</div></div>`;
    const body = table(signals, ['ARTIST','MEMBER ID','表示名','種別','コメント','送信日時','状態','操作'], signal => `<tr><td>${escapeHtml(signal.artistName || signal.artistId)}</td><td>${escapeHtml(signal.memberId)}</td><td>${escapeHtml(signal.memberDisplayName)}</td><td>${escapeHtml(signal.signalType)}</td><td>${escapeHtml(signal.comment)}</td><td>${timestampText(signal.createdAt)}</td><td>${signal.isDeleted ? '削除済み' : '表示中'}</td><td>${signal.isDeleted ? `<button class="secondary" data-signal-restore="${signal.id}">復元</button>` : `<button class="danger" data-signal-delete="${signal.id}">削除</button>`}</td></tr>`, 'SIGNALはありません。');
    return pageHead('SIGNAL', '受信したSIGNALを閲覧・削除・復元できます。') + `<section class="card">${summary}</section><section class="card">${filterBar}<label><input type="checkbox" id="signalDeletedToggle" ${state.showDeletedSignals ? 'checked' : ''}> 削除済みを表示</label></section><section class="card">${body}</section>`;
  }
  function reportPage() {
    const reports = [...state.data.errorReports].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const unresolved = reports.filter(report => report.status !== "resolved").length;
    const reportTone = report => {
      const category = String(report.errorCategory || "").toLowerCase();
      if (report.status === "resolved") return "report-row--resolved";
      if (category === "policy") return "report-row--policy";
      if (category === "validation") return "report-row--validation";
      if (category === "network") return "report-row--network";
      if (category === "auth") return "report-row--auth";
      return "report-row--backend";
    };
    const row = report => `<tr class="report-row ${reportTone(report)}"><td>${timestampText(report.createdAt)}</td><td>${escapeHtml(report.source || "laos")}</td><td>${escapeHtml(report.area || "system")}</td><td>${escapeHtml(report.action || "report")}</td><td><span class="report-code">${escapeHtml(report.errorCode || "unknown")}</span></td><td>${escapeHtml(report.message || "no message")}</td><td>${escapeHtml(report.displayName || report.memberId || "unknown")}</td><td><span class="report-status">${escapeHtml(report.status || "new")}</span></td><td>${report.status !== "resolved" ? `<button class="secondary" data-report-resolve="${report.id}">解決済み</button>` : `<span class="tag off">RESOLVED</span>`}</td></tr>`;
    const catalog = (window.LAErrorReporting?.codeCatalog || []).slice();
    const troubleshootingRows = catalog.map(item => `<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.situation)}</td><td>${escapeHtml(item.userAction)}</td></tr>`);
    return pageHead("REPORT", "送信ログと想定エラーを確認できます。", `<div class="report-summary"><span class="tag">TOTAL ${reports.length}</span><span class="tag off">OPEN ${unresolved}</span></div>`) +
      '<section class="card">' + table(reports, ["DATE","SOURCE","AREA","ACTION","CODE","MESSAGE","USER","STATUS","操作"], row, "No reports yet.") + '</section>' +
      '<section class="card"><h2>トラブルシューティング</h2><p class="sub">OS の送信失敗時に参照する想定エラーコード一覧です。</p>' +
      table(troubleshootingRows, ["CODE","CATEGORY","TITLE","SITUATION","USER ACTION"], item => item, "参照できるエラーコードがありません。") +
      '</section>';
  }
  function logPage() {
    const actions = [...new Set(state.data.adminLogs.map(log => log.actionType))];
    return pageHead('CHANGE LOG', '主要な操作履歴（読み取り専用）') + `<section class="card"><div class="form-grid"><label class="field">操作種別<select id="logAction"><option value="">すべて</option>${actions.map(action => `<option>${escapeHtml(action)}</option>`).join('')}</select></label><label class="field">対象検索<input id="logSearch" placeholder="対象名で検索"></label><label class="field">開始日<input id="logFrom" type="date"></label><label class="field">終了日<input id="logTo" type="date"></label></div></section><section class="card"><div id="logTable">${renderLogs()}</div></section>`;
  }
  function renderLogs() { return table([...state.data.adminLogs].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))), ['日時','管理者','操作','対象','詳細'], log => `<tr><td>${timestampText(log.createdAt)}</td><td>${escapeHtml(log.adminDisplayName)}</td><td>${escapeHtml(log.actionType)}</td><td>${escapeHtml(log.targetLabel)}</td><td>${escapeHtml(log.detail)}</td></tr>`); }
  function actionMenu(content) { return `<details class="action-menu"><summary>操作</summary><div class="action-menu-body">${content}</div></details>`; }
  function filterText(item, keys, query) { return !query || keys.some(key => String(item[key] || '').toLowerCase().includes(query.toLowerCase())); }
  function updateErrorBadge() {
    const badge = $('#errorReportBadge');
    if (!badge) return;
    const unread = state.data.errorReports.filter(report => report.status !== 'resolved').length;
    badge.textContent = `ERROR: ${unread}`;
    badge.classList.toggle('off', unread === 0);
  }
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
    const row = artist => `<tr><td>${escapeHtml(artist.artistKey || '?')}</td><td>${escapeHtml(artist.name)}</td><td>${escapeHtml(artist.role || 'FRESH')}</td><td>${Number(artist.appearanceCount || 0)}</td><td>${escapeHtml(artist.genre || '?')}</td><td>${artist.environment === 'prod' && artist.lpVisible ? '公開中' : 'DEV / 非公開'}</td><td><button class="primary compact" data-artist-edit="${artist.id}">編集</button>${actionMenu(`<button class="secondary" data-artist-publish="${artist.id}">${artist.environment === 'prod' ? 'DEVへ戻す' : '本番公開'}</button><button class="danger" data-artist-delete="${artist.id}">削除</button>`)}</td></tr>`;
    return pageHead('ARTIST', 'アーティスト管理', '<button class="primary" data-action="artist-new">新規アーティストを追加</button>') + `<section class="card"><div class="list-filter"><input id="artistSearch" value="${escapeHtml(filter.artistSearch)}" placeholder="名前・キー・ジャンルで検索"><select id="artistRole"><option value="all">ロール：すべて</option>${['REGULAR','CORE','FRESH','ORGANIZER'].map(role => `<option ${filter.artistRole === role ? 'selected' : ''}>${role}</option>`).join('')}</select><span class="filter-count">${artists.length}件</span></div>${table(artists, ['ARTIST KEY','名前','ロール','出演回数','ジャンル','LP','操作'], row)}</section>`;
  }
  function memberPage() {
    const filter = state.filters;
    const members = state.data.members.filter(member => filterText(member, ['memberId','displayName','email'], filter.memberSearch) && (filter.memberStatus === 'all' || member.accountStatus !== 'deleted'));
    const row = member => { const version = level(member.progress); return `<tr><td>${escapeHtml(member.memberId)}</td><td>${escapeHtml(member.displayName)}</td><td>${version.label}</td><td>${escapeHtml(member.email)}</td><td>${member.emailVerified ? '認証済み' : '未認証'}</td><td>${Number(member.progress || 0)} pt</td><td>${escapeHtml(member.licenseType || 'NONE')}</td><td>${escapeHtml(member.accountStatus || 'active')}</td><td><button class="primary compact" data-member-select="${member.id}">詳細</button>${member.accountStatus !== 'deleted' ? actionMenu(`<button class="danger" data-member-delete="${member.id}">削除</button>`) : ''}</td></tr>`; };
    const current = state.selectedMember ? `<section class="card"><h2>選択中：${escapeHtml(state.selectedMember.displayName)}</h2><p>${escapeHtml(state.selectedMember.memberId)} / ${level(state.selectedMember.progress).label} / ${Number(state.selectedMember.progress || 0)} pt</p><label class="field">ライセンス<select id="licenseSelect">${['NONE','STANDARD','PREMIUM'].map(value => `<option ${state.selectedMember.licenseType === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="primary" data-action="license-save">ライセンスを変更</button></section>` : '';
    return pageHead('MEMBER', 'メンバー情報はFirebase Authenticationと連携しています。') + `<section class="card"><div class="list-filter"><input id="memberSearch" value="${escapeHtml(filter.memberSearch)}" placeholder="ID・表示名・メールで検索"><select id="memberStatus"><option value="active">有効メンバー</option><option value="all" ${filter.memberStatus === 'all' ? 'selected' : ''}>削除履歴を含む</option></select><span class="filter-count">${members.length}件</span></div>${table(members, ['MEMBER ID','表示名','VERSION','メール','認証','PROGRESS','ライセンス','状態','操作'], row)}</section>${current}`;
  }
  function render() {
    if (!state.user || !state.view) return;
    const pages = { events: eventPage, artists: artistPage, members: memberPage, progress: progressPage, signals: signalPage, reports: reportPage, logs: logPage };
    $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
    $('#content').innerHTML = pages[state.view](); bindPage();
    updateErrorBadge();
  }
  function formValue(form) { const values = Object.fromEntries(new FormData(form)); ['advancePrice','doorPrice','streamingPrice','specialAppearanceCount'].forEach(key => { if (key in values) values[key] = Number(values[key] || 0); }); values.lpVisible = values.lpVisible === 'true'; return values; }
  function eventForm(event = {}) { return `<form id="eventForm"><div class="form-grid"><label class="field">タイトル<input name="title" required value="${escapeHtml(event.title)}"></label><label class="field">開催日<input name="eventDate" type="date" required value="${escapeHtml(event.eventDate)}"></label><label class="field">会場<input name="venue" required value="${escapeHtml(event.venue)}"></label><label class="field">OPEN<input name="openTime" type="time" value="${escapeHtml(event.openTime)}"></label><label class="field">START<input name="startTime" type="time" value="${escapeHtml(event.startTime)}"></label><label class="field">前売料金<input name="advancePrice" type="number" min="0" value="${Number(event.advancePrice || 0)}"></label><label class="field">当日料金<input name="doorPrice" type="number" min="0" value="${Number(event.doorPrice || 0)}"></label><label class="field">配信料金<input name="streamingPrice" type="number" min="0" value="${Number(event.streamingPrice || 0)}"></label><label class="field">ツイキャスURL<input name="streamingUrl" type="url" value="${escapeHtml(event.streamingUrl)}"></label><label class="field">LP公開<select name="lpVisible"><option value="true" ${event.lpVisible !== false ? 'selected' : ''}>ON</option><option value="false" ${event.lpVisible === false ? 'selected' : ''}>OFF</option></select></label><div class="wide"><h3>出演アーティスト</h3><button class="secondary" type="button" data-action="event-artist-picker">アーティストを追加</button><div id="eventArtists" class="artist-list">${eventArtistTags(event.artistIds || [])}</div></div></div></form>`; }
  function eventArtistTags(ids) { return ids.map(id => state.data.artists.find(artist => artist.id === id)).filter(Boolean).map(artist => `<span class="artist-tag" draggable="true" data-artist-id="${artist.id}">${escapeHtml(artist.name)} <button type="button" class="text-button" data-event-artist-remove="${artist.id}" aria-label="${escapeHtml(artist.name)}を外す">×</button></span>`).join('') || '<p class="sub">出演アーティストは未設定です。</p>'; }
  function artistForm(artist = {}) { const roles = ['REGULAR','CORE','FRESH','ORGANIZER']; return `<form id="artistForm"><div class="form-grid"><label class="field">名前<input name="name" required value="${escapeHtml(artist.name)}"></label><label class="field">ロール<select name="role">${roles.map(role => `<option ${artist.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label><label class="field">ジャンル<input name="genre" value="${escapeHtml(artist.genre)}" placeholder="自由入力"></label><label class="field">過去出演特別カウント<input name="specialAppearanceCount" type="number" min="0" value="${Number(artist.specialAppearanceCount || 0)}"></label><label class="field wide">プロフィール<textarea name="profile">${escapeHtml(artist.profile)}</textarea></label><label class="field">X<input name="xUrl" type="url" value="${escapeHtml(artist.xUrl)}"></label><label class="field">YouTube<input name="youtubeUrl" type="url" value="${escapeHtml(artist.youtubeUrl)}"></label><label class="field">SNSリンク1<input name="snsUrl1" type="url" value="${escapeHtml(artist.snsUrl1)}"></label><label class="field">SNSリンク2<input name="snsUrl2" type="url" value="${escapeHtml(artist.snsUrl2)}"></label><label class="field">LP掲載<select name="lpVisible"><option value="true" ${artist.lpVisible !== false ? 'selected' : ''}>ON</option><option value="false" ${artist.lpVisible === false ? 'selected' : ''}>OFF</option></select></label><label class="field">アイコン画像<input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label></div><p class="sub">イベント出演回数と過去出演特別カウントを合算して表示します。</p></form>`; }
  async function nextArtistKey() { return state.db.runTransaction(async transaction => { const ref = state.db.collection('counters').doc('artist'); const snap = await transaction.get(ref); const number = Number(snap.exists ? snap.data().value || 0 : 0) + 1; transaction.set(ref, { value: number }, { merge: true }); return `ART-${String(number).padStart(4,'0')}`; }); }
  async function uploadImage(file, folder) {
    if (!file) return null;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('storage/invalid-file');
    const ref = state.storage.ref().child(`${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    const task = ref.put(file, { contentType: file.type });
    return new Promise((resolve, reject) => task.on('state_changed', snapshot => setBanner(`画像をアップロード中：${Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)}%`), reject, async () => { setBanner(''); resolve(await task.snapshot.ref.getDownloadURL()); }));
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
      const file = form.elements.image.files[0]; if (file) values.imageUrl = await uploadImage(file, 'artists');
      if (artist) { await state.db.collection('artists').doc(artist.id).update(values); await adminLog('ARTIST_UPDATE','artist',artist.id,values.name,'アーティストを更新'); }
      else { values.artistKey = await nextArtistKey(); values.createdAt = serverTime(); const ref = await state.db.collection('artists').add(values); await adminLog('ARTIST_CREATE','artist',ref.id,values.name,'アーティストを作成'); }
      toast('アーティストを保存しました。');
    });
  }
  async function setEnvironment(collection, item, environment) { const warning = environment === 'prod' ? '本番公開します。LPへ表示される設定です。' : '開発環境へ戻します。'; confirmAction(environment === 'prod' ? '本番公開' : 'DEVへ戻す', warning, async () => { await state.db.collection(collection).doc(item.id).update({ environment, updatedAt:serverTime() }); await adminLog(collection === 'events' ? 'EVENT_UPDATE' : 'ARTIST_UPDATE', collection.slice(0,-1), item.id, item.title || item.name, `environment を ${environment} に変更`); localStorage.setItem('la-admin-environment', environment); toast('環境設定を更新しました。'); }, environment === 'prod' ? '本番公開する' : 'DEVへ戻す'); }
  function bindPage() {
    $('[data-action="event-new"]') && ($('[data-action="event-new"]').onclick = () => openEvent());
    $('[data-action="artist-new"]') && ($('[data-action="artist-new"]').onclick = () => openArtist());
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
    $('[data-action="license-save"]') && ($('[data-action="license-save"]').onclick = () => { const value = $('#licenseSelect').value, member = state.selectedMember; confirmAction('ライセンスを変更', `${member.displayName} のライセンスを ${value} に変更します。`, async () => { await state.db.collection('members').doc(member.id).update({ licenseType:value, updatedAt:serverTime() }); await adminLog('LICENSE_CHANGE','member',member.id,member.displayName,`licenseType: ${value}`); toast('ライセンスを更新しました。'); }, '変更する'); });
    $('[data-action="progress-id-select"]') && ($('[data-action="progress-id-select"]').onclick = () => { const id = $('#progressMemberId').value.trim().toUpperCase(); const member = state.data.members.find(item => String(item.memberId).toUpperCase() === id); if (!member) { toast('一致するMEMBER IDがありません。', true); return; } state.selectedMember = member; render(); });
    $('#progressMemberList') && ($('#progressMemberList').onchange = event => { state.selectedMember = state.data.members.find(member => member.id === event.target.value) || null; render(); });
    $$('[data-progress-preset]').forEach(button => button.onclick = () => { $('#progressForm').elements.amount.value = button.dataset.progressPreset; });
    $('#progressForm') && ($('#progressForm').onsubmit = event => { event.preventDefault(); const form = event.currentTarget, amount = Number(form.elements.amount.value), reason = form.elements.reason.value; if (!Number.isInteger(amount) || amount < 1 || !reason) { toast('ポイントと理由を入力してください。', true); return; } const member = state.selectedMember, before = Number(member.progress || 0), after = before + amount; confirmAction('PROGRESSを付与', `${member.displayName}（${member.memberId}）へ付与します。現在：${before} pt / ${level(before).label} → 付与後：${after} pt / ${level(after).label}。理由：${reason}`, async () => { const memberRef = state.db.collection('members').doc(member.id), logRef = state.db.collection('progressLogs').doc(), adminRef = state.db.collection('adminLogs').doc(); await state.db.runTransaction(async transaction => { const snap = await transaction.get(memberRef); transaction.update(memberRef, { progress:Number(snap.data().progress || 0) + amount, updatedAt:serverTime() }); transaction.set(logRef, { memberUid:member.id, memberId:member.memberId, amount, reason, grantedBy:state.user.uid, createdAt:serverTime() }); transaction.set(adminRef, { actionType:'PROGRESS_ADD', targetType:'member', targetId:member.id, targetLabel:member.displayName, detail:`+${amount} / ${reason}`, adminUid:state.user.uid, adminDisplayName:state.user.displayName || state.user.email, createdAt:serverTime() }); }); toast('PROGRESSを付与しました。'); }, '付与する'); });
    $('#signalArtist') && ($('#signalArtist').onchange = event => { state.selectedArtist = state.data.artists.find(item => item.id === event.target.value) || null; render(); });
    $('#signalDeletedToggle') && ($('#signalDeletedToggle').onchange = event => { state.showDeletedSignals = event.target.checked; render(); });
    $$('[data-signal-delete]').forEach(button => button.onclick = () => confirmAction('SIGNALを削除', '削除済みとして非表示にします。', async () => { const item = state.data.artistSignals.find(signal => signal.id === button.dataset.signalDelete); await state.db.collection('artistSignals').doc(item.id).update({ isDeleted:true, deletedAt:serverTime(), deletedBy:state.user.uid }); await adminLog('SIGNAL_DELETE','signal',item.id,item.memberDisplayName || item.memberId,'論理削除'); toast('SIGNALを削除しました。'); }, '削除する'));
    $$('[data-signal-restore]').forEach(button => button.onclick = () => confirmAction('SIGNALを復元', '削除状態を解除します。', async () => { const item = state.data.artistSignals.find(signal => signal.id === button.dataset.signalRestore); await state.db.collection('artistSignals').doc(item.id).update({ isDeleted:false, deletedAt:null, deletedBy:null }); await adminLog('SIGNAL_RESTORE','signal',item.id,item.memberDisplayName || item.memberId,'復元'); toast('SIGNALを復元しました。'); }, '復元する'));
    $$("[data-report-resolve]").forEach(button => button.onclick = () => confirmAction("報告を解決", "この報告を解決済みにします。", async () => { const item = state.data.errorReports.find(report => report.id === button.dataset.reportResolve); await state.db.collection("errorReports").doc(item.id).update({ status:"resolved", resolvedAt:serverTime(), resolvedBy:state.user.uid, updatedAt:serverTime() }); await adminLog("ERROR_REPORT_RESOLVE","errorReport",item.id,item.errorCode || item.action || "error report","解決済み"); toast("報告を解決済みにしました。"); }, "解決済みにする"));
    ['logAction','logSearch','logFrom','logTo'].forEach(id => { const node = $(`#${id}`); if (node) node.oninput = filterLogs; });
    [['eventSearch','eventSearch'],['eventStatus','eventStatus'],['artistSearch','artistSearch'],['artistRole','artistRole'],['memberSearch','memberSearch'],['memberStatus','memberStatus']].forEach(([id, key]) => {
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
    collectionSnapshot('events'); collectionSnapshot('artists'); collectionSnapshot('members'); collectionSnapshot('artistSignals'); collectionSnapshot('errorReports'); collectionSnapshot('adminLogs');
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


