const CONFIG = { ticketReserveUrl: "https://ssl.form-mailer.jp/fms/cd86a457886002" };
const ARTISTS = [["AOI", "ARTIST"], ["KURO", "ARTIST"], ["LUNA", "ARTIST"], ["REI", "REGULAR"], ["NOVA", "REGULAR"], ["YUI", "ARTIST"]];
const EVENTS = [["Legendary Apocalypse Vol.14", "2026.07.19"], ["Legendary Apocalypse Vol.15", "2026.08.16"]];
const $ = selector => document.querySelector(selector);
let focus;

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function artistImagePosition(artist) {
  const clamp = (value, fallback) => Math.min(100, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback));
  const focus = !Array.isArray(artist) ? (artist.imageFocus || artist.focalPoint || {}) : {};
  const x = clamp(artist?.imageFocusX ?? focus.x, 50);
  const y = clamp(artist?.imageFocusY ?? focus.y, 32);
  return `${x}% ${y}%`;
}

function displayRole(role) {
  return ["REGULAR", "ORGANIZER", "FRESH", "CORE"].includes(role) ? role : "FRESH";
}

// 将来のAI分析データを受け取るための、LP先行モック用デフォルト値。
const SIGNAL_LABELS = ["歌唱", "パフォーマンス", "感情", "キャラクター", "世界観", "ビジュアル"];
const DEFAULT_SIGNAL_ANALYTICS = { vocal: 20, performance: 20, emotion: 20, character: 15, worldview: 15, visual: 10 };

function signalAnalytics(artist = {}) {
  const source = !Array.isArray(artist) && (artist.signalAnalytics || artist.combinedScores) || DEFAULT_SIGNAL_ANALYTICS;
  const keys = ["vocal", "performance", "emotion", "character", "worldview", "visual"];
  const values = keys.map(key => Math.max(0, Number(source[key] || 0)));
  const total = values.reduce((sum, value) => sum + value, 0) || 100;
  const ratios = values.map(value => Math.round(value / total * 100));
  ratios[ratios.length - 1] += 100 - ratios.reduce((sum, value) => sum + value, 0);
  return ratios;
}

