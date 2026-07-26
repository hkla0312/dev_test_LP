const LP_DANMAKU_SAMPLES = [
  "#0001: \u6700\u9ad8\u3067\u3059", "#0002: THIS IS LIVE", "#0003: \u97f3\u304c\u8eab\u4f53\u306b\u97ff\u304f",
  "#0004: \u30b9\u30c6\u30fc\u30b8\u304c\u7729\u3057\u3044", "#0005: \u307e\u3060\u7d42\u308f\u3089\u306a\u3044",
  "#0006: \u5fc3\u304c\u9707\u3048\u308b", "#0007: \u4f1a\u5834\u304c\u3072\u3068\u3064\u306b\u306a\u3063\u305f",
  "#0008: \u3042\u308a\u304c\u3068\u3046", "#0009: \u3082\u3063\u3068\u4e0a\u3078", "#0010: LEGENDARY"
];
const GUEST_STORAGE_KEY = "laLpDanmakuGuestV2";
const GUEST_LIMIT = 5;
const LP_EVENT_LIMIT = 300;
const SAMPLE_COLLECTION = "lpDanmakuSamples";
const EVENT_COLLECTION = "demoDanamku";

function generateGuestName() { return String(Math.floor(Math.random() * 10000)).padStart(4, "0"); }
function getGuest() {
  try { const saved = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY)); if (saved?.guestId && /^\d{4}$/.test(saved.displayName || "")) return saved; } catch (_) { /* Create a new local guest. */ }
  const guest = { guestId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, displayName: generateGuestName(), displayNameLocked: false, submissions: [] };
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
  return guest;
}
function saveGuest(guest) { localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest)); }

