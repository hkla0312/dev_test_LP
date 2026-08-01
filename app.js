/* LA_Terminal LP v0.02: 表示層のみ。既存のFirestoreコレクションを変更しない。 */
const CONFIG = {
  ticketReserveUrl: "https://ssl.form-mailer.jp/fms/cd86a457886002",
  officialXUrl: "https://x.com/Dancho_RealJP",
  contactFormUrl: "https://ssl.form-mailer.jp/fms/cd86a457886002",
  laOsUrl: "LA_OS/member/index.html"
};

const FALLBACK_ARTISTS = [
  { name: "AOI", role: "ARTIST", shortDescription: "ARTIST" }, { name: "KURO", role: "ARTIST", shortDescription: "ARTIST" },
  { name: "LUNA", role: "ARTIST", shortDescription: "ARTIST" }, { name: "REI", role: "REGULAR", shortDescription: "REGULAR" },
  { name: "NOVA", role: "REGULAR", shortDescription: "REGULAR" }, { name: "DANCHO", role: "ORGANIZER", fixedTop: true, shortDescription: "ORGANIZER" }
];
const FALLBACK_EVENTS = [{ title: "LegendaryApocalypse", eventDate: "EVENT INFORMATION", venue: "---", openTime: "---", startTime: "---", advancePrice: "---" }];
const $ = selector => document.querySelector(selector);
let lastFocus;
let activeProfileArtistId = "";
const SIGNAL_DAILY_LIMIT = 3;
const SIGNAL_DAILY_STORAGE_KEY = "la_terminal_signal_daily_limit_v1";
const LP_SIGNAL_GUEST_KEY = "la_terminal_lp_signal_guest_v1";
const LP_SIGNAL_ENDPOINT = "https://us-central1-laconsole-12985.cloudfunctions.net/submitLpSignal";
const SIGNAL_AXIS_META = [["vocal", "歌唱力", "#e84393"], ["performance", "パフォーマンス", "#ff7b54"], ["emotion", "感情表現", "#f2b134"], ["character", "キャラクター", "#27ae8a"], ["worldview", "世界観", "#20a8c7"], ["visual", "ビジュアル", "#7867e7"]];

function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function isUrl(value) { return /^https?:\/\//i.test(value || ""); }
function displayRole(role) { return String(role || "ARTIST").toUpperCase(); }
function imagePosition(artist = {}) {
  const focus = artist.imageFocus || artist.focalPoint || {};
  const clamp = value => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 50));
  return `${clamp(artist.imageFocusX ?? focus.x)}% ${clamp(artist.imageFocusY ?? focus.y ?? 32)}%`;
}

function modal(content, className = "") {
  lastFocus = document.activeElement;
  $("#modal-root").innerHTML = `<div class="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true"><button class="modal-close" type="button" aria-label="閉じる">×</button>${content}</section></div>`;
  $(".modal-close").onclick = closeModal;
  $(".modal-backdrop").onclick = event => { if (event.target === event.currentTarget) closeModal(); };
  document.body.style.overflow = "hidden";
}
function closeModal() { $("#modal-root").innerHTML = ""; document.body.style.overflow = ""; lastFocus?.focus(); }

function artistCard(artist, index, all = false) {
  const image = artist.imageUrl ? `<img src="${escapeHTML(artist.imageUrl)}" alt="${escapeHTML(artist.name)}" loading="lazy" style="object-position:${imagePosition(artist)}">` : `<span>${escapeHTML(String(artist.name || "A").slice(0, 2))}</span>`;
  return `<button type="button" class="artist-card" data-artist="${index}"><span class="artist-image">${image}</span><span class="artist-card-info"><small>${escapeHTML(displayRole(artist.role))}</small><strong>${escapeHTML(artist.name || "ARTIST")}</strong><em>${all ? "プロフィールを見る" : "タップで詳細表示"}</em></span></button>`;
}