function radarPoints(values, scale) {
  return values.map((value, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / values.length;
    const radius = 35 * (value / 100) * scale;
    return `${(50 + Math.cos(angle) * radius).toFixed(2)},${(50 + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ");
}

function signalGraph(artist, variant = "card") {
  const values = signalAnalytics(artist);
  const rings = [.33, .66, 1].map(scale => `<polygon points="${radarPoints([100, 100, 100, 100, 100, 100], scale)}"/>`).join("");
  const axes = values.map((_, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / values.length;
    return `<line x1="50" y1="50" x2="${(50 + Math.cos(angle) * 35).toFixed(2)}" y2="${(50 + Math.sin(angle) * 35).toFixed(2)}"/>`;
  }).join("");
  return `<span class="artist-signal artist-signal--${variant}" aria-label="ARTIST SIGNAL"><span class="artist-signal__meta"><b>ARTIST SIGNAL</b></span><svg viewBox="0 0 100 100" aria-hidden="true"><g class="artist-signal__grid">${rings}${axes}</g><polygon class="artist-signal__shape" points="${radarPoints(values, 1)}"/></svg></span>`;
}

function signalComments(artist = {}) {
  const comments = !Array.isArray(artist) && (artist.signalComments || artist.comments);
  const values = Array.isArray(comments) ? comments.map(item => typeof item === "string" ? item : item?.comment).filter(Boolean) : [];
  return values.length ? values.slice(0, 5) : ["#歌声が好き", "#最高のステージ", "#また観たい"];
}

function modal(content) {
  focus = document.activeElement;
  $("#modal-root").innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><button class="modal-close" aria-label="閉じる">×</button>${content}</section></div>`;
  $(".modal-close").onclick = close;
  $(".modal-backdrop").onclick = event => { if (event.target === event.currentTarget) close(); };
  document.body.style.overflow = "hidden";
}

function close() {
  $("#modal-root").innerHTML = "";
  document.body.style.overflow = "";
  focus?.focus();
}

function artistCard(artist, attribute, index) {
  const [name, role] = Array.isArray(artist) ? artist : [artist.name, artist.role];
  const image = !Array.isArray(artist) && artist.imageUrl ? `<img src="${escapeHTML(artist.imageUrl)}" alt="${escapeHTML(name)}" style="object-position:${artistImagePosition(artist)}">` : `<span>${escapeHTML(name).slice(0, 2)}</span>`;
  const appearances = !Array.isArray(artist) ? Math.max(0, Number(artist.appearanceCount || 0)) : 0;
  const genre = !Array.isArray(artist) ? String(artist.genre || "") : "";
  const displayRoleName = displayRole(role);
  return `<button class="artist-card role-${displayRoleName.toLowerCase()}" ${attribute}="${index}"><span class="artist-image">${image}</span><span class="artist-card-info"><small>${escapeHTML(displayRoleName)}</small><strong>${escapeHTML(name)}</strong>${genre ? `<i class="artist-genre">${escapeHTML(genre)}</i>` : ""}<em class="appearance-count">出演 ${appearances} 回</em><em class="artist-card-detail">タップで詳細表示</em></span></button>`;
}

function artistProfile(artist = {}) {
  const links = [["X", artist.xUrl, "x"], ["YouTube", artist.youtubeUrl, "youtube"], ["SNS", artist.snsUrl1, "sns"], ["SNS", artist.snsUrl2, "sns"]].filter(([, url]) => /^https?:\/\//i.test(url));
  const values = signalAnalytics(artist);
  const comments = signalComments(artist);
  modal(`<div class="profile-body"><p class="eyebrow">ARTIST PROFILE</p><h2>${escapeHTML(artist.name || "ARTIST")}</h2><p class="profile-role">${escapeHTML(displayRole(artist.role))}${artist.genre ? ` / ${escapeHTML(artist.genre)}` : ""}</p>${artist.imageUrl ? `<img class="profile-thumbnail" src="${escapeHTML(artist.imageUrl)}" alt="${escapeHTML(artist.name)}" style="object-position:${artistImagePosition(artist)}">` : ""}<h3>APPEARANCES</h3><p class="profile-text">出演回数：${Math.max(0, Number(artist.appearanceCount || 0))} 回</p><h3>PROFILE</h3><p class="profile-text">${escapeHTML(artist.profile || "プロフィール情報は準備中です。")}</p>${links.length ? `<h3>SNS / VIDEO</h3><p class="social-links">${links.map(([label, url, type]) => `<a class="social-link social-link--${type}" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true"></span>${label}</a>`).join("")}</p>` : ""}<section class="artist-signal-panel"><h3>ARTIST SIGNAL</h3><p class="artist-signal-panel__lead">ファンから届いたSIGNALの割合</p><div class="artist-signal-panel__content">${signalGraph(artist, "modal")}<ul class="artist-signal-legend">${SIGNAL_LABELS.map((label, index) => `<li><span>${label}</span><b>${values[index]}%</b></li>`).join("")}</ul></div><p class="artist-signal-panel__note">Based on received SIGNALS</p><div class="comment-chips">${comments.map(comment => `<span class="comment-chip">${escapeHTML(comment)}</span>`).join("")}</div></section><section class="artist-ask-preview"><h3>ASK / QUESTION</h3><p>COMING SOON</p></section></div>`);
}

window.openLPArtistProfile = artistProfile;

function artistMap() {
  return new Map((window.LP_ADMIN_ALL_ARTISTS || []).map(artist => [artist.id, artist]));
}

function eventArtists(event) {
  const map = artistMap();
  return (event?.artistIds || []).map(id => map.get(id)).filter(Boolean);
}

function orderedArtists(allArtists) {
  const organizers = allArtists.filter(artist => displayRole(artist.role) === "ORGANIZER");
  const others = allArtists.filter(artist => displayRole(artist.role) !== "ORGANIZER").sort(() => Math.random() - 0.5);
  return [...others, ...organizers];
}

function renderTopArtists(allArtists) {
  const artists = orderedArtists(allArtists);
  const grid = $("#artist-grid");
  if (!artists.length) { grid.innerHTML = '<p class="sub-copy">ARTIST DATA COMING SOON</p>'; return; }
  grid.innerHTML = artists.map((artist, index) => artistCard(artist, "data-top-artist", index)).join("");
  document.querySelectorAll("[data-top-artist]").forEach(button => button.onclick = () => artistProfile(artists[Number(button.dataset.topArtist)]));
}

function renderTopEvent(event) {
  if (!event) return;
  $("#event-title").textContent = event.title || "EVENT INFORMATION COMING SOON";
  $("#event-date").textContent = event.eventDate || "---";
  $("#event-venue").textContent = event.venue || "---";
  $("#event-time").textContent = `${event.openTime || "---"} / ${event.startTime || "---"}`;
  $("#event-ticket").textContent = `ADV ${event.advancePrice || 0}`;
  $("#event-flyer").innerHTML = event.flyerUrl ? `<img src="${escapeHTML(event.flyerUrl)}" alt="${escapeHTML(event.title || "Event flyer")}">` : "EVENT FLYER";
  const names = eventArtists(event).map(artist => artist.name);
  const lineup = $(".event-artists");
  if (lineup) lineup.innerHTML = `<span>ARTISTS</span>${escapeHTML(names.length ? names.join(" / ") : "---")}`;
  const ticket = $("#ticket-link");
  ticket.href = CONFIG.ticketReserveUrl;
  ticket.removeAttribute("aria-disabled");
  const twitcasting = $("#event-twitcasting-link");
  twitcasting.hidden = !/^https?:\/\//i.test(event.twitcastingUrl || "");
  if (!twitcasting.hidden) twitcasting.href = event.twitcastingUrl;
}

window.renderLPAdminData = ({ events = [], artists = [], settings = {} }) => {
  window.LP_ADMIN_EVENTS = events;
  window.LP_ADMIN_ALL_ARTISTS = artists;
  const today = new Date().toISOString().slice(0, 10);
  const next = events.find(event => !event.eventDate || event.eventDate >= today) || events[0];
  renderTopEvent(next);
  renderTopArtists(artists);
  renderLogo(settings);
};

function cards() {
  $("#artist-grid").innerHTML = ARTISTS.map((artist, index) => artistCard(artist, "data-fallback-artist", index)).join("");
  document.querySelectorAll("[data-fallback-artist]").forEach(button => { const [name, role] = ARTISTS[Number(button.dataset.fallbackArtist)]; button.onclick = () => artistProfile({ name, role }); });
}

function allArtists() {
  const artists = window.LP_ADMIN_ALL_ARTISTS?.length ? orderedArtists(window.LP_ADMIN_ALL_ARTISTS) : ARTISTS;
  modal(`<div class="all-list">${artists.map((artist, index) => artistCard(artist, "data-artist-index", index)).join("")}</div>`);
  document.querySelectorAll("[data-artist-index]").forEach(button => button.onclick = () => { const artist = artists[Number(button.dataset.artistIndex)]; Array.isArray(artist) ? artistProfile({ name: artist[0], role: artist[1] }) : artistProfile(artist); });
}

function eventPanel(event) {
  const lineup = eventArtists(event);
  const prices = [`ADV ${event.advancePrice || 0}`, `DOOR ${event.doorPrice || 0}`, `STREAM ${event.streamingPrice || 0}`].join(" / ");
  const twitcasting = /^https?:\/\//i.test(event.twitcastingUrl || "") ? `<a class="text-link" href="${escapeHTML(event.twitcastingUrl)}" target="_blank" rel="noopener noreferrer">ツイキャス ↗</a>` : "";
  return `<article class="event-panel"><div class="flyer">${event.flyerUrl ? `<img src="${escapeHTML(event.flyerUrl)}" alt="${escapeHTML(event.title)}">` : "EVENT FLYER"}</div><p class="panel-label">EVENT INFORMATION</p><h2>${escapeHTML(event.title)}</h2><div class="event-grid"><div><span>DATE</span><strong>${escapeHTML(event.eventDate || "---")}</strong></div><div><span>VENUE</span><strong>${escapeHTML(event.venue || "---")}</strong></div><div><span>OPEN / START</span><strong>${escapeHTML(event.openTime || "---")} / ${escapeHTML(event.startTime || "---")}</strong></div><div><span>TICKET</span><strong>${escapeHTML(prices)}</strong></div></div><p class="event-artists"><span>ARTISTS</span>${escapeHTML(lineup.map(artist => artist.name).join(" / ") || "---")}</p>${twitcasting}</article>`;
}

function eventPanel(event) {
  const lineup = eventArtists(event);
  const prices = [`ADV ${event.advancePrice || 0}`, `DOOR ${event.doorPrice || 0}`, `STREAM ${event.streamingPrice || 0}`].join(" / ");
  const flyer = event.flyerUrl ? `<a class="flyer event-flyer-link" href="${escapeHTML(event.flyerUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(event.title)}のフライヤーをフルサイズで開く"><img src="${escapeHTML(event.flyerUrl)}" alt="${escapeHTML(event.title)}"><span>FULL SIZE ↗</span></a>` : '<div class="flyer">EVENT FLYER</div>';
  const twitcasting = /^https?:\/\//i.test(event.twitcastingUrl || "") ? `<a class="text-link" href="${escapeHTML(event.twitcastingUrl)}" target="_blank" rel="noopener noreferrer">ツイキャス ↗</a>` : "";
  return `<article class="event-panel">${flyer}<p class="panel-label">EVENT INFORMATION</p><h2>${escapeHTML(event.title)}</h2><div class="event-grid"><div><span>DATE</span><strong>${escapeHTML(event.eventDate || "---")}</strong></div><div><span>VENUE</span><strong>${escapeHTML(event.venue || "---")}</strong></div><div><span>OPEN / START</span><strong>${escapeHTML(event.openTime || "---")} / ${escapeHTML(event.startTime || "---")}</strong></div><div><span>TICKET</span><strong>${escapeHTML(prices)}</strong></div></div><p class="event-artists"><span>ARTISTS</span>${escapeHTML(lineup.map(artist => artist.name).join(" / ") || "---")}</p>${twitcasting}</article>`;
}

function allEvents() {
  const events = window.LP_ADMIN_EVENTS?.length ? window.LP_ADMIN_EVENTS : null;
  if (!events) return modal(`<div class="profile-body"><p class="eyebrow">ALL EVENTS</p>${EVENTS.map(([title, date]) => `<article class="event-panel"><h2>${escapeHTML(title)}</h2><p>DATE ${escapeHTML(date)}</p></article>`).join("")}</div>`);
  modal(`<div class="profile-body"><p class="eyebrow">ALL EVENTS</p>${events.map(eventPanel).join("")}</div>`);
}

function eventPanel(event) {
  const lineup = eventArtists(event);
  const prices = [`ADV ${event.advancePrice || 0}`, `DOOR ${event.doorPrice || 0}`, `STREAM ${event.streamingPrice || 0}`].join(" / ");
  const flyer = event.flyerUrl ? `<button type="button" class="flyer event-flyer-zoom" data-flyer-url="${escapeHTML(event.flyerUrl)}" data-flyer-title="${escapeHTML(event.title)}" aria-label="${escapeHTML(event.title)}のフライヤーを拡大表示"><img src="${escapeHTML(event.flyerUrl)}" alt="${escapeHTML(event.title)}"><span>タップして拡大</span></button>` : '<div class="flyer">EVENT FLYER</div>';
  const twitcasting = /^https?:\/\//i.test(event.twitcastingUrl || "") ? `<a class="text-link" href="${escapeHTML(event.twitcastingUrl)}" target="_blank" rel="noopener noreferrer">ツイキャス ↗</a>` : "";
  return `<article class="event-panel">${flyer}<p class="panel-label">EVENT INFORMATION</p><h2>${escapeHTML(event.title)}</h2><div class="event-grid"><div><span>DATE</span><strong>${escapeHTML(event.eventDate || "---")}</strong></div><div><span>VENUE</span><strong>${escapeHTML(event.venue || "---")}</strong></div><div><span>OPEN / START</span><strong>${escapeHTML(event.openTime || "---")} / ${escapeHTML(event.startTime || "---")}</strong></div><div><span>TICKET</span><strong>${escapeHTML(prices)}</strong></div></div><p class="event-artists"><span>ARTISTS</span>${escapeHTML(lineup.map(artist => artist.name).join(" / ") || "---")}</p>${twitcasting}</article>`;
}

function openEventFlyer(url, title) {
  const root = $("#modal-root");
  const viewer = document.createElement("div");
  viewer.className = "event-flyer-viewer";
  viewer.innerHTML = `<div class="event-flyer-viewer__backdrop"><section class="event-flyer-viewer__content" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}のフライヤー"><button type="button" class="event-flyer-viewer__close" aria-label="閉じる">×</button><img src="${escapeHTML(url)}" alt="${escapeHTML(title)}"></section></div>`;
  const closeViewer = () => viewer.remove();
  root.append(viewer);
  viewer.querySelector(".event-flyer-viewer__close").onclick = closeViewer;
  viewer.querySelector(".event-flyer-viewer__backdrop").onclick = event => { if (event.target === event.currentTarget) closeViewer(); };
}

function allEvents() {
  const events = window.LP_ADMIN_EVENTS?.length ? window.LP_ADMIN_EVENTS : null;
  if (!events) return modal(`<div class="profile-body"><p class="eyebrow">ALL EVENTS</p>${EVENTS.map(([title, date]) => `<article class="event-panel"><h2>${escapeHTML(title)}</h2><p>DATE ${escapeHTML(date)}</p></article>`).join("")}</div>`);
  modal(`<div class="profile-body"><p class="eyebrow">ALL EVENTS</p>${events.map(eventPanel).join("")}</div>`);
  document.querySelectorAll("[data-flyer-url]").forEach(button => button.onclick = () => openEventFlyer(button.dataset.flyerUrl, button.dataset.flyerTitle));
}

function eventStreamingUrl(event) {
  const url = event?.streamingUrl || event?.twitcastingUrl || "";
  return /^https?:\/\//i.test(url) ? url : "";
}

function renderLogo(settings = {}) {
  const logoUrl = settings.logoUrl || "";
  if (!/^https?:\/\//i.test(logoUrl)) return;
  const image = `<img class="admin-logo-image" src="${escapeHTML(logoUrl)}" alt="Legendary Apocalypse">`;
  $("#header-logo").innerHTML = image;
  $("#hero-logo").innerHTML = image;
}

function renderTopEvent(event) {
  if (!event) return;
  $("#event-title").textContent = event.title || "EVENT INFORMATION COMING SOON";
  $("#event-date").textContent = event.eventDate || "---";
  $("#event-venue").textContent = event.venue || "---";
  $("#event-time").textContent = `${event.openTime || "---"} / ${event.startTime || "---"}`;
  $("#event-ticket").textContent = `ADV ${event.advancePrice || 0}`;
  $("#event-flyer").innerHTML = event.flyerUrl ? `<img src="${escapeHTML(event.flyerUrl)}" alt="${escapeHTML(event.title || "Event flyer")}">` : "EVENT FLYER";
  const names = eventArtists(event).map(artist => artist.name);
  const lineup = $(".event-artists");
  if (lineup) lineup.innerHTML = `<span>ARTISTS</span>${escapeHTML(names.length ? names.join(" / ") : "---")}`;
  const twitcasting = $("#event-twitcasting-link"), url = eventStreamingUrl(event);
  twitcasting.hidden = !url;
  twitcasting.className = "button button-primary";
  if (url) twitcasting.href = url;
}

function eventPanel(event) {
  const lineup = eventArtists(event);
  const prices = [`ADV ${event.advancePrice || 0}`, `DOOR ${event.doorPrice || 0}`, `STREAM ${event.streamingPrice || 0}`].join(" / ");
  const flyer = event.flyerUrl ? `<button type="button" class="flyer event-flyer-zoom" data-flyer-url="${escapeHTML(event.flyerUrl)}" data-flyer-title="${escapeHTML(event.title)}" aria-label="${escapeHTML(event.title)}のフライヤーを拡大表示"><img src="${escapeHTML(event.flyerUrl)}" alt="${escapeHTML(event.title)}"><span>タップして拡大</span></button>` : '<div class="flyer">EVENT FLYER</div>';
  const url = eventStreamingUrl(event);
  const twitcasting = url ? `<a class="button button-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">ツイキャスを開く ↗</a>` : "";
  return `<article class="event-panel">${flyer}<p class="panel-label">EVENT INFORMATION</p><h2>${escapeHTML(event.title)}</h2><div class="event-grid"><div><span>DATE</span><strong>${escapeHTML(event.eventDate || "---")}</strong></div><div><span>VENUE</span><strong>${escapeHTML(event.venue || "---")}</strong></div><div><span>OPEN / START</span><strong>${escapeHTML(event.openTime || "---")} / ${escapeHTML(event.startTime || "---")}</strong></div><div><span>TICKET</span><strong>${escapeHTML(prices)}</strong></div></div><p class="event-artists"><span>ARTISTS</span>${escapeHTML(lineup.map(artist => artist.name).join(" / ") || "---")}</p>${twitcasting}</article>`;
}

function allEvents() {
  const events = window.LP_ADMIN_EVENTS?.length ? window.LP_ADMIN_EVENTS : null;
  if (!events) return modal(`<div class="profile-body"><p class="eyebrow">ALL EVENTS</p>${EVENTS.map(([title, date]) => `<article class="event-panel"><h2>${escapeHTML(title)}</h2><p>DATE ${escapeHTML(date)}</p></article>`).join("")}</div>`);
  modal(`<div class="profile-body"><p class="eyebrow">ALL EVENTS</p>${events.map(eventPanel).join("")}</div>`);
  document.querySelectorAll("[data-flyer-url]").forEach(button => button.onclick = () => openEventFlyer(button.dataset.flyerUrl, button.dataset.flyerTitle));
}

function init() {
  $("#ticket-link").href = CONFIG.ticketReserveUrl;
  cards();
  $("#all-artists-button").onclick = allArtists;
  $("#all-events-button").onclick = allEvents;
  $("#laos-trigger").onclick = () => { const content = $("#laos-content"); const open = !content.classList.contains("open"); content.hidden = false; content.classList.toggle("open", open); if (!open) window.setTimeout(() => { content.hidden = true; }, 300); };
  $(".menu-toggle").onclick = () => $(".site-header").classList.toggle("is-open");
  $("#top-button").onclick = () => scrollTo({ top: 0, behavior: "smooth" });
  addEventListener("scroll", () => $("#top-button").classList.toggle("is-visible", scrollY > 350));
  document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  document.querySelectorAll(".laos-preparing").forEach(button => button.onclick = event => { event.preventDefault(); modal('<div class="profile-body"><p class="eyebrow">LA_OS</p><h2>準備中です</h2><p>LA_OSのメンバー機能は現在準備中です。</p></div>'); });
  $("#danmaku-track").innerHTML = "";
  window.setTimeout(() => $("#loader").classList.add("is-hidden"), 1200);
}

init();
