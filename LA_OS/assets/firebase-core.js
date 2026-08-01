/* global firebase, FIREBASE_CONFIG */
(() => {
  window.LAOS_SIGNAL_BACKEND_ACTIVE = true;
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
  const SIGNAL_DEMO_UNLIMITED = true;
  const SIGNAL_EMOTIONS = [
    { value: "song", label: "歌が良い" },
    { value: "stage", label: "ステージが良い" },
    { value: "character", label: "キャラが良い" },
  ];

  let publishedArtists = [];
  let systemSettings = { signalEnabled: true, systemEnabled: true };
  let currentUser = null;
  let currentMember = null;
  let signalSubmitBound = false;
  let danmakuSubmitBound = false;
  let currentBackendIssue = null;
  let unsubscribeMemberSignals = null;

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
    const remaining = SIGNAL_DEMO_UNLIMITED ? Infinity : Math.max(0, SIGNAL_DAILY_LIMIT - used);
    const quotaStatus = $("#signal-limit-status");
    const quotaNote = $("#signal-limit-note");
    const submitButton = $("#signal-submit");

    if (quotaStatus) quotaStatus.textContent = SIGNAL_DEMO_UNLIMITED ? "DEMO / ∞" : `${used} / ${SIGNAL_DAILY_LIMIT}`;
    if (quotaNote) {
      quotaNote.textContent = SIGNAL_DEMO_UNLIMITED
        ? "デモ期間中は何度でも送信できます。"
        : remaining > 0
        ? "本日は1回まで送信できます。"
        : "本日の送信上限に達しています。";
    }
    if (submitButton) submitButton.disabled = !SIGNAL_DEMO_UNLIMITED && remaining <= 0;
  }

  function markSignalUsed() {
    if (SIGNAL_DEMO_UNLIMITED) return;
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

  function buildBackendIssue(error, area, action, context = {}) {
    const helper = window.LAErrorReporting;
    const classified = helper?.classifyError
      ? helper.classifyError(error, {
          source: "laos",
          area,
          action,
        })
      : null;

    return {
      message: helper?.formatUserMessage
        ? helper.formatUserMessage(error, {
            source: "laos",
            area,
            action,
            actionLabel: action,
          })
        : `${action}に失敗しました。`,
      reportable: Boolean(classified?.reportable),
      code: classified?.code || String(error?.code || ""),
      error,
      area,
      action,
      context,
    };
  }

  function toast(message, issue = null) {
    const node = $("#system-toast");
    const reportButton = $("#system-toast-report");
    if (node) node.textContent = message;
    currentBackendIssue = issue?.reportable ? issue : null;
    if (reportButton) {
      reportButton.hidden = !currentBackendIssue;
      reportButton.onclick = currentBackendIssue ? reportBackendIssue : null;
    }
  }

  async function reportBackendIssue() {
    if (!currentBackendIssue?.reportable) {
      return;
    }

    const functionsApi = getFunctionsApi();
    if (!functionsApi) {
      toast("報告機能の準備ができていません。");
      return;
    }

    try {
      const callable = functionsApi.httpsCallable("reportBackendError");
      const helper = window.LAErrorReporting;
      const payload = helper?.buildReportPayload
        ? helper.buildReportPayload(currentBackendIssue.error, {
            source: "laos",
            area: currentBackendIssue.area,
            action: currentBackendIssue.action,
            pageUrl: window.location.href,
            ...currentBackendIssue.context,
          })
        : {
            source: "laos",
            area: currentBackendIssue.area,
            action: currentBackendIssue.action,
            pageUrl: window.location.href,
            errorCode: currentBackendIssue.code || "BACKEND_UNKNOWN",
            errorCategory: "backend",
            message: currentBackendIssue.message,
          };
      await callable(payload);
      currentBackendIssue = null;
      toast("報告を送信しました。");
    } catch (error) {
      toast(
        error?.code === "permission-denied"
          ? "報告の送信権限がありません。"
          : "報告の送信に失敗しました。"
      );
      console.error("backend report error", error);
    }
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

    // 常設フォームの表示内容も、取得済みの選択値と必ず同期する。
    artistSelect?.dispatchEvent(new Event("change", { bubbles: true }));
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
    const ref = await db.collection("artistSignals").add({
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
    return {
      signalId: ref.id,
      artistId,
      artistName: artist.name || artist.artistKey || artistId,
      artistThumbnailUrl: artist.thumbnailUrl || artist.imageUrl || "",
      signalType,
      signalLabel: SIGNAL_EMOTIONS.find((item) => item.value === signalType)?.label || signalType,
      comment,
      commentSummary: comment.length > 18 ? `${comment.slice(0, 18)}…` : comment,
    };
  }

  async function submitSignal(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const artistId = $("#signal-artist-select")?.value || "";
    const signalType = $("#signal-emotion-select")?.value || "";
    const comment = $("#signal-comment")?.value.trim() || "";
    const used = getSignalUsageCount();

    if (!currentUser || !currentMember) {
      toast("ログイン状態を確認中です。数秒後にもう一度お試しください。");
      return;
    }
    if (!systemSettings.systemEnabled || !systemSettings.signalEnabled) {
      toast("現在この機能は一時停止中です");
      return;
    }
    if (!SIGNAL_DEMO_UNLIMITED && used >= SIGNAL_DAILY_LIMIT) {
      toast("本日の送信上限に達しています。");
      syncSignalQuota();
      return;
    }
    if (!artistId || !SIGNAL_EMOTIONS.some((item) => item.value === signalType) || !comment) {
      return;
    }

    const functionsApi = getFunctionsApi();
    try {
      let result = null;
      if (functionsApi) {
        const callable = functionsApi.httpsCallable("submitSignal");
        result = await callable({ artistId, signalType, comment });
      } else {
        result = await writeSignalFallback(firebase.firestore(), currentUser, artistId, signalType, comment);
      }
      const payload = result?.data || result || {};

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
      window.dispatchEvent(new CustomEvent("laos-signal-submitted", {
        detail: {
          ...payload,
          artistId,
          signalType,
          comment,
          timestamp: `${timestampText} JST`,
        },
      }));
      toast("SIGNALを送信しました。");
      $("#signal-comment") && ($("#signal-comment").value = "");
      $("#signal-dialog")?.close();
    } catch (error) {
      const issue = buildBackendIssue(error, "signal", "SIGNAL送信", {
        artistId,
        signalType,
      });
      toast(issue.message, issue);
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
      const issue = buildBackendIssue(error, "danmaku", "DANMAKU送信", {
        senderMode,
      });
      toast(issue.message, issue);
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
        const issue = buildBackendIssue(error, "settings", "機能設定の読み込み");
        toast(issue.message, issue);
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
        (error) => {
          const issue = buildBackendIssue(error, "artists", "アーティスト一覧の読み込み");
          toast(issue.message, issue);
          console.error("artist snapshot error", error);
        }
      );
  }

  // 本人が送った、削除されていない本番SIGNALだけを履歴へ反映する。
  function watchMemberSignals(db, user) {
    unsubscribeMemberSignals?.();
    unsubscribeMemberSignals = db.collection("artistSignals")
      .where("memberUid", "==", user.uid)
      .where("environment", "==", "prod")
      .where("isDeleted", "==", false)
      .onSnapshot(
        (snapshot) => {
          const signals = snapshot.docs.map((doc) => {
            const data = doc.data() || {};
            const createdAt = data.createdAt?.toDate?.();
            const timestamp = createdAt
              ? `${new Intl.DateTimeFormat("ja-JP", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "Asia/Tokyo",
                }).format(createdAt)} JST`
              : "";
            return {
              signalId: doc.id,
              artistId: data.artistId || "",
              artistName: data.artistName || "ARTIST",
              signalType: data.signalType || "",
              emotionLabel: data.signalLabel || "SIGNAL",
              comment: data.comment || "",
              commentSummary: data.comment || "",
              timestamp,
              createdAtMs: createdAt?.getTime?.() || 0,
            };
          }).sort((a, b) => b.createdAtMs - a.createdAtMs);
          window.dispatchEvent(new CustomEvent("laos-signal-history", { detail: signals }));
        },
        (error) => {
          console.error("member signal history snapshot error", error);
          window.dispatchEvent(new CustomEvent("laos-signal-history", { detail: [] }));
        }
      );
  }

  function bindSignalOpenPreview() {
    const dialog = $("#signal-dialog");
    if (dialog) {
      new MutationObserver(refreshSignalForm).observe(dialog, { attributes: true, attributeFilter: ["open"] });
    }
  }

  // フォームは先に登録し、ログイン情報の到着を待つ間も無反応にしない。
  bindSignalForm();
  bindSignalOpenPreview();

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;
    if (!firebase.apps.length) return;

    const db = firebase.firestore();
    await loadCurrentMember(user);
    watchSystemSettings(db);
    watchPublishedArtists(db);
    watchMemberSignals(db, user);
    bindDanmakuForm();
    refreshSignalForm();
  });
})();