function artistProfile(artist) {
  const signals = artist.signals || artist.signalData || { song: 0, stage: 0, character: 0 };
  const total = Number(signals.total || (Number(signals.song) + Number(signals.stage) + Number(signals.character))) || 0;
  const values = [["歌が良い", Number(signals.song || 0)], ["ステージが良い", Number(signals.stage || 0)], ["キャラが良い", Number(signals.character || 0)]];
  const social = [["X", artist.xUrl], ["YouTube", artist.youtubeUrl], ["Music", artist.musicUrl]].filter(([, url]) => isUrl(url));
  const image = artist.imageUrl ? `<img src="${escapeHTML(artist.imageUrl)}" alt="${escapeHTML(artist.name)}" style="object-position:${imagePosition(artist)}">` : "";
  const comments = Array.isArray(artist.signalComments || artist.comments) ? (artist.signalComments || artist.comments).slice(0, 5) : [];
  modal(`<div class="profile-layout"><div class="profile-image">${image}</div><div class="profile-body"><p class="kicker">ARTIST PROFILE</p><h2>${escapeHTML(artist.name || "ARTIST")}</h2><p class="profile-role">${escapeHTML(displayRole(artist.role))}</p><p class="profile-text">${escapeHTML(artist.profile || artist.shortDescription || "プロフィール情報は準備中です。")}</p>${social.length ? `<h3>SNS / VIDEO</h3><div class="social-links">${social.map(([label, url]) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`).join("")}</div>` : ""}<h3>SIGNAL DATA</h3>${total ? `<div class="signal-layout"><canvas class="signal-canvas" width="160" height="160" data-values="${values.map(([, value]) => value).join(",")}" aria-label="SIGNAL DATA"></canvas><ul class="signal-list">${values.map(([label, value]) => `<li><span>${label}</span><b>${Math.round(value / total * 100)}%</b></li>`).join("")}</ul></div>` : `<p class="profile-text">NO SIGNAL DATA</p>`}${comments.length ? `<div class="comment-chips">${comments.map(item => `<span class="comment-chip">#${escapeHTML(typeof item === "string" ? item.replace(/^#/, "") : item.comment || "")}</span>`).join("")}</div>` : ""}</div></div>`);
  document.querySelectorAll(".signal-canvas").forEach(drawSignalChart);
}

function drawSignalChart(canvas) {
  const context = canvas.getContext("2d"), values = canvas.dataset.values.split(",").map(Number), total = values.reduce((sum, value) => sum + value, 0);
  let angle = -Math.PI / 2; const colors = ["#dc2370", "#55555c", "#d4d4da"];
  context.clearRect(0, 0, 160, 160); values.forEach((value, index) => { const next = angle + value / total * Math.PI * 2; context.beginPath(); context.moveTo(80, 80); context.arc(80, 80, 56, angle, next); context.closePath(); context.fillStyle = colors[index]; context.fill(); angle = next; });
  context.beginPath(); context.arc(80, 80, 34, 0, Math.PI * 2); context.fillStyle = "#fff"; context.fill(); context.fillStyle = "#111115"; context.font = "10px DM Mono"; context.textAlign = "center"; context.fillText("SIGNAL", 80, 77); context.font = "16px DM Mono"; context.fillText(String(total), 80, 96);
}

function renderArtists(artists) {
  const fixed = artists.find(artist => artist.fixedTop) || artists.find(artist => displayRole(artist.role) === "ORGANIZER");
  const others = artists.filter(artist => artist !== fixed).sort(() => Math.random() - .5).slice(0, 5);
  const selected = [...others, ...(fixed ? [fixed] : [])];
  $("#artist-grid").innerHTML = selected.length ? selected.map((artist, index) => artistCard(artist, index)).join("") : '<p class="empty-state">ARTIST DATA COMING SOON</p>';
  document.querySelectorAll("[data-artist]").forEach(button => button.onclick = () => artistProfile(selected[Number(button.dataset.artist)]));
  renderSignalArtists(artists);
}

function renderSignalArtists(artists) {
  const select = $("#signal-artist-select");
  if (!select) return;
  const selected = select.value;
  select.innerHTML = `<option value="">アーティストを選択</option>${artists.map(artist => `<option value="${escapeHTML(artist.id || artist.name)}">${escapeHTML(artist.name || "ARTIST")}</option>`).join("")}`;
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}

function eventArtists(event) {
  const all = window.LA_TERMINAL_ARTISTS || [];
  return (event.artistIds || []).map(id => all.find(artist => artist.id === id)).filter(Boolean).map(artist => artist.name);
}
function renderEvent(event) {
  if (!event) return;
  $("#event-title").textContent = event.title || "EVENT INFORMATION COMING SOON";
  $("#event-date").textContent = event.eventDate || "---";
  $("#event-venue").textContent = event.venue || "---";
  $("#event-time").textContent = `${event.openTime || "---"} / ${event.startTime || "---"}`;
  $("#event-ticket").textContent = `ADV ${event.advancePrice || "---"}`;
  $("#event-artists").textContent = eventArtists(event).join(" / ") || "---";
  $("#event-status").textContent = event.eventKey || "LATEST LIVE";
  $("#event-flyer").innerHTML = event.flyerUrl ? `<img src="${escapeHTML(event.flyerUrl)}" alt="${escapeHTML(event.title || "Event flyer")}">` : "<span>EVENT FLYER</span>";
  const ticket = $("#ticket-link"); ticket.href = event.reserveUrl || CONFIG.ticketReserveUrl;
  const streaming = event.streamingUrl || event.twitcastingUrl || ""; const link = $("#event-twitcasting-link"); link.hidden = !isUrl(streaming); if (!link.hidden) link.href = streaming;
}

function eventMarkup(event) { return `<article class="event-feature"><div class="event-feature__visual">${event.flyerUrl ? `<img src="${escapeHTML(event.flyerUrl)}" alt="${escapeHTML(event.title)}">` : "<span>EVENT FLYER</span>"}</div><div class="event-feature__content"><p class="event-feature__volume">${escapeHTML(event.eventKey || "EVENT")}</p><h3>${escapeHTML(event.title || "EVENT INFORMATION")}</h3><p class="event-feature__date">${escapeHTML(event.eventDate || "---")}</p><p>${escapeHTML(event.venue || "---")}</p></div></article>`; }
function openAllEvents() { const events = window.LA_TERMINAL_EVENTS || FALLBACK_EVENTS; modal(`<div class="all-events"><p class="kicker">ALL EVENTS</p>${events.map(eventMarkup).join("")}</div>`); }
function openAllArtists() { const artists = window.LA_TERMINAL_ARTISTS || FALLBACK_ARTISTS; modal(`<div class="all-list">${artists.map((artist, index) => artistCard(artist, index, true)).join("")}</div>`); document.querySelectorAll("[data-artist]").forEach(button => button.onclick = () => artistProfile(artists[Number(button.dataset.artist)])); }

function applySettings(settings = {}) {
  const links = [["#event-x-link", settings.eventOfficialXUrl || settings.officialXUrl || CONFIG.officialXUrl], ["#organizer-x-link", settings.organizerXUrl || CONFIG.officialXUrl], ["#footer-x-link", settings.officialXUrl || CONFIG.officialXUrl], ["#customer-contact-link", settings.customerContactUrl || settings.contactFormUrl || CONFIG.contactFormUrl], ["#artist-contact-link", settings.artistContactUrl || settings.contactFormUrl || CONFIG.contactFormUrl], ["#ticket-link", settings.ticketReserveUrl || CONFIG.ticketReserveUrl], ["#laos-login-link", settings.laOsRegisterUrl || CONFIG.laOsUrl], ["#header-login-link", settings.laOsDetailUrl || CONFIG.laOsUrl]];
  links.forEach(([selector, url]) => { const element = $(selector); if (element && isUrl(url)) element.href = url; });
}

window.renderLPAdminData = ({ events = [], artists = [], settings = {} }) => {
  window.LA_TERMINAL_EVENTS = events; window.LA_TERMINAL_ARTISTS = artists;
  const today = new Date().toISOString().slice(0, 10); renderArtists(artists.length ? artists : FALLBACK_ARTISTS); renderEvent(events.find(event => !event.eventDate || event.eventDate >= today) || events[0] || FALLBACK_EVENTS[0]); applySettings(settings);
};

function identityEffect() {
  const original = "LegendaryApocalypse", decoded = "Liberation Arrival", element = $("#identity-brand"), reveal = $("#identity-reveal"), story = $(".identity__story");
  const isDecoded = element.dataset.decoded === "true", target = isDecoded ? original : decoded, source = isDecoded ? decoded : original;
  const symbols = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; const steps = isDecoded ? 8 : 18; let frame = 0;
  story.classList.add("is-switching");
  if (isDecoded) reveal.classList.add("is-closing");
  window.setTimeout(() => {
    const timer = setInterval(() => { const progress = frame / steps; element.textContent = target.split("").map((char, index) => char === " " ? " " : index / target.length < progress ? char : symbols[Math.floor(Math.random() * symbols.length)]).join(""); frame += 1; if (frame > steps) { clearInterval(timer); element.textContent = target; element.dataset.decoded = String(!isDecoded); reveal.hidden = isDecoded; reveal.classList.remove("is-closing"); story.classList.remove("is-switching"); if (!isDecoded) window.setTimeout(() => reveal.scrollIntoView({ behavior: "smooth", block: "start" }), 90); } }, isDecoded ? 72 : 110);
  }, 180);
}

function lpSignalGuestId() {
  let value = localStorage.getItem(LP_SIGNAL_GUEST_KEY);
  if (!value) { value = typeof crypto?.randomUUID === "function" ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2)}`; localStorage.setItem(LP_SIGNAL_GUEST_KEY, value); }
  return value;
}
function signalUsageKey() { return `${SIGNAL_DAILY_STORAGE_KEY}:${lpSignalGuestId()}`; }
function signalUsage() {
  try { const value = JSON.parse(localStorage.getItem(signalUsageKey()) || "{}"); return value.date === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }) ? Number(value.count || 0) : 0; } catch { return 0; }
}
function markSignalUsage() { localStorage.setItem(signalUsageKey(), JSON.stringify({ date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }), count: signalUsage() + 1 })); }
async function submitPublicLpSignal(payload) {
  const response = await fetch(LP_SIGNAL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) throw new Error(body?.error?.message || "SIGNALの送信に失敗しました。");
  return body?.data || {};
}
function updateSignalAccess() {
  const form = $("#signal-form"), note = $(".signal__note");
  if (!form) return;
  const used = signalUsage(), remaining = Math.max(0, SIGNAL_DAILY_LIMIT - used), enabled = remaining > 0;
  form.querySelectorAll("select, textarea, button").forEach(control => { control.disabled = !enabled; });
  form.querySelectorAll("select, button").forEach(control => { control.disabled = !enabled; });
  if (note) note.innerHTML = `SIGNAL送信は1日3回までです。（残り ${remaining} 回）<br>※テスト運用となります。予告なく会員専用機能にシフトする場合があります。`;
}
function initSignalForm() {
  const form = $("#signal-form"), select = $("#signal-artist-select"), status = $("#signal-status");
  if (!form) return;
  let selectedSignal = "";
  const setStatus = message => { status.textContent = message; };
  form.querySelectorAll("[data-signal]").forEach(button => button.onclick = () => { selectedSignal = button.dataset.signal; form.querySelectorAll("[data-signal]").forEach(item => item.setAttribute("aria-pressed", String(item === button))); setStatus(""); });
  form.onsubmit = async event => {
    event.preventDefault();
    if (signalUsage() >= SIGNAL_DAILY_LIMIT) { setStatus("本日のSIGNAL送信上限に達しています。"); updateSignalAccess(); return; }
    if (!select.value || !selectedSignal) { setStatus("アーティストとSIGNALを選択してください。"); return; }
    const controls = Array.from(form.querySelectorAll("select, button")); controls.forEach(control => { control.disabled = true; }); setStatus("SIGNAL送信中...");
    try {
      const result = await submitPublicLpSignal({ artistId: select.value, signalType: selectedSignal, guestId: lpSignalGuestId() });
      localStorage.setItem(signalUsageKey(), JSON.stringify({ date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }), count: SIGNAL_DAILY_LIMIT - Number(result.remaining ?? 0) })); selectedSignal = "";
      form.querySelectorAll("[data-signal]").forEach(button => button.setAttribute("aria-pressed", "false"));
      setStatus("SIGNALを送信しました。アーティストページへ反映します。"); updateSignalAccess();
    } catch (error) { setStatus(error?.message || "SIGNALの送信に失敗しました。"); updateSignalAccess(); }
  };
}

function init() {
  renderArtists(FALLBACK_ARTISTS); renderEvent(FALLBACK_EVENTS[0]); applySettings();
  $("#all-events-button").onclick = openAllEvents; $("#all-artists-button").onclick = openAllArtists; $("#signal-all-artists-button").onclick = openAllArtists; $("#identity-monolith").onclick = identityEffect;
  initSignalForm(); updateSignalAccess();
  const share = $("#share-x-button");
  if (share) {
    const text = "CONNECT. CREATE. EVOLVE. #LATerminal";
    share.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
  }
  $(".menu-button").onclick = () => { const header = $(".site-header"), open = header.classList.toggle("is-open"); $(".menu-button").setAttribute("aria-expanded", String(open)); };
  document.querySelectorAll(".site-nav a").forEach(link => link.onclick = () => $(".site-header").classList.remove("is-open"));
  $("#top-button").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  window.addEventListener("scroll", () => $("#top-button").classList.toggle("is-visible", window.scrollY > 480), { passive: true });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
}
init();