window.addEventListener("load", () => {
  const stage = document.querySelector("#lp-danmaku-track");
  const welcome = document.querySelector("#guest-welcome");
  const eventKey = document.querySelector("#lp-danmaku-event-key");
  const monitorEvent = document.querySelector("#lp-danmaku-monitor-event");
  const nameDisplay = document.querySelector("#guest-name-display");
  const form = document.querySelector("#lp-danmaku-form");
  const comment = document.querySelector("#lp-danmaku-comment");
  const counter = document.querySelector("#lp-danmaku-count");
  const limit = document.querySelector("#lp-danmaku-limit");
  const status = document.querySelector("#lp-danmaku-status");
  const sendButton = form.querySelector("button[type=submit]");
  let guest = getGuest();
  let activeEvent = null;
  let feedComments = [];
  let unsubscribeFeed = () => {};

  const db = window.firebase
    ? (firebase.apps.length ? firebase.firestore() : (firebase.initializeApp(FIREBASE_CONFIG), firebase.firestore()))
    : null;
  const submissionsForEvent = () => activeEvent ? guest.submissions.filter(item => item.eventKey === activeEvent.eventKey) : [];
  const remainingForActiveEvent = () => Math.max(0, GUEST_LIMIT - submissionsForEvent().length);
  const collectionForActiveEvent = () => activeEvent?.mode === "sample" ? SAMPLE_COLLECTION : EVENT_COLLECTION;

  function showDanmakuLockDialog() {
    if (document.querySelector("#danmaku-lock-dialog")) return;
    const root = document.querySelector("#modal-root");
    const dialog = document.createElement("div");
    dialog.id = "danmaku-lock-dialog";
    dialog.className = "danmaku-lock-dialog";
    dialog.innerHTML = `<div class="danmaku-lock-dialog__backdrop"><section class="danmaku-lock-dialog__content" role="dialog" aria-modal="true" aria-labelledby="danmaku-lock-title"><button type="button" class="danmaku-lock-dialog__close" aria-label="閉じる">×</button><p class="eyebrow">DANMAKU LOCKED</p><h2 id="danmaku-lock-title">送信上限に達しました</h2><p>会場スクリーンを実際に彩るDANMAKUは、<strong>LA_OS</strong>でご体験いただけます。</p><a class="button button-primary" href="#laos">LA_OSへ</a></section></div>`;
    const close = () => dialog.remove();
    root.append(dialog);
    dialog.querySelector(".danmaku-lock-dialog__close").onclick = close;
    dialog.querySelector(".danmaku-lock-dialog__backdrop").onclick = event => { if (event.target === event.currentTarget) close(); };
  }
  function syncGuestUI() {
    if (welcome) welcome.textContent = `ID: ${guest.displayName}`;
    nameDisplay.textContent = `ID: ${guest.displayName}`;
    eventKey.textContent = activeEvent ? (activeEvent.mode === "sample" ? "SAMPLE" : activeEvent.title) : "SAMPLE";
    monitorEvent.textContent = activeEvent?.mode === "sample" ? "SAMPLE EVENT // VOL.00" : (activeEvent?.title || "LIVE EVENT");
    const remaining = remainingForActiveEvent();
    const eventRemaining = Math.max(0, LP_EVENT_LIMIT - feedComments.length);
    const isSample = activeEvent?.mode === "sample";
    const eventLabel = isSample ? "サンプルDANMAKU" : (activeEvent?.eventKey || "DANMAKU");
    const individualLabel = isSample ? "サンプルのDANMAKU" : "DANMAKU";
    limit.textContent = activeEvent
      ? `1人につき5件まで${individualLabel}が送信できます。(残り ${remaining}/${GUEST_LIMIT}回)\n「${eventLabel}」の送信受付は ${feedComments.length}/${LP_EVENT_LIMIT}件`
      : "\u53d7\u4ed8\u5bfe\u8c61\u306e\u30a4\u30d9\u30f3\u30c8\u306f\u3042\u308a\u307e\u305b\u3093";
    const userLocked = Boolean(activeEvent) && remaining <= 0;
    sendButton.textContent = userLocked ? "LOCKED" : "SEND DANMAKU";
    sendButton.classList.toggle("is-locked", userLocked);
    sendButton.disabled = !activeEvent || eventRemaining <= 0;
    sendButton.setAttribute("aria-disabled", String(sendButton.disabled || userLocked));
  }
  function loadEntryStatus() {
    if (!db || !window.DemoDanmakuEvent) {
      status.textContent = "DANMAKU\u53d7\u4ed8\u306e\u63a5\u7d9a\u8a2d\u5b9a\u4e2d\u3067\u3059\u3002";
      syncGuestUI();
      return;
    }
    window.DemoDanmakuEvent.subscribe(event => {
      activeEvent = event;
      subscribeLpDanmakuFeed();
      status.textContent = "";
      syncGuestUI();
    });
  }
  function subscribeLpDanmakuFeed() {
    unsubscribeFeed();
    feedComments = [];
    if (!db || !activeEvent?.eventKey) return;
    unsubscribeFeed = db.collection(collectionForActiveEvent()).where("eventKey", "==", activeEvent.eventKey).onSnapshot(snapshot => {
      feedComments = snapshot.docs.map(doc => doc.data()).filter(item => item.comment);
      syncGuestUI();
    }, () => { feedComments = []; });
  }
  function addSampleComment() {
    const lanes = [12, 38, 64];
    const item = document.createElement("span");
    const index = addSampleComment.index;
    item.className = `lp-danmaku__comment lp-danmaku__comment--${["cyan", "magenta", "white"][index % 3]}`;
    if (!feedComments.length) return;
    const source = feedComments[Math.floor(Math.random() * feedComments.length)];
    item.textContent = `${source.displayName}：${source.comment}`;
    item.style.top = `${lanes[index % lanes.length]}%`;
    item.addEventListener("animationend", () => item.remove());
    stage.append(item);
    addSampleComment.index += 1;
  }
  addSampleComment.index = 0;
  if (stage) { [0, 800, 1600].forEach(delay => setTimeout(addSampleComment, delay)); setInterval(addSampleComment, 2600); }

  comment.addEventListener("input", () => { counter.textContent = `${comment.value.length} / 25`; });
  sendButton.addEventListener("click", event => {
    if (activeEvent && remainingForActiveEvent() <= 0) {
      event.preventDefault();
      showDanmakuLockDialog();
    }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const text = comment.value.trim();
    if (!text || text.length > 25 || !activeEvent || !db) return;
    if (remainingForActiveEvent() <= 0) { showDanmakuLockDialog(); syncGuestUI(); return; }
    if (window.LPDanmakuModeration?.isBlocked(text)) {
      status.textContent = "送信できない言葉が含まれています。内容を変更してください。";
      return;
    }
    if (feedComments.length >= LP_EVENT_LIMIT) { status.textContent = "このイベントキーのLP受付上限に達しました。"; syncGuestUI(); return; }
    form.querySelector("button").disabled = true;
    try {
      await db.collection(collectionForActiveEvent()).add({
        eventKey: activeEvent.eventKey,
        eventTitle: activeEvent.title,
        displayName: guest.displayName,
        comment: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      guest.submissions.push({ eventKey: activeEvent.eventKey, createdAt: new Date().toISOString() });
      saveGuest(guest);
      comment.value = "";
      counter.textContent = "0 / 25";
      status.textContent = "\u53d7\u4ed8\u3051\u307e\u3057\u305f\u3002";
    } catch (error) {
      status.textContent = "\u9001\u4fe1\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";
    } finally { syncGuestUI(); }
  });
  syncGuestUI();
  loadEntryStatus();
});
