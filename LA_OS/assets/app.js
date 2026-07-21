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
    },
    signals: [
      {
        signalId: "SIG-042",
        eventId: "evt-001",
        actId: "act-002",
        artistName: "ARTIST 02",
        comment: "テストメッセージ 01",
        timestamp: "2026/04/01 18:00 JST",
      },
      {
        signalId: "SIG-041",
        eventId: "evt-002",
        actId: "act-003",
        artistName: "ARTIST 03",
        comment: "テストメッセージ 02",
        timestamp: "2026/04/01 17:34 JST",
      },
      {
        signalId: "SIG-040",
        eventId: "evt-003",
        actId: "act-005",
        artistName: "ARTIST 05",
        comment: "テストメッセージ 03",
        timestamp: "2026/04/01 17:08 JST",
      },
    ],
    danmaku: [
      {
        danmakuId: "DMK-021",
        emote: "spark",
        comment: "今の流れ好き",
        memberId: "#000184",
        source: "LIVE #013 / 20:18",
        approved: true,
      },
      {
        danmakuId: "DMK-020",
        emote: "wave",
        comment: "ここで来た",
        memberId: "#000312",
        source: "LIVE #012 / 20:06",
        approved: true,
      },
      {
        danmakuId: "DMK-019",
        emote: "glow",
        comment: "静かに高まる",
        memberId: "#000085",
        source: "LIVE #011 / 19:58",
        approved: true,
      },
      {
        danmakuId: "DMK-018",
        emote: "pulse",
        comment: "この瞬間を待ってた",
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
        note: "UIシェルを初期化しました。",
      },
      {
        version: "v0.01",
        date: "2031.07.01",
        note: "アーカイブプレビューを調整しました。",
      },
    ],
  };

  const clone = typeof structuredClone === "function"
    ? structuredClone(initialState)
    : JSON.parse(JSON.stringify(initialState));

  const state = clone;
  const runtime = {
    archiveExpanded: false,
    reservationDraft: null,
    reservationIndex: 0,
    pendingCancelIndex: null,
    reservationMode: "create",
    signalIndex: 0,
    danmakuIndex: 0,
    danmakuReloadCount: 0,
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
    setText("#chamber-state", "STABLE");
    setText("#chamber-depth", "DEPTH 04.2");

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
      ? "進捗を表示中。なにか起こるかも。"
      : "アップデート完了。";
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
    stateLabel.textContent = `${pad2(reservations.length)}件`;

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
            <div><dt>公演日</dt><dd>${event.date}</dd></div>
            <div><dt>会場</dt><dd>${event.venue}</dd></div>
            <div><dt>目当てARTIST</dt><dd>${act.name}</dd></div>
            <div><dt>枚数</dt><dd>${reservation.ticketCount}</dd></div>
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
    const signals = state.signals;
    if (!signals.length) return;
    runtime.signalIndex = clamp(runtime.signalIndex, 0, signals.length - 1);
    const signal = signals[runtime.signalIndex];
    setText("#signal-message", signal.comment);
    setText("#signal-target", signal.artistName ?? signal.actName ?? "ARTIST");
    setText("#signal-time", signal.timestamp);
  }

  function renderDanmakuCard() {
    const approved = state.danmaku.filter((entry) => entry.approved);
    const sourceList = approved.length ? approved : state.danmaku;
    if (!sourceList.length) return;

    runtime.danmakuIndex = clamp(runtime.danmakuIndex, 0, sourceList.length - 1);
    const highlight = sourceList[runtime.danmakuIndex];

    setText("#danmaku-emote", highlight.emote);
    setText("#danmaku-message", highlight.comment);
    setText("#danmaku-meta", `${highlight.memberId} / ${state.user.displayName}`);
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
      { id: "home", label: "ホーム", icon: "🏠" },
      { id: "reserve", label: "予約", icon: "📅" },
      { id: "signal", label: "シグナル", icon: "🖊️" },
      { id: "danmaku", label: "ダンマク", icon: "🖥️" },
      { id: "settings", label: "設定", icon: "⚙️" },
    ];

    const fragment = document.createDocumentFragment();
    actions.forEach((action) => {
      const button = document.createElement("button");
      const icon = document.createElement("span");
      const label = document.createElement("span");
      button.type = "button";
      button.className = `nav-button${action.id === "home" ? " is-active" : ""}`;
      button.dataset.action = action.id;
      button.setAttribute("aria-label", action.label);
      icon.className = "nav-icon";
      label.className = "nav-label";
      icon.textContent = action.icon;
      label.textContent = action.label;
      button.append(icon, label);
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
    note.textContent = "注釈：会場でのライセンス購入が必要です。";

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
    renderDanmakuCard();
    renderQuickActions();
    renderArchive();
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
          <div><dt>公演日</dt><dd>${event.date}</dd></div>
          <div><dt>会場</dt><dd>${event.venue}</dd></div>
          <div><dt>目当てARTIST</dt><dd>${act.name}</dd></div>
          <div><dt>枚数</dt><dd>${reservation.ticketCount}</dd></div>
        </dl>
        <div class="reservation-detail-actions">
          <button type="button" class="ghost-button" data-reservation-action="edit" data-reservation-index="${index}">変更する</button>
          <button type="button" class="ghost-button" data-reservation-action="cancel" data-reservation-index="${index}">キャンセルする</button>
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

    if (select) {
      const artists = state.events.flatMap((event) =>
        event.acts.map((artist) => ({
          eventId: event.eventId,
          actId: artist.actId,
          name: artist.name,
        }))
      );
      select.replaceChildren(
        ...artists.map((artist) => makeOption(`${artist.eventId}::${artist.actId}`, artist.name))
      );
      select.value = artists[0] ? `${artists[0].eventId}::${artists[0].actId}` : "";
    }

    if (emotionSelect && !emotionSelect.options.length) {
      emotionSelect.replaceChildren(
        makeOption("good-vocals", "歌が良い"),
        makeOption("good-stage", "ステージが良い"),
        makeOption("good-character", "キャラが良い")
      );
      emotionSelect.value = "good-vocals";
    }

    if (comment) {
      comment.value = "";
      updateSignalCounter();
    }

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
    const select = $("#danmaku-emote-select");

    if (select && !select.options.length) {
      select.replaceChildren(
        makeOption("spark", "spark"),
        makeOption("wave", "wave"),
        makeOption("pulse", "pulse"),
        makeOption("glow", "glow")
      );
      select.value = "spark";
    }

    if (comment) {
      comment.value = "";
      updateDanmakuCounter();
    }

    setText("#danmaku-sender-id", state.user.memberId);
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
      ["チャンバー", "何かが起こるかもしれません(ComingSoon)"],
      ["シンチョク", "何かが起こるかもしれません(ComingSoon)"],
      ["コクチ", "次回イベント開催のお知らせ"],
      ["シグナル", "アナタが推しに届けたメッセ―ジが表示されています"],
      ["ミンナノダンマク", "ミンナが会場に届けた弾幕が表示されています"],
      ["リロード", "リロードすることで何かのシンチョクがあがります"],
      ["アーカイブ", "過去のイベント映像を公開しています（会場でライセンス購入することで解禁されます。）"],
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
      event.preventDefault();
      setToast("Home URL は仮です。");
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
      const select = $("#signal-artist-select");
      const emotionSelect = $("#signal-emotion-select");
      const comment = $("#signal-comment");
      if (!select || !emotionSelect || !comment) return;

      const [eventId, actId] = String(select.value).split("::");
      const artist = state.events
        .find((event) => event.eventId === eventId)
        ?.acts.find((item) => item.actId === actId);
      const message = comment.value.trim();
      if (!message) return;

      state.signals.unshift({
        signalId: makeId("SIG"),
        eventId: eventId || state.events[0].eventId,
        actId: artist?.actId ?? actId ?? select.value,
        artistName: artist?.name ?? select.options[select.selectedIndex]?.textContent ?? "ARTIST",
        emotion: emotionSelect.value,
        comment: message,
        timestamp: nowLabel(),
      });

      runtime.signalIndex = 0;
      closeDialog($("#signal-dialog"));
      renderSignalCard();
      pulseProgress("Progressを反映しました。");
    });
    $("#signal-comment")?.addEventListener("input", updateSignalCounter);

    $("#danmaku-close")?.addEventListener("click", () => closeDialog($("#danmaku-dialog")));
    $("#danmaku-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const select = $("#danmaku-emote-select");
      const comment = $("#danmaku-comment");
      if (!select || !comment) return;

      const message = comment.value.trim();
      if (!message) return;

      state.danmaku.unshift({
        danmakuId: makeId("DMK"),
        emote: select.value,
        comment: message,
        memberId: state.user.memberId,
        source: "PENDING / ADMIN REVIEW",
        approved: false,
      });

      closeDialog($("#danmaku-dialog"));
      renderDanmakuCard();
      pulseProgress("Progressを反映しました。");
    });
    $("#danmaku-comment")?.addEventListener("input", updateDanmakuCounter);

    $("#danmaku-help")?.addEventListener("click", openHelpDialog);

    $("#reload-signal")?.addEventListener("click", () => {
      const nextIndex = pickDifferentIndex(state.signals.length, runtime.signalIndex);
      runtime.signalIndex = nextIndex;
      renderSignalCard();
      setToast("シグナルを更新しました。");
    });

    $("#reload-danmaku")?.addEventListener("click", () => {
      if (runtime.danmakuReloadCount >= 5) return;
      runtime.danmakuReloadCount += 1;
      runtime.danmakuIndex = pickDifferentIndex(
        state.danmaku.filter((entry) => entry.approved).length || state.danmaku.length,
        runtime.danmakuIndex
      );
      renderDanmakuCard();
      pulseProgress("Progressを反映しました。");
      if (runtime.danmakuReloadCount >= 5) {
        setToast("Today's Progress Complete.");
      }
    });

    $("#archive-plus")?.addEventListener("click", () => {
      if (!state.user.archiveAccess) return;
      runtime.archiveExpanded = !runtime.archiveExpanded;
      renderArchive();
      setToast(runtime.archiveExpanded ? "アーカイブを展開しました。" : "アーカイブを閉じました。");
    });

    $("#settings-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.user.displayName = $("#settings-display-name").value.trim() || state.user.displayName;
      state.user.xAccount = $("#settings-x-account").value.trim();
      state.user.email = $("#settings-email").value.trim();
      state.user.password = $("#settings-password").value;
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
        openSignalDialog();
      } else if (action === "danmaku") {
        openDanmakuDialog();
      } else if (action === "settings") {
        openSettingsDialog();
      }

      const labels = {
        home: "ホームに戻りました。",
        reserve: "予約を開きました。",
        signal: "シグナルを開きました。",
        danmaku: "DANMAKUを開きました。",
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
