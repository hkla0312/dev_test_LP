/* global firebase, FIREBASE_CONFIG */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char]);

  const SIGNAL_DAILY_STORAGE_KEY = "la_os_signal_daily_limit_v1";
  const SIGNAL_DAILY_LIMIT = 1;
  const SIGNAL_EMOTIONS = [
    { value: "song", label: "歌が良い" },
    { value: "stage", label: "ステージが良い" },
    { value: "character", label: "キャラが良い" },
    { value: "other", label: "そのほか" },
  ];

  let publishedArtists = [];
  let systemSettings = { signalEnabled: true, systemEnabled: true };
  let currentUser = null;
  let currentMember = null;
  let signalSubmitBound = false;
  let danmakuSubmitBound = false;

  function getFunctionsApi() {
    return typeof firebase.functions === "function" ? firebase.functions() : null;
  }

  function tokyoDateKey() {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  }

  function signalStorageKey() {
    const memberId = currentMember?.memberId || currentUser?.uid || "guest";
    return `${SIGNAL_DAILY_STORAGE_KEY}:${memberId}`;
  }

  function loadSignalUsage() {
    try {
      const raw = localStorage.getItem(signalStorageKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getSignalUsageCount() {
    const record = loadSignalUsage();
    return record?.date === tokyoDateKey() ? Number(record.used || 0) : 0;
  }

  function syncSignalQuota() {
    const used = getSignalUsageCount();
    const remaining = Math.max(0, SIGNAL_DAILY_LIMIT - used);
    const quotaStatus = $("#signal-limit-status");
    const quotaNote = $("#signal-limit-note");
    const submitButton = $("#signal-submit");

    if (quotaStatus) quotaStatus.textContent = `${used} / ${SIGNAL_DAILY_LIMIT}`;
    if (quotaNote) {
      quotaNote.textContent = remaining > 0
        ? "本日は1回まで送信できます。"
        : "本日の送信上限に達しています。";
    }
    if (submitButton) submitButton.disabled = remaining <= 0;
  }

  function markSignalUsed() {
    try {
      localStorage.setItem(signalStorageKey(), JSON.stringify({
        date: tokyoDateKey(),
        used: 1,
      }));
    } catch {
      // ignore
    }
  }

  function flashProgressPulse() {
    const card = document.querySelector(".progress-card");
    if (!card) return;
    card.classList.add("is-pulse");
    window.setTimeout(() => card.classList.remove("is-pulse"), 420);
  }

  function toast(message) {
    const node = $("#system-toast");
    if (node) node.textContent = message;
  }

  function refreshSignalForm() {
    const artistSelect = $("#signal-artist-select");
    const emotionSelect = $("#signal-emotion-select");
    if (artistSelect) {
      const previous = artistSelect.value;
      artistSelect.innerHTML = publishedArtists.length
        ? publishedArtists.map((artist) => `<option value="${escape(artist.id)}">${escape(artist.name)}</option>`).join("")
        : '<option value="">公開中のアーティストがありません</option>';
      if (publishedArtists.some((artist) => artist.id === previous)) {
        artistSelect.value = previous;
      }
    }

    if (emotionSelect) {
      const previous = emotionSelect.value;
      emotionSelect.innerHTML = SIGNAL_EMOTIONS
        .map((emotion) => `<option value="${escape(emotion.value)}">${escape(emotion.label)}</option>`)
        .join("");
      if (SIGNAL_EMOTIONS.some((emotion) => emotion.value === previous)) {
        emotionSelect.value = previous;
      }
    }

    syncSignalQuota();
  }

  function updateSignalPreview(artistId, commentText, timestampText) {
    const artist = publishedArtists.find((item) => item.id === artistId);
    const name = artist?.name || "ARTIST";
    const imageUrl = artist?.imageUrl || "";

    const previewThumb = $("#signal-artist-thumb");
    const previewName = $("#signal-artist-name");
    if (previewThumb && previewName) {
      previewName.textContent = name;
      previewThumb.classList.toggle("has-image", Boolean(imageUrl));
      previewThumb.innerHTML = imageUrl
        ? `<img src="${imageUrl}" alt="${escape(name)}" />`
        : `<span aria-hidden="true">${escape(String(name).slice(0, 2).toUpperCase())}</span>`;
    }

    const cardMessage = $("#signal-message");
    const cardTarget = $("#signal-target");
    const cardTime = $("#signal-time");
    if (cardMessage) cardMessage.textContent = commentText;
    if (cardTarget) cardTarget.textContent = name;
    if (cardTime) cardTime.textContent = timestampText;
  }

  async function loadCurrentMember(user) {
    currentUser = user || null;
    currentMember = null;
    if (!user) {
      syncSignalQuota();
      return null;
    }

    try {
      const snapshot = await firebase.firestore().collection("members").doc(user.uid).get();
      currentMember = snapshot.exists ? snapshot.data() : null;
    } catch (error) {
      console.warn("member profile read skipped", error);
      currentMember = null;
    }

    syncSignalQuota();
    return currentMember;
  }

  async function writeSignalFallback(db, user, artistId, signalType, comment) {
    const member = currentMember || await loadCurrentMember(user);
    if (!member) {
      throw new Error("member-not-found");
    }

    const artistSnapshot = await db.collection("artists").doc(artistId).get();
    if (!artistSnapshot.exists) {
      throw new Error("artist-not-found");
    }

    const artist = artistSnapshot.data() || {};
    await db.collection("artistSignals").add({
      artistId,
      artistKey: artist.artistKey || artistId,
      artistName: artist.name || artist.artistKey || artistId,
      artistThumbnailUrl: artist.thumbnailUrl || artist.imageUrl || "",
      memberUid: user.uid,
      memberId: member.memberId || "",
      memberDisplayName: member.displayName || user.displayName || user.email || "LA_OS",
      signalType,
      signalLabel: SIGNAL_EMOTIONS.find((item) => item.value === signalType)?.label || signalType,
      comment,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      environment: "prod",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function submitSignal(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const artistId = $("#signal-artist-select")?.value || "";
    const signalType = $("#signal-emotion-select")?.value || "";
    const comment = $("#signal-comment")?.value.trim() || "";
    const used = getSignalUsageCount();

    if (!systemSettings.systemEnabled || !systemSettings.signalEnabled) {
      toast("現在この機能は一時停止中です");
      return;
    }
    if (used >= SIGNAL_DAILY_LIMIT) {
      toast("本日の送信上限に達しています。");
      syncSignalQuota();
      return;
    }
    if (!artistId || !SIGNAL_EMOTIONS.some((item) => item.value === signalType) || !comment) {
      return;
    }

    const functionsApi = getFunctionsApi();
    try {
      if (functionsApi) {
        const callable = functionsApi.httpsCallable("submitSignal");
        await callable({ artistId, signalType, comment });
      } else {
        await writeSignalFallback(firebase.firestore(), currentUser, artistId, signalType, comment);
      }

      const timestampText = new Date().toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      }).replace(/\//g, "/");
      updateSignalPreview(artistId, comment, `${timestampText} JST`);
      markSignalUsed();
      syncSignalQuota();
      flashProgressPulse();
      toast("SIGNALを送信しました。");
      $("#signal-comment") && ($("#signal-comment").value = "");
      $("#signal-dialog")?.close();
    } catch (error) {
      const errorText = error?.code === "permission-denied"
        ? "SIGNALを送信する権限がありません。"
        : "SIGNALの送信に失敗しました。";
      toast(errorText);
      console.error("SIGNAL送信エラー", error);
    }
  }

  async function submitDanmaku(event) {
    event.preventDefault();

    const functionsApi = getFunctionsApi();
    if (!functionsApi) {
      return;
    }

    const comment = $("#danmaku-comment")?.value.trim() || "";
    const emote = $("#danmaku-emote-value")?.value || "";
    const senderMode = $("#danmaku-sender-mode-display-name")?.checked ? "displayName" : "id";
    if (!comment || !emote) {
      return;
    }

    try {
      const callable = functionsApi.httpsCallable("submitDanmaku");
      const result = await callable({ comment, emote, senderMode });
      if (typeof result?.data?.remaining === "number") {
        const quotaStatus = $("#danmaku-quota-status");
        if (quotaStatus) quotaStatus.textContent = `${5 - result.data.remaining} / 5`;
      }
    } catch (error) {
      const toastText = error?.code === "permission-denied"
        ? "DANMAKUを送信する権限がありません。"
        : "DANMAKUの送信に失敗しました。";
      toast(toastText);
      console.error("DANMAKU送信エラー", error);
    }
  }

  function bindSignalForm() {
    const form = $("#signal-form");
    if (!form || signalSubmitBound) return;
    signalSubmitBound = true;
    form.addEventListener("submit", submitSignal, true);
  }

  function bindDanmakuForm() {
    const form = $("#danmaku-form");
    if (!form || danmakuSubmitBound) return;
    danmakuSubmitBound = true;
    form.addEventListener("submit", submitDanmaku);
  }

  function watchSystemSettings(db) {
    db.collection("settings").doc("system").onSnapshot(
      (snapshot) => {
        systemSettings = { signalEnabled: true, systemEnabled: true, ...(snapshot.exists ? snapshot.data() : {}) };
      },
      (error) => {
        toast("機能設定の読み込みに失敗しました。");
        console.error("system settings snapshot error", error);
      }
    );
  }

  function watchPublishedArtists(db) {
    db.collection("artists")
      .where("lpVisible", "==", true)
      .where("environment", "==", "prod")
      .onSnapshot(
        (snapshot) => {
          publishedArtists = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || "ARTIST",
            imageUrl: doc.data().thumbnailUrl || doc.data().imageUrl || "",
          }));
          refreshSignalForm();
        },
        (error) => console.error("artist snapshot error", error)
      );
  }

  function bindSignalOpenPreview() {
    const dialog = $("#signal-dialog");
    if (dialog) {
      new MutationObserver(refreshSignalForm).observe(dialog, { attributes: true, attributeFilter: ["open"] });
    }
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;
    if (!firebase.apps.length) return;

    const db = firebase.firestore();
    await loadCurrentMember(user);
    watchSystemSettings(db);
    watchPublishedArtists(db);
    bindSignalForm();
    bindDanmakuForm();
    bindSignalOpenPreview();
    refreshSignalForm();
  });
})();
