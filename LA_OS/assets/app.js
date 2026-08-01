(() => {
  "use strict";

  const initialState = {
    user: {
      displayName: "DANCHO",
      memberId: "#000184",
      version: "v0.01",
      archiveAccess: true,
      currentProgress: 38,
      requiredProgress: 100,
      versionUpPending: true,
      xAccount: "@dancho_static",
      email: "dancho@example.com",
      password: "",
    },
    events: [
      {
        eventId: "evt-001",
        title: "EVENT 01",
        date: "2031.08.16",
        venue: "SECTOR HALL 02",
        acts: [
          { actId: "act-001", name: "ARTIST 01" },
          { actId: "act-002", name: "ARTIST 02" },
        ],
      },
      {
        eventId: "evt-002",
        title: "EVENT 02",
        date: "2031.08.24",
        venue: "NEON HALL EAST",
        acts: [
          { actId: "act-003", name: "ARTIST 03" },
          { actId: "act-004", name: "ARTIST 04" },
        ],
      },
      {
        eventId: "evt-003",
        title: "EVENT 03",
        date: "2031.09.03",
        venue: "WEST DOCK STAGE",
        acts: [
          { actId: "act-005", name: "ARTIST 05" },
          { actId: "act-006", name: "ARTIST 06" },
        ],
      },
    ],
    reservations: [
      {
        reservationId: "res-001",
        eventId: "evt-001",
        actId: "act-002",
        ticketCount: 2,
      },
      {
        reservationId: "res-002",
        eventId: "evt-002",
        actId: "act-003",
        ticketCount: 1,
      },
      {
        reservationId: "res-003",
        eventId: "evt-003",
        actId: "act-005",
        ticketCount: 4,
      },
    ],
    reservation: {
      eventId: "evt-001",
      actId: "act-002",
      ticketCount: 2,
    },
    nextLive: {
      title: "NEXT EVENT #014",
      start: "20:30 JST",
      venue: "SECTOR HALL 02",
      eventId: "evt-001",
      actId: "act-002",
      channel: "LA_TERMINAL",
      status: "SCHEDULED",
      flyerUrl: "",
    },
    // SIGNAL履歴はログイン中の本人が実際に送信したものだけをFirestoreから受け取る。
    signals: [],
    danmaku: [
      {
        danmakuId: "DMK-021",
        emote: "spark",
        comment: "今日も最高だった！",
        memberId: "#000184",
        source: "LIVE #013 / 20:18",
        approved: true,
      },
      {
        danmakuId: "DMK-020",
        emote: "wave",
        comment: "またここで会おう。",
        memberId: "#000312",
        source: "LIVE #012 / 20:06",
        approved: true,
      },
      {
        danmakuId: "DMK-019",
        emote: "glow",
        comment: "会場の空気が好き。",
        memberId: "#000085",
        source: "LIVE #011 / 19:58",
        approved: true,
      },
      {
        danmakuId: "DMK-018",
        emote: "pulse",
        comment: "次の公演も楽しみ。",
        memberId: "#000560",
        source: "LIVE #010 / 19:44",
        approved: true,
      },
    ],
    archives: [
      {
        archiveId: "ARC-001",
        title: "ARCHIVE CUT 01",
        date: "2031.07.01",
        duration: "03:14",
      },
      {
        archiveId: "ARC-002",
        title: "ARCHIVE CUT 02",
        date: "2031.07.18",
        duration: "04:02",
      },
    ],
    updateLogs: [
      {
        version: "v0.01",
        date: "2031.07.08",
        note: "UIシェルを更新しました。",
      },
      {
        version: "v0.01",
        date: "2031.07.01",
        note: "アーカイブ表示を整えました。",
      },
    ],
  };

  const clone = typeof structuredClone === "function"
    ? structuredClone(initialState)
    : JSON.parse(JSON.stringify(initialState));

  const state = clone;
  const makeArtistThumbnail = (label, hue) => {
    const initials = String(label || "AR").slice(0, 2).toUpperCase();
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${initials}">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${hue}" stop-opacity="0.92"/>
            <stop offset="100%" stop-color="#071118" stop-opacity="1"/>
          </linearGradient>
        </defs>
        <rect width="96" height="96" rx="48" fill="url(#g)"/>
        <circle cx="48" cy="40" r="18" fill="rgba(255,255,255,0.14)"/>
        <path d="M20 78c8-12 18-18 28-18s20 6 28 18" fill="rgba(255,255,255,0.12)"/>
        <text x="50%" y="57%" fill="#e9fbff" font-family="monospace" font-size="26" font-weight="700" text-anchor="middle">${initials}</text>
      </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };
  const makeEventFlyer = (title, venue, date) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 560" role="img" aria-label="${title}">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef4f8"/>
            <stop offset="48%" stop-color="#ffe3ef"/>
            <stop offset="100%" stop-color="#f4f8ff"/>
          </linearGradient>
          <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#dc2370" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#38f5ff" stop-opacity="0.18"/>
          </linearGradient>
        </defs>
        <rect width="420" height="560" fill="url(#bg)"/>
        <rect x="24" y="24" width="372" height="512" fill="none" stroke="#dc2370" stroke-width="4"/>
        <rect x="36" y="36" width="348" height="488" fill="none" stroke="#d9dce4" stroke-width="1.5"/>
        <path d="M44 92h332" stroke="#dc2370" stroke-width="3"/>
        <circle cx="332" cy="120" r="58" fill="url(#shine)"/>
        <circle cx="112" cy="190" r="56" fill="rgba(220,35,112,.18)"/>
        <circle cx="302" cy="284" r="88" fill="rgba(56,245,255,.16)"/>
        <text x="50%" y="24%" fill="#111115" font-family="Arial, Noto Sans JP, sans-serif" font-size="28" font-weight="700" text-anchor="middle">LA_OS LIVE</text>
        <text x="50%" y="36%" fill="#dc2370" font-family="Arial, Noto Sans JP, sans-serif" font-size="40" font-weight="800" text-anchor="middle">${title}</text>
        <text x="50%" y="49%" fill="#111115" font-family="Arial, Noto Sans JP, sans-serif" font-size="22" font-weight="700" text-anchor="middle">${venue}</text>
        <text x="50%" y="58%" fill="#6c7280" font-family="Arial, Noto Sans JP, sans-serif" font-size="18" text-anchor="middle">${date}</text>
        <text x="50%" y="77%" fill="#111115" font-family="Arial, Noto Sans JP, sans-serif" font-size="16" font-weight="700" text-anchor="middle">ADMIN FLYER</text>
      </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };
  state.events.forEach((event, eventIndex) => {
    event.acts.forEach((artist, actIndex) => {
      if (!artist.imageUrl) {
        const hue = ["#7ae6e8", "#bc8cff", "#ff8ccd", "#92ff7a", "#ffd56a", "#74bfff"][(eventIndex * 2 + actIndex) % 6];
        artist.imageUrl = makeArtistThumbnail(artist.name, hue);
      }
    });
  });
  state.nextLive.flyerUrl = state.nextLive.flyerUrl || makeEventFlyer(state.nextLive.title, state.nextLive.venue, state.events[0]?.date || "");
  const STORAGE_KEY = "la_os_member_profile_v2";
  const SESSION_MS = 60 * 60 * 1000;
  const loadProfile = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const isFreshProfile = (profile) => Boolean(profile && Number(profile.expiresAt || 0) > Date.now());
  const writeProfile = (patch = {}) => {
    try {
      const current = loadProfile() || {};
      const next = {
        ...current,
        displayName: state.user.displayName,
        email: state.user.email,
        memberId: state.user.memberId,
        version: state.user.version,
        archiveAccess: state.user.archiveAccess,
        currentProgress: state.user.currentProgress,
        requiredProgress: state.user.requiredProgress,
        versionUpPending: state.user.versionUpPending,
        xAccount: state.user.xAccount,
        expiresAt: Number(current.expiresAt || 0) > Date.now() ? Number(current.expiresAt) : Date.now() + SESSION_MS,
        ...patch,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  const cachedProfile = loadProfile();
  if (isFreshProfile(cachedProfile)) {
    state.user.displayName = cachedProfile.displayName || state.user.displayName;
    state.user.memberId = cachedProfile.memberId || state.user.memberId;
    state.user.version = cachedProfile.version || state.user.version;
    state.user.archiveAccess = typeof cachedProfile.archiveAccess === "boolean" ? cachedProfile.archiveAccess : state.user.archiveAccess;
    state.user.currentProgress = Number.isFinite(Number(cachedProfile.currentProgress))
      ? Number(cachedProfile.currentProgress)
      : state.user.currentProgress;
    state.user.requiredProgress = Number.isFinite(Number(cachedProfile.requiredProgress))
      ? Number(cachedProfile.requiredProgress)
      : state.user.requiredProgress;
    state.user.versionUpPending = typeof cachedProfile.versionUpPending === "boolean"
      ? cachedProfile.versionUpPending
      : state.user.versionUpPending;
    state.user.xAccount = cachedProfile.xAccount || state.user.xAccount;
    state.user.email = cachedProfile.email || state.user.email;
  }

  const runtime = {
    archiveExpanded: false,
    reservationDraft: null,
    reservationIndex: 0,
    pendingCancelIndex: null,
    reservationMode: "create",
    signalIndex: 0,
    danmakuIndex: 0,
    danmakuReloadCount: 0,
    danmakuSendCounts: {},
    danmakuSenderMode: "id",
    systemUpdateRunning: false,
    systemUpdatePlayed: false,
    toastTimer: 0,
    noiseTimer: 0,
    pulseTimer: 0,
    updateTimers: [],
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const setText = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = String(value);
  };
  const pad2 = (value) => String(value).padStart(2, "0");
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const formatVersion = () => `${state.user.version}${state.user.archiveAccess ? "+" : ""}`;
  const formatProgress = () => {
    const ratio = state.user.requiredProgress === 0
      ? 0
      : (state.user.currentProgress / state.user.requiredProgress) * 100;
    return Math.round(clamp(ratio, 0, 100));
  };
  const makeOption = (value, label) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  };
  const DANMAKU_LIMIT_PER_EVENT = 5;
  const DANMAKU_EMOTES = [
    { value: "spark", emoji: "\u{1F31F}", label: "spark" },
    { value: "wave", emoji: "\u{1F44B}", label: "wave" },
    { value: "pulse", emoji: "\u{1FA79}", label: "pulse" },
    { value: "glow", emoji: "\u{2728}", label: "glow" },
    { value: "heart", emoji: "\u{1F49C}", label: "heart" },
    { value: "fire", emoji: "\u{1F525}", label: "fire" },
    { value: "star", emoji: "\u{2B50}", label: "star" },
    { value: "moon", emoji: "\u{1F319}", label: "moon" },
  ];
  const getDanmakuEventId = () => state.nextLive?.eventId ?? state.events[0]?.eventId ?? "evt-default";
  const getDanmakuEventLabel = () => {
    const live = state.nextLive;
    const event = live?.eventId ? getEvent(live.eventId) : state.events[0];
    return live?.title ?? event?.title ?? "EVENT";
  };
  const getDanmakuUsage = (eventId = getDanmakuEventId()) => runtime.danmakuSendCounts[eventId] ?? 0;
  const getDanmakuSenderMode = () => ($("#danmaku-sender-mode-display-name")?.checked ? "displayName" : "id");
  const getDanmakuSenderLabel = (mode = getDanmakuSenderMode()) =>
    mode === "displayName" ? state.user.displayName : state.user.memberId;
  const syncDanmakuSenderPreview = () => {
    const mode = getDanmakuSenderMode();
    setText("#danmaku-sender-preview", getDanmakuSenderLabel(mode));
    setText("#danmaku-sender-note", mode === "displayName" ? "表示名で送信します。" : "IDで送信します。");
    runtime.danmakuSenderMode = mode;
  };
  const syncDanmakuQuota = () => {
    const eventId = getDanmakuEventId();
    const used = getDanmakuUsage(eventId);
    const remaining = Math.max(0, DANMAKU_LIMIT_PER_EVENT - used);
    const quotaLabel = $("#danmaku-quota-status");
    const quotaNote = $("#danmaku-quota-note");
    const submitButton = $("#danmaku-submit");

    if (quotaLabel) quotaLabel.textContent = `${used} / ${DANMAKU_LIMIT_PER_EVENT}`;
    if (quotaNote) quotaNote.textContent = remaining > 0
      ? `残り ${remaining} 件です。`
      : "このイベントの送信上限に達しています。";
    if (submitButton) submitButton.disabled = used >= DANMAKU_LIMIT_PER_EVENT;
  };
  const setDanmakuEmote = (value) => {
    const palette = $("#danmaku-emote-palette");
    const hidden = $("#danmaku-emote-value");
    const nextValue = DANMAKU_EMOTES.some((item) => item.value === value) ? value : DANMAKU_EMOTES[0].value;

    if (hidden) {
      hidden.value = nextValue;
    }

    if (!palette) return;

    $$(".emoji-choice", palette).forEach((button) => {
      const selected = button.dataset.emote === nextValue;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-checked", String(selected));
    });
  };
  const renderDanmakuEmotePalette = () => {
    const palette = $("#danmaku-emote-palette");
    if (!palette) return;

    if (!palette.children.length) {
      const fragment = document.createDocumentFragment();
      DANMAKU_EMOTES.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "emoji-choice";
        button.dataset.emote = item.value;
        button.setAttribute("role", "radio");
        button.setAttribute("aria-label", item.label);
        button.innerHTML = `<span class="emoji-symbol" aria-hidden="true">${item.emoji}</span><span class="emoji-name">${item.label}</span><span class="emoji-state">驕ｸ謚樔ｸｭ</span>`;
        fragment.append(button);
      });
      palette.replaceChildren(fragment);
    }

    setDanmakuEmote($("#danmaku-emote-value")?.value || DANMAKU_EMOTES[0].value);
  };
  const makeId = (prefix) => {
    const value = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${value}`;
  };
  const nowLabel = () => {
    const parts = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const valueOf = (type) => parts.find((part) => part.type === type)?.value ?? "";
    return `${valueOf("year")}/${valueOf("month")}/${valueOf("day")} ${valueOf("hour")}:${valueOf("minute")} JST`;
  };

  const body = document.body;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

  function getSelectedReservation() {
    if (Array.isArray(state.reservations)) {
      return state.reservations[runtime.reservationIndex] ?? null;
    }
    return state.reservation ?? null;
  }

  function setSelectedReservation(index) {
    runtime.reservationIndex = clamp(index, 0, Math.max(0, (state.reservations?.length ?? 1) - 1));
    state.reservation = getSelectedReservation();
    renderReservationCard();
    renderLiveCard();
    renderSignalCard();
  }

  function getEvent(eventId) {
    return state.events.find((event) => event.eventId === eventId) ?? state.events[0];
  }

  function getAct(eventId, actId) {
    const event = getEvent(eventId);
    return event.acts.find((act) => act.actId === actId) ?? event.acts[0];
  }

  function openDialog(dialog) {
    if (!dialog) return;
    closeAllDialogs(dialog);
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
  }

  function closeAllDialogs(except = null) {
    $$("dialog[open]").forEach((dialog) => {
      if (dialog !== except) closeDialog(dialog);
    });
  }

  function setToast(message) {
    const node = $("#system-toast");
    if (!node) return;
    node.textContent = message;
    window.clearTimeout(runtime.toastTimer);
    runtime.toastTimer = window.setTimeout(() => {
      node.textContent = "";
    }, 1800);
  }

  function pulseProgress(message, delta = 1) {
    state.user.currentProgress = clamp(
      state.user.currentProgress + delta,
      0,
      state.user.requiredProgress
    );
    writeProfile({ currentProgress: state.user.currentProgress });

    body.classList.add("is-noise");
    $(".chamber-card")?.classList.add("is-pulse");
    $(".progress-card")?.classList.add("is-pulse");

    window.clearTimeout(runtime.noiseTimer);
    runtime.noiseTimer = window.setTimeout(() => {
      body.classList.remove("is-noise");
      $(".chamber-card")?.classList.remove("is-pulse");
      $(".progress-card")?.classList.remove("is-pulse");
    }, 260);

    setToast(message);
    renderProgress();
  }

  function renderHeader() {
    const version = formatVersion();
    setText("#header-identity", `${state.user.displayName} ${version}`);
    setText("#progress-version", version);
  }

  function renderChamber() {
    setText("#chamber-state", "準備中");
    setText("#chamber-depth", "PREPARING");

    const field = $("#bubble-field");
    if (!field) return;

    const bubbles = document.createDocumentFragment();
    const density = 12;

    for (let index = 0; index < density; index += 1) {
      const bubble = document.createElement("span");
      const size = 5 + ((index * 7) % 13);
      bubble.className = "bubble";
      bubble.style.setProperty("--x", `${8 + ((index * 19) % 86)}%`);
      bubble.style.setProperty("--size", `${size}px`);
      bubble.style.setProperty("--duration", `${9 + ((index * 3) % 8)}s`);
      bubble.style.setProperty("--delay", `${-1 * ((index * 2.7) % 13)}s`);
      bubble.style.setProperty("--drift", `${-18 + ((index * 11) % 37)}px`);
      bubbles.append(bubble);
    }

    field.replaceChildren(bubbles);
  }

  function renderProgress() {
    const percent = formatProgress();
    setText("#progress-value", percent);
    setText("#observation-status", state.user.versionUpPending ? "SYNC" : "READY");
    setText("#progress-cycle", "04");

    const note = state.user.versionUpPending
      ? "進行中です。なにか起こるかもしれません。"
      : "進捗は安定しています。";
    setText("#progress-note", note);

    const track = $("#progress-track");
    const fill = $("#progress-fill");
    if (track) track.setAttribute("aria-valuenow", String(percent));
    if (fill) fill.style.width = `${percent}%`;

    const trigger = $("#system-update-trigger");
    if (trigger) {
      trigger.hidden = !(state.user.versionUpPending && !runtime.systemUpdatePlayed);
      trigger.disabled = runtime.systemUpdateRunning;
    }
  }

  function renderReservationCard() {
    const bodyNode = $("#reservation-body");
    const emptyNode = $("#reservation-empty");
    const stateLabel = $("#reservation-state");
    const carousel = $("#reservation-carousel");
    const indicators = $("#reservation-indicators");
    const reservations = state.reservations ?? [];

    if (!reservations.length) {
      bodyNode.hidden = true;
      emptyNode.hidden = false;
      stateLabel.textContent = "EMPTY";
      return;
    }

    bodyNode.hidden = false;
    emptyNode.hidden = true;
    runtime.reservationIndex = clamp(runtime.reservationIndex, 0, Math.max(0, reservations.length - 1));
    state.reservation = getSelectedReservation();
    stateLabel.textContent = `${pad2(reservations.length)}莉ｶ`;

    if (carousel) {
      const fragment = document.createDocumentFragment();
      reservations.slice(0, 3).forEach((reservation, index) => {
        const event = getEvent(reservation.eventId);
        const act = getAct(reservation.eventId, reservation.actId);
        const card = document.createElement("button");
        card.type = "button";
        card.className = "reservation-card";
        card.dataset.reservationIndex = String(index);
        if (runtime.reservationIndex === index) card.setAttribute("aria-current", "true");
        card.innerHTML = `
          <span class="reservation-card-index">${pad2(index + 1)}</span>
          <strong>${event.title}</strong>
          <dl>
            <div><dt>蜈ｬ貍疲律</dt><dd>${event.date}</dd></div>
            <div><dt>莨壼ｴ</dt><dd>${event.venue}</dd></div>
            <div><dt>逶ｮ蠖薙※ARTIST</dt><dd>${act.name}</dd></div>
            <div><dt>譫壽焚</dt><dd>${reservation.ticketCount}</dd></div>
          </dl>
        `;
        fragment.append(card);
      });
      carousel.replaceChildren(fragment);
    }

    if (indicators) {
      const fragment = document.createDocumentFragment();
      reservations.slice(0, 3).forEach((_, index) => {
        const dot = document.createElement("span");
        dot.className = `reservation-dot${runtime.reservationIndex === index ? " is-active" : ""}`;
        fragment.append(dot);
      });
      indicators.replaceChildren(fragment);
    }
  }

  function renderLiveCard() {
    const live = state.nextLive;
    setText("#live-state", live.status);
    setText("#live-name", live.title);
    setText("#live-start", live.start);
    setText("#live-venue", live.venue);
    setText("#live-act", getAct(live.eventId ?? state.events[0].eventId, live.actId).name);
    setText("#live-channel", live.channel);
    const flyer = $("#live-flyer-image");
    if (flyer) {
      flyer.src = live.flyerUrl || "";
      flyer.alt = `${live.title} フライヤー`;
    }
  }

  function pickDifferentIndex(length, currentIndex) {
    if (length <= 1) return 0;
    let next = currentIndex;
    while (next === currentIndex) {
      next = Math.floor(Math.random() * length);
    }
    return next;
  }

  function renderSignalCard() {
    const history = $("#signal-history");
    if (!history) return;
    const signals = Array.isArray(state.signals) ? state.signals : [];
    if (!signals.length) {
      history.innerHTML = '<p class="signal-history-empty">まだ送信したSIGNALはありません。</p>';
      return;
    }

    history.innerHTML = signals.map((signal) => {
      const artist = escapeHtml(signal.artistName ?? signal.actName ?? "ARTIST");
      const emotion = escapeHtml(signal.emotionLabel ?? "SIGNAL");
      const comment = escapeHtml(signal.commentSummary || signal.comment || "コメントなし");
      const timestamp = escapeHtml(signal.timestamp || "");
      return `<article class="signal-history-entry"><div><strong>${artist}</strong><span>${emotion}</span></div><p>${comment}</p><time>${timestamp}</time></article>`;
    }).join("");
  }

  function applySubmittedSignal(detail = {}) {
    const artistId = String(detail.artistId || detail.actId || "").trim();
    const artistName = String(detail.artistName || detail.artist || "ARTIST").trim() || "ARTIST";
    const comment = String(detail.comment || "").trim();
    const commentSummary = String(detail.commentSummary || summarizeSignalComment(comment, detail.signalLabel || detail.emotionLabel || ""));
    const timestamp = String(detail.timestamp || nowLabel()).trim();
    const nextSignal = {
      signalId: String(detail.signalId || makeId("SIG")),
      eventId: String(detail.eventId || ""),
      actId: artistId,
      artistName,
      artistImageUrl: String(detail.artistThumbnailUrl || detail.artistImageUrl || ""),
      emotion: String(detail.signalType || detail.emotion || "song"),
      emotionLabel: String(detail.signalLabel || detail.emotionLabel || "歌が良い"),
      comment,
      commentSummary,
      timestamp,
    };

    state.signals = [nextSignal, ...state.signals.filter((item) => item.signalId !== nextSignal.signalId)];
    runtime.signalIndex = 0;
    renderSignalCard();
  }

  function summarizeSignalComment(comment, emotionLabel = "") {
    const raw = String(comment ?? "").normalize("NFKC").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    const cleaned = raw.replace(/[「」『』“”"'`]/g, "").replace(/[。！？!?]+$/g, "");
    if (!cleaned) return emotionLabel || "SIGNAL";
    return cleaned.length > 18 ? `${cleaned.slice(0, 18)}…` : cleaned;
  }

  const SIGNAL_EMOTIONS = [
    { value: "song", label: "歌が良い" },
    { value: "stage", label: "ステージが良い" },
    { value: "character", label: "キャラが良い" },
  ];

  function getSignalArtistList() {
    const published = Array.isArray(window.LAOS_SIGNAL_ARTISTS)
      ? window.LAOS_SIGNAL_ARTISTS
      : Array.isArray(window.LAOS_PUBLISHED_ARTISTS)
      ? window.LAOS_PUBLISHED_ARTISTS
      : [];
    if (published.length) {
      return published.map((artist) => ({
        source: "admin",
        id: artist.id,
        name: artist.name || "ARTIST",
        imageUrl: artist.imageUrl || artist.thumbnailUrl || "",
        eventId: artist.eventId || "",
        actId: artist.actId || "",
      }));
    }

    return [];
  }

  function getSignalArtist(value) {
    const artistList = getSignalArtistList();
    const selected = artistList.find((artist) => artist.id === value);
    if (selected) {
      return { event: null, artist: selected };
    }
    return { event: null, artist: null };
  }

  function renderSignalArtistPreview() {
    const select = $("#signal-artist-select");
    const thumb = $("#signal-artist-thumb");
    const name = $("#signal-artist-name");
    if (!select || !thumb || !name) return;

    const { artist } = getSignalArtist(select.value);
    const label = artist?.name ?? "ARTIST";
    const imageUrl = artist?.imageUrl || artist?.thumbnailUrl || "";

    name.textContent = label;
    thumb.classList.toggle("has-image", Boolean(imageUrl));
    thumb.innerHTML = imageUrl
      ? `<img src="${imageUrl}" alt="${label}" />`
      : `<span aria-hidden="true">${label.slice(0, 2).toUpperCase()}</span>`;
  }

  const SIGNAL_DAILY_LIMIT = 1;
  const SIGNAL_DEMO_UNLIMITED = true;
  const SIGNAL_DAILY_STORAGE_KEY = "la_os_signal_daily_limit_v1";
  const getTokyoDateKey = () =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  const getSignalDailyStorageKey = () => `${SIGNAL_DAILY_STORAGE_KEY}:${state.user.memberId}`;
  const loadSignalDailyRecord = () => {
    try {
      const raw = localStorage.getItem(getSignalDailyStorageKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const getSignalDailyUsage = () => {
    const record = loadSignalDailyRecord();
    return record?.date === getTokyoDateKey() ? Number(record.used || 0) : 0;
  };
  const syncSignalDailyQuota = () => {
    const used = getSignalDailyUsage();
    const remaining = SIGNAL_DEMO_UNLIMITED ? Infinity : Math.max(0, SIGNAL_DAILY_LIMIT - used);
    const quotaStatus = $("#signal-limit-status");
    const quotaNote = $("#signal-limit-note");
    const submitButton = $("#signal-submit");

    if (quotaStatus) quotaStatus.textContent = SIGNAL_DEMO_UNLIMITED ? "DEMO / ∞" : `${used} / ${SIGNAL_DAILY_LIMIT}`;
    if (quotaNote) quotaNote.textContent = SIGNAL_DEMO_UNLIMITED
      ? "デモ期間中は何度でも送信できます。"
      : remaining > 0
      ? "本日は1回まで送信できます。"
      : "本日の送信上限に達しています。";
    if (submitButton) submitButton.disabled = !SIGNAL_DEMO_UNLIMITED && remaining <= 0;
  };
  const markSignalDailyUsed = () => {
    if (SIGNAL_DEMO_UNLIMITED) return;
    try {
      localStorage.setItem(getSignalDailyStorageKey(), JSON.stringify({
        date: getTokyoDateKey(),
        used: 1,
      }));
    } catch {
      // ignore
    }
  };

  function renderDanmakuCard() {
    const approved = state.danmaku.filter((entry) => entry.approved);
    const sourceList = approved.length ? approved : state.danmaku;
    if (!sourceList.length) return;

    runtime.danmakuIndex = clamp(runtime.danmakuIndex, 0, sourceList.length - 1);
    const highlight = sourceList[runtime.danmakuIndex];

    setText("#danmaku-emote", highlight.emote);
    setText("#danmaku-message", highlight.comment);
    const senderLabel = highlight.senderLabel || (highlight.memberId ? `${highlight.memberId} / ${state.user.displayName}` : state.user.displayName);
    setText("#danmaku-meta", senderLabel);
    setText("#danmaku-status", highlight.approved === false ? "PENDING" : "APPROVED");

    const complete = $("#danmaku-complete");
    const reload = $("#reload-danmaku");
    const done = runtime.danmakuReloadCount >= 5;
    if (complete) complete.hidden = !done;
    if (reload) reload.disabled = done;
  }

  function renderQuickActions() {
    const nav = $("#bottom-nav");
    if (!nav) return;

    const actions = [
      { id: "home", code: "🏠", label: "ホーム" },
      { id: "reserve", code: "📅", label: "予約" },
      { id: "signal", code: "🖋️", label: "SIGNAL" },
      { id: "onbox", code: "▶", label: "ONBOX" },
      { id: "settings", code: "⚙️", label: "設定" },
    ];

    const fragment = document.createDocumentFragment();
    actions.forEach((action) => {
      const button = document.createElement("button");
      const code = document.createElement("b");
      const label = document.createElement("span");
      button.type = "button";
      button.className = `nav-button${action.id === "home" ? " is-active" : ""}`;
      button.dataset.action = action.id;
      button.setAttribute("aria-label", action.label);
      code.className = "nav-code";
      label.className = "nav-label";
      code.textContent = action.code;
      label.textContent = action.label;
      button.append(code, label);
      fragment.append(button);
    });

    nav.replaceChildren(fragment);
  }

  function renderArchive() {
    const plus = $("#archive-plus");
    const title = $("#archive-state-title");
    const note = $("#archive-state-note");
    const expand = $("#archive-expand");
    const list = $("#archive-list");

    if (!title || !note || !expand || !list) return;

    if (plus) plus.hidden = !state.user.archiveAccess;
    title.textContent = state.user.archiveAccess ? "ARCHIVE UNLOCKED" : "ARCHIVE LOCKED";
    note.textContent = "会場でのライセンス購入で解禁されます。";

    if (!state.user.archiveAccess) {
      runtime.archiveExpanded = false;
    }

    expand.dataset.expanded = state.user.archiveAccess && runtime.archiveExpanded ? "true" : "false";
    expand.setAttribute("aria-hidden", state.user.archiveAccess && runtime.archiveExpanded ? "false" : "true");

    const fragment = document.createDocumentFragment();
    state.archives.forEach((archive) => {
      const row = document.createElement("li");
      const left = document.createElement("span");
      const right = document.createElement("span");
      left.textContent = `${archive.archiveId} / ${archive.title}`;
      right.textContent = `${archive.date} / ${archive.duration}`;
      row.append(left, right);
      fragment.append(row);
    });
    list.replaceChildren(fragment);

    const featured = state.archives[0];
    if (featured) {
      setText("#archive-video-title", `${featured.title} / ${featured.duration}`);
    }
  }

  function renderUpdateLog() {
    const list = $("#update-list");
    if (!list) return;
  }

  function renderSettingsForm() {
    setText("#settings-member-id", state.user.memberId);
  }

  function renderAll() {
    renderHeader();
    renderChamber();
    renderProgress();
    renderReservationCard();
    renderLiveCard();
    renderSignalCard();
    renderQuickActions();
  }

  function setReservationSummary(eventId, actId, ticketCount) {
    const event = getEvent(eventId);
    const act = getAct(eventId, actId);
    const node = $("#reservation-summary");
    if (!node) return;

    node.textContent = `${event.date} / ${event.title} / ${event.venue} / ${act.name} / ${ticketCount}枚`;
  }

  function updateReservationActOptions(eventId, selectedActId = null) {
    const event = getEvent(eventId);
    const actSelect = $("#reservation-act-select");
    if (!actSelect) return;

    actSelect.replaceChildren(
      ...event.acts.map((act) => makeOption(act.actId, act.name))
    );
    actSelect.value = selectedActId && event.acts.some((act) => act.actId === selectedActId)
      ? selectedActId
      : event.acts[0].actId;
  }

  function updateReservationSummaryFromForm() {
    const eventSelect = $("#reservation-event-select");
    const actSelect = $("#reservation-act-select");
    const countInput = $("#reservation-count-input");
    if (!eventSelect || !actSelect || !countInput) return;
    setReservationSummary(eventSelect.value, actSelect.value, countInput.value || 1);
  }

  function openReservationForm(mode, draft = null) {
    const dialog = $("#reservation-form-dialog");
    const eventSelect = $("#reservation-event-select");
    const actSelect = $("#reservation-act-select");
    const countInput = $("#reservation-count-input");

    runtime.reservationMode = mode;
    runtime.reservationDraft = draft;

    const current = getSelectedReservation();
    const eventId = draft?.eventId ?? current?.eventId ?? state.events[0].eventId;
    const actId = draft?.actId ?? current?.actId ?? getEvent(eventId).acts[0].actId;
    const ticketCount = draft?.ticketCount ?? current?.ticketCount ?? 1;

    if (eventSelect) {
      eventSelect.replaceChildren(
        ...state.events.map((event) => makeOption(event.eventId, `${event.date} / ${event.title}`))
      );
      eventSelect.value = eventId;
    }

    updateReservationActOptions(eventId, actId);
    if (countInput) countInput.value = String(ticketCount);
    updateReservationSummaryFromForm();
    openDialog(dialog);
  }

  function populateReservationDetail() {
    const list = $("#reservation-detail-list");
    if (!list) return;

    const reservations = state.reservations ?? [];
    const fragment = document.createDocumentFragment();

    reservations.slice(0, 3).forEach((reservation, index) => {
      const event = getEvent(reservation.eventId);
      const act = getAct(reservation.eventId, reservation.actId);
      const item = document.createElement("article");
      item.className = "reservation-detail-item";
      item.innerHTML = `
        <div class="reservation-detail-head">
          <strong>${event.title}</strong>
          <span>${pad2(index + 1)}</span>
        </div>
        <dl>
          <div><dt>蜈ｬ貍疲律</dt><dd>${event.date}</dd></div>
          <div><dt>莨壼ｴ</dt><dd>${event.venue}</dd></div>
          <div><dt>逶ｮ蠖薙※ARTIST</dt><dd>${act.name}</dd></div>
          <div><dt>譫壽焚</dt><dd>${reservation.ticketCount}</dd></div>
        </dl>
        <div class="reservation-detail-actions">
          <button type="button" class="ghost-button" data-reservation-action="edit" data-reservation-index="${index}">螟画峩縺吶ｋ</button>
          <button type="button" class="ghost-button" data-reservation-action="cancel" data-reservation-index="${index}">繧ｭ繝｣繝ｳ繧ｻ繝ｫ縺吶ｋ</button>
        </div>
      `;
      fragment.append(item);
    });
    list.replaceChildren(fragment);
  }

  function openReservationDetailDialog() {
    if (!state.reservations?.length) return;
    populateReservationDetail();
    openDialog($("#reservation-detail-dialog"));
  }

  function openCancelReservationDialog(index = runtime.reservationIndex) {
    runtime.pendingCancelIndex = index;
    openDialog($("#reservation-cancel-dialog"));
  }

  function commitReservationDraft(draft) {
    const next = {
      reservationId: draft.reservationId ?? makeId("res"),
      eventId: draft.eventId,
      actId: draft.actId,
      ticketCount: draft.ticketCount,
    };

    if (typeof draft.reservationIndex === "number" && state.reservations[draft.reservationIndex]) {
      state.reservations[draft.reservationIndex] = next;
      runtime.reservationIndex = draft.reservationIndex;
    } else if (state.reservations.length < 3) {
      state.reservations.push(next);
      runtime.reservationIndex = state.reservations.length - 1;
    } else {
      state.reservations[runtime.reservationIndex] = next;
    }

    state.reservation = getSelectedReservation();
    runtime.reservationDraft = null;
    renderReservationCard();
    setToast("予約を保存しました。");
  }

  function openOverwriteDialog(draft) {
    runtime.reservationDraft = draft;
    openDialog($("#reservation-overwrite-dialog"));
  }

  function openSignalDialog() {
    const dialog = $("#signal-dialog");
    const select = $("#signal-artist-select");
    const emotionSelect = $("#signal-emotion-select");
    const comment = $("#signal-comment");
    const artists = getSignalArtistList();

    if (select) {
      select.replaceChildren(
        ...(artists.length
          ? artists.map((artist) => makeOption(artist.id, artist.name))
          : [makeOption("", "Adminのアーティスト同期を待機中")]
        )
      );
      select.value = artists[0]?.id || "";
      select.disabled = false;
    }

    if (emotionSelect) {
      emotionSelect.replaceChildren(...SIGNAL_EMOTIONS.map((emotion) => makeOption(emotion.value, emotion.label)));
      emotionSelect.value = "song";
      emotionSelect.disabled = false;
    }

    if (comment) {
      comment.value = "";
      updateSignalCounter();
    }

    renderSignalArtistPreview();
    syncSignalDailyQuota();

    openDialog(dialog);
  }

  function updateSignalCounter() {
    const comment = $("#signal-comment");
    const counter = $("#signal-counter");
    if (!comment || !counter) return;
    counter.textContent = `${comment.value.length} / 15`;
  }

  function openDanmakuDialog() {
    const dialog = $("#danmaku-dialog");
    const comment = $("#danmaku-comment");
    renderDanmakuEmotePalette();
    setDanmakuEmote("spark");

    if (comment) {
      comment.value = "";
      updateDanmakuCounter();
    }

    const mode = runtime.danmakuSenderMode === "displayName" ? "displayName" : "id";
    const modeInput = $(`#danmaku-sender-mode-${mode === "displayName" ? "display-name" : "id"}`);
    if (modeInput) modeInput.checked = true;
    setText("#danmaku-event-label", getDanmakuEventLabel());
    syncDanmakuSenderPreview();
    syncDanmakuQuota();
    openDialog(dialog);
  }

  function updateDanmakuCounter() {
    const comment = $("#danmaku-comment");
    const counter = $("#danmaku-input-counter");
    if (!comment || !counter) return;
    counter.textContent = `${comment.value.length} / 30`;
  }

  function openSettingsDialog() {
    renderSettingsForm();
    $("#settings-display-name").value = state.user.displayName;
    $("#settings-x-account").value = state.user.xAccount;
    $("#settings-email").value = state.user.email;
    $("#settings-password").value = "";
    openDialog($("#settings-dialog"));
  }

  function renderHelpDialog() {
    const list = $("#help-list");
    if (!list) return;

    const sections = [
      ["チャンバー", "準備中です。何かが起こるかもしれません。"],
      ["シンチョク", "現在の進捗を表示しています。"],
      ["コクチ", "次回イベントのお知らせとフライヤーを表示します。"],
      ["予約", "予約の確認と変更ができます。"],
      ["SIGNAL", "アーティストに感想を届けます。"],
      ["ONBOX", "視聴用の連携先です。"],
      ["設定", "表示名やメール情報を確認・更新できます。"],
    ];

    const fragment = document.createDocumentFragment();
    sections.forEach(([title, note]) => {
      const row = document.createElement("div");
      row.className = "help-row";
      row.innerHTML = `<strong>${title}</strong><p>${note}</p>`;
      fragment.append(row);
    });
    list.replaceChildren(fragment);
  }

  function openHelpDialog() {
    renderHelpDialog();
    openDialog($("#help-dialog"));
  }

  function startSystemUpdateSequence() {
    if (runtime.systemUpdateRunning || runtime.systemUpdatePlayed || !state.user.versionUpPending) return;

    const dialog = $("#system-update-dialog");
    const title = $("#update-dialog-title");
    const note = $("#update-dialog-note");
    const fill = $("#update-dialog-fill");
    const closeButton = $("#close-update-dialog");
    const stages = $$("#system-update-dialog [data-stage]");

    const steps = [
      { label: "SYSTEM UPDATE", note: "Preparing local shell resources.", width: 18 },
      { label: "Installing", note: "Applying interface components.", width: 44 },
      { label: "Rebooting", note: "Refreshing the shell.", width: 72 },
      { label: "Complete", note: "Ready.", width: 100 },
    ];

    runtime.systemUpdateRunning = true;
    runtime.updateTimers.forEach((timer) => window.clearTimeout(timer));
    runtime.updateTimers = [];
    openDialog(dialog);
    setText("#update-dialog-title", steps[0].label);
    setText("#update-dialog-note", steps[0].note);
    if (fill) fill.style.width = `${steps[0].width}%`;
    if (closeButton) closeButton.hidden = true;

    const applyStep = (index) => {
      const step = steps[index];
      if (!step) return;
      setText("#update-dialog-title", step.label);
      setText("#update-dialog-note", step.note);
      if (fill) fill.style.width = `${step.width}%`;
      stages.forEach((stage, stageIndex) => {
        stage.classList.toggle("is-current", stageIndex === index);
        stage.classList.toggle("is-done", stageIndex < index);
      });
    };

    applyStep(0);

    const schedule = (delay, index) => {
      runtime.updateTimers.push(
        window.setTimeout(() => {
          applyStep(index);
          if (index === steps.length - 1) {
            state.user.versionUpPending = false;
            writeProfile({ versionUpPending: state.user.versionUpPending });
            runtime.systemUpdatePlayed = true;
            runtime.systemUpdateRunning = false;
            renderHeader();
            renderProgress();
            if (closeButton) closeButton.hidden = false;
            setToast("SYSTEM UPDATE complete.");
            runtime.updateTimers.push(
              window.setTimeout(() => {
                closeDialog(dialog);
              }, 1800)
            );
          }
        }, delay)
      );
    };

    schedule(0, 0);
    schedule(520, 1);
    schedule(1060, 2);
    schedule(1600, 3);
  }

  function attachEvents() {
    $("#open-home")?.addEventListener("click", (event) => {
      const homeUrl = event.currentTarget?.getAttribute("href") || "../index.html";
      if (!homeUrl || homeUrl === "#") return;
      window.location.assign(homeUrl);
    });
    $("#open-help")?.addEventListener("click", openHelpDialog);
    $("#help-close")?.addEventListener("click", () => closeDialog($("#help-dialog")));

    $("#open-settings")?.addEventListener("click", openSettingsDialog);
    $("#settings-close")?.addEventListener("click", () => closeDialog($("#settings-dialog")));
    $("#system-update-trigger")?.addEventListener("click", startSystemUpdateSequence);
    $("#close-update-dialog")?.addEventListener("click", () => closeDialog($("#system-update-dialog")));

    $("#open-reservation-details")?.addEventListener("click", openReservationDetailDialog);
    $("#open-reservation-empty")?.addEventListener("click", () => openReservationForm("create"));
    $("#reservation-detail-close")?.addEventListener("click", () => closeDialog($("#reservation-detail-dialog")));
    $("#reservation-detail-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-reservation-action]");
      if (!button) return;
      const index = Number(button.dataset.reservationIndex);
      const reservation = state.reservations[index];
      if (!reservation) return;

      const action = button.dataset.reservationAction;
      if (action === "edit") {
        closeDialog($("#reservation-detail-dialog"));
        openReservationForm("edit", { ...reservation, reservationIndex: index });
      }
      if (action === "cancel") {
        closeDialog($("#reservation-detail-dialog"));
        openCancelReservationDialog(index);
      }
    });

    $("#reservation-cancel-back")?.addEventListener("click", () => closeDialog($("#reservation-cancel-dialog")));
    $("#reservation-cancel-confirm")?.addEventListener("click", () => {
      const index = clamp(runtime.pendingCancelIndex ?? runtime.reservationIndex, 0, Math.max(0, state.reservations.length - 1));
      if (state.reservations[index]) {
        state.reservations.splice(index, 1);
      }
      runtime.pendingCancelIndex = null;
      runtime.reservationIndex = clamp(index - 1, 0, Math.max(0, state.reservations.length - 1));
      state.reservation = getSelectedReservation();
      closeDialog($("#reservation-cancel-dialog"));
      renderReservationCard();
      setToast("予約をキャンセルしました。");
    });
    $("#reservation-overwrite-back")?.addEventListener("click", () => closeDialog($("#reservation-overwrite-dialog")));
    $("#reservation-overwrite-confirm")?.addEventListener("click", () => {
      if (runtime.reservationDraft) commitReservationDraft(runtime.reservationDraft);
      closeDialog($("#reservation-overwrite-dialog"));
      closeDialog($("#reservation-form-dialog"));
      renderReservationCard();
    });

    $("#reservation-form-close")?.addEventListener("click", () => closeDialog($("#reservation-form-dialog")));
    $("#reservation-form")?.addEventListener("submit", (event) => {
      event.preventDefault();

      const eventSelect = $("#reservation-event-select");
      const actSelect = $("#reservation-act-select");
      const countInput = $("#reservation-count-input");
      if (!eventSelect || !actSelect || !countInput) return;

      const draft = {
        reservationIndex: runtime.reservationDraft?.reservationIndex ?? runtime.reservationIndex,
        eventId: eventSelect.value,
        actId: actSelect.value,
        ticketCount: Math.max(1, Number.parseInt(countInput.value, 10) || 1),
      };

      runtime.reservationDraft = draft;

      const current = state.reservations[draft.reservationIndex];
      if (current && current.eventId === draft.eventId) {
        openOverwriteDialog(draft);
        return;
      }

      commitReservationDraft(draft);
      closeDialog($("#reservation-form-dialog"));
    });

    $("#reservation-event-select")?.addEventListener("change", () => {
      const eventSelect = $("#reservation-event-select");
      if (!eventSelect) return;
      updateReservationActOptions(eventSelect.value);
      updateReservationSummaryFromForm();
    });
    $("#reservation-act-select")?.addEventListener("change", updateReservationSummaryFromForm);
    $("#reservation-count-input")?.addEventListener("input", updateReservationSummaryFromForm);

    $("#reservation-carousel")?.addEventListener("click", (event) => {
      const card = event.target.closest("button[data-reservation-index]");
      if (!card) return;
      setSelectedReservation(Number(card.dataset.reservationIndex));
    });

    $("#signal-close")?.addEventListener("click", () => closeDialog($("#signal-dialog")));
    $("#signal-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      // 保存はfirebase-core.jsに集約し、この旧ローカル処理では擬似成功を作らない。
      if (window.LAOS_SIGNAL_BACKEND_ACTIVE !== false) return;
      const select = $("#signal-artist-select");
      const emotionSelect = $("#signal-emotion-select");
      const comment = $("#signal-comment");
      const used = getSignalDailyUsage();
      if (!select || !emotionSelect || !comment) return;
      if (!SIGNAL_DEMO_UNLIMITED && used >= SIGNAL_DAILY_LIMIT) {
        setToast("本日の送信上限に達しています。");
        syncSignalDailyQuota();
        return;
      }

      const selectedValue = String(select.value);
      const { event: signalEvent, artist } = getSignalArtist(select.value);
      const emotion = SIGNAL_EMOTIONS.find((item) => item.value === emotionSelect.value) ?? SIGNAL_EMOTIONS[0];
      const message = comment.value.trim();
      if (!message) return;
      if (!artist?.id) {
        setToast("アーティスト一覧の同期を待っています。");
        return;
      }

      state.signals.unshift({
        signalId: makeId("SIG"),
        eventId: signalEvent?.eventId || "",
        actId: artist.id || selectedValue,
        artistName: artist?.name ?? select.options[select.selectedIndex]?.textContent ?? "ARTIST",
        artistImageUrl: artist?.imageUrl || "",
        emotion: emotion.value,
        emotionLabel: emotion.label,
        comment: message,
        commentSummary: summarizeSignalComment(message, emotion.label),
        timestamp: nowLabel(),
      });

      runtime.signalIndex = 0;
      markSignalDailyUsed();
      closeDialog($("#signal-dialog"));
      renderSignalCard();
      syncSignalDailyQuota();
      pulseProgress("Progressを反映しました。");
    });
    $("#signal-artist-select")?.addEventListener("change", renderSignalArtistPreview);
    $("#signal-emotion-select")?.addEventListener("change", () => {});
    $("#signal-comment")?.addEventListener("input", updateSignalCounter);
    window.addEventListener("laos-signal-submitted", (event) => {
      applySubmittedSignal(event.detail || {});
      pulseProgress("Progressを反映しました。");
    });
    window.addEventListener("laos-signal-history", (event) => {
      state.signals = Array.isArray(event.detail) ? event.detail : [];
      runtime.signalIndex = 0;
      renderSignalCard();
    });
    window.addEventListener("laos-signal-artists-updated", () => {
      window.LAOS_PUBLISHED_ARTISTS = getSignalArtistList();
      renderSignalArtistPreview();
      if ($("#signal-dialog")?.open) {
        openSignalDialog();
      }
    });

    $("#danmaku-close")?.addEventListener("click", () => closeDialog($("#danmaku-dialog")));
    $("#danmaku-dialog")?.addEventListener("change", (event) => {
      const target = event.target;
      if (!target?.matches?.('input[name="danmaku-sender-mode"]')) return;
      syncDanmakuSenderPreview();
    });
    $("#danmaku-emote-palette")?.addEventListener("click", (event) => {
      const button = event.target.closest?.(".emoji-choice");
      if (!button) return;
      setDanmakuEmote(button.dataset.emote);
    });
    $("#danmaku-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const emoteValue = $("#danmaku-emote-value");
      const comment = $("#danmaku-comment");
      const eventId = getDanmakuEventId();
      const used = getDanmakuUsage(eventId);
      const senderMode = getDanmakuSenderMode();
      if (!emoteValue || !comment) return;
      if (used >= DANMAKU_LIMIT_PER_EVENT) {
        setToast("このイベントの送信上限に達しています。");
        syncDanmakuQuota();
        return;
      }

      const message = comment.value.trim();
      if (!message) return;
      const senderLabel = getDanmakuSenderLabel(senderMode);

      state.danmaku.unshift({
        danmakuId: makeId("DMK"),
        eventId,
        emote: emoteValue.value || DANMAKU_EMOTES[0].value,
        comment: message,
        memberId: state.user.memberId,
        senderMode,
        senderLabel,
        senderMemberId: state.user.memberId,
        senderDisplayName: state.user.displayName,
        source: "DANMAKU",
        progressGain: 1,
        approved: false,
      });
      runtime.danmakuSendCounts[eventId] = used + 1;

      closeDialog($("#danmaku-dialog"));
      syncDanmakuQuota();
      pulseProgress("送信内容を反映しました。");
    });
    $("#danmaku-comment")?.addEventListener("input", updateDanmakuCounter);

    $("#danmaku-help")?.addEventListener("click", openHelpDialog);

    $("#reload-danmaku")?.addEventListener("click", () => {
      if (runtime.danmakuReloadCount >= 5) return;
      runtime.danmakuReloadCount += 1;
      runtime.danmakuIndex = pickDifferentIndex(
        state.danmaku.filter((entry) => entry.approved).length || state.danmaku.length,
        runtime.danmakuIndex
      );
      pulseProgress("Progressを反映しました。");
      if (runtime.danmakuReloadCount >= 5) {
        setToast("Today's Progress Complete.");
      }
    });

    $("#archive-plus")?.addEventListener("click", () => {
      if (!state.user.archiveAccess) return;
      runtime.archiveExpanded = !runtime.archiveExpanded;
      setToast(runtime.archiveExpanded ? "アーカイブを展開しました。" : "アーカイブを閉じました。");
    });

    $("#settings-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.user.displayName = $("#settings-display-name").value.trim() || state.user.displayName;
      state.user.xAccount = $("#settings-x-account").value.trim();
      state.user.email = $("#settings-email").value.trim();
      state.user.password = $("#settings-password").value;
      writeProfile({
        displayName: state.user.displayName,
        email: state.user.email,
        xAccount: state.user.xAccount,
      });
      renderHeader();
      closeDialog($("#settings-dialog"));
      setToast("保存しました。");
    });

    $("#reservation-form-dialog")?.addEventListener("close", () => {
      runtime.reservationDraft = null;
    });

    $("#signal-dialog")?.addEventListener("close", () => {
      const comment = $("#signal-comment");
      if (comment) comment.value = "";
    });

    $("#danmaku-dialog")?.addEventListener("close", () => {
      const comment = $("#danmaku-comment");
      if (comment) comment.value = "";
    });

    $("#settings-dialog")?.addEventListener("close", () => {
      const password = $("#settings-password");
      if (password) password.value = "";
    });

    $("#bottom-nav")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      if (action === "home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (action === "reserve") {
        openReservationForm("create");
      } else if (action === "signal") {
        $("#signal-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (action === "onbox") {
        window.location.assign(new URL("../la-on-box/watch", window.location.href).href);
        return;
      } else if (action === "settings") {
        openSettingsDialog();
      }

      const labels = {
        home: "ホームに戻りました。",
        reserve: "予約を開きました。",
        signal: "シグナルへ移動しました。",
        onbox: "ONBOXを開きました。",
        settings: "設定を開きました。",
      };
      setToast(labels[action] ?? "");
    });
  }

  function initializeDialogs() {
    const reservationDialog = $("#reservation-detail-dialog");
    const formDialog = $("#reservation-form-dialog");
    const signalDialog = $("#signal-dialog");
    const danmakuDialog = $("#danmaku-dialog");
    const settingsDialog = $("#settings-dialog");
    const helpDialog = $("#help-dialog");
    const updateDialog = $("#system-update-dialog");

    [reservationDialog, formDialog, signalDialog, danmakuDialog, settingsDialog, helpDialog, updateDialog].forEach(
      (dialog) => {
        dialog?.addEventListener("cancel", (event) => {
          event.preventDefault();
          closeDialog(dialog);
        });
      }
    );

    reservationDialog?.addEventListener("close", () => {});
    formDialog?.addEventListener("close", () => {});
    signalDialog?.addEventListener("close", () => {});
    danmakuDialog?.addEventListener("close", () => {});
    settingsDialog?.addEventListener("close", () => {});
    helpDialog?.addEventListener("close", () => {});
    updateDialog?.addEventListener("close", () => {
      if (!runtime.systemUpdateRunning) {
        runtime.systemUpdatePlayed = true;
      }
    });
  }

  function wireFormCounters() {
    $("#signal-comment")?.addEventListener("input", updateSignalCounter);
    $("#danmaku-comment")?.addEventListener("input", updateDanmakuCounter);
  }

  function bootstrap() {
    renderAll();
    renderSettingsForm();
    attachEvents();
    initializeDialogs();
    wireFormCounters();
    updateSignalCounter();
    updateDanmakuCounter();
  }

  bootstrap();
})();
