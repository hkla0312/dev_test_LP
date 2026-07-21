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
  let guest = getGuest();
  let activeEvent = null;
  let feedComments = [];
  let unsubscribeFeed = () => {};

  const db = window.firebase
    ? (firebase.apps.length ? firebase.firestore() : (firebase.initializeApp(FIREBASE_CONFIG), firebase.firestore()))
    : null;
  const submissionsForEvent = () => activeEvent ? guest.submissions.filter(item => item.eventKey === activeEvent.eventKey) : [];
  const collectionForActiveEvent = () => activeEvent?.mode === "sample" ? SAMPLE_COLLECTION : EVENT_COLLECTION;
  function syncGuestUI() {
    if (welcome) welcome.textContent = `ID: ${guest.displayName}`;
    nameDisplay.textContent = `ID: ${guest.displayName}`;
    eventKey.textContent = activeEvent ? (activeEvent.mode === "sample" ? "SAMPLE" : activeEvent.title) : "SAMPLE";
    monitorEvent.textContent = activeEvent?.mode === "sample" ? "SAMPLE EVENT // VOL.00" : (activeEvent?.title || "LIVE EVENT");
    const remaining = Math.max(0, GUEST_LIMIT - submissionsForEvent().length);
    const eventRemaining = Math.max(0, LP_EVENT_LIMIT - feedComments.length);
    const isSample = activeEvent?.mode === "sample";
    const eventLabel = isSample ? "サンプルDANMAKU" : (activeEvent?.eventKey || "DANMAKU");
    const individualLabel = isSample ? "サンプルのDANMAKU" : "DANMAKU";
    limit.textContent = activeEvent
      ? `1人につき5件まで${individualLabel}が送信できます。\n「${eventLabel}」の送信受付は ${feedComments.length}/${LP_EVENT_LIMIT}件`
      : "\u53d7\u4ed8\u5bfe\u8c61\u306e\u30a4\u30d9\u30f3\u30c8\u306f\u3042\u308a\u307e\u305b\u3093";
    form.querySelector("button").disabled = !activeEvent || eventRemaining <= 0 || remaining <= 0;
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
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const text = comment.value.trim();
    if (!text || text.length > 25 || !activeEvent || !db) return;
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
