const LP_DANMAKU_SAMPLES = [
  "#0001: 最高です",
  "#0002: THIS IS LIVE",
  "#0003: 音が体に響く",
  "#0004: ステージが眩しい",
  "#0005: まだ終わらない",
  "#0006: 心が震える",
  "#0007: 会場がひとつになった",
  "#0008: ありがとう",
  "#0009: もっと上へ",
  "#0010: LEGENDARY",
];

const GUEST_STORAGE_KEY = "laLpDanmakuGuestV2";
const GUEST_LIMIT = 5;
const LP_EVENT_LIMIT = 300;
const SAMPLE_COLLECTION = "lpDanmakuSamples";
const EVENT_COLLECTION = "demoDanamku";

function generateGuestName() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function getGuest() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY));
    if (saved?.guestId && /^\d{4}$/.test(saved.displayName || "")) {
      return saved;
    }
  } catch (_) {
    // create a new local guest
  }

  const guest = {
    guestId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    displayName: generateGuestName(),
    displayNameLocked: false,
    submissions: [],
  };
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
  return guest;
}

function saveGuest(guest) {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
}

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
  const moderation = window.LAMessageModeration || window.LPDanmakuModeration;

  let guest = getGuest();
  let activeEvent = null;
  let feedComments = [];
  let unsubscribeFeed = () => {};

  const db = window.firebase
    ? (firebase.apps.length ? firebase.firestore() : (firebase.initializeApp(FIREBASE_CONFIG), firebase.firestore()))
    : null;

  const submissionsForEvent = () => (activeEvent ? guest.submissions.filter((item) => item.eventKey === activeEvent.eventKey) : []);
  const remainingForActiveEvent = () => Math.max(0, GUEST_LIMIT - submissionsForEvent().length);
  const collectionForActiveEvent = () => (activeEvent?.mode === "sample" ? SAMPLE_COLLECTION : EVENT_COLLECTION);

  function showDanmakuLockDialog() {
    if (document.querySelector("#danmaku-lock-dialog")) return;
    const root = document.querySelector("#modal-root");
    const dialog = document.createElement("div");
    dialog.id = "danmaku-lock-dialog";
    dialog.className = "danmaku-lock-dialog";
    dialog.innerHTML = `
      <div class="danmaku-lock-dialog__backdrop">
        <section class="danmaku-lock-dialog__content" role="dialog" aria-modal="true" aria-labelledby="danmaku-lock-title">
          <button type="button" class="danmaku-lock-dialog__close" aria-label="閉じる">×</button>
          <p class="eyebrow">DANMAKU LOCKED</p>
          <h2 id="danmaku-lock-title">送信上限に達しました</h2>
          <p>このイベントでのDANMAKUは、1人あたり5件までです。</p>
          <a class="button button-primary" href="#laos">LA_OSへ</a>
        </section>
      </div>`;
    const close = () => dialog.remove();
    root.append(dialog);
    dialog.querySelector(".danmaku-lock-dialog__close").onclick = close;
    dialog.querySelector(".danmaku-lock-dialog__backdrop").onclick = (event) => {
      if (event.target === event.currentTarget) close();
    };
  }

  function syncGuestUI() {
    if (welcome) welcome.textContent = `ID: ${guest.displayName}`;
    if (nameDisplay) nameDisplay.textContent = `ID: ${guest.displayName}`;
    if (eventKey) eventKey.textContent = activeEvent ? (activeEvent.mode === "sample" ? "SAMPLE" : activeEvent.title) : "SAMPLE";
    if (monitorEvent) monitorEvent.textContent = activeEvent?.mode === "sample" ? "SAMPLE EVENT // VOL.00" : (activeEvent?.title || "LIVE EVENT");

    const remaining = remainingForActiveEvent();
    const eventRemaining = Math.max(0, LP_EVENT_LIMIT - feedComments.length);
    const isSample = activeEvent?.mode === "sample";
    const eventLabel = isSample ? "SAMPLE EVENT" : (activeEvent?.eventKey || "DANMAKU");
    const individualLabel = isSample ? "SAMPLE" : "DANMAKU";

    if (limit) {
      limit.textContent = activeEvent
        ? `1人につき${individualLabel}は5件まで送信できます。 残り ${remaining}/${GUEST_LIMIT} 件\n${eventLabel} の公開数 ${feedComments.length}/${LP_EVENT_LIMIT} 件`
        : "受付対象のイベントはありません";
    }

    const userLocked = Boolean(activeEvent) && remaining <= 0;
    sendButton.textContent = userLocked ? "LOCKED" : "SEND DANMAKU";
    sendButton.classList.toggle("is-locked", userLocked);
    sendButton.disabled = !activeEvent || eventRemaining <= 0;
    sendButton.setAttribute("aria-disabled", String(sendButton.disabled || userLocked));
  }

  function loadEntryStatus() {
    if (!db || !window.DemoDanmakuEvent) {
      if (status) status.textContent = "DANMAKU受付の接続設定中です。";
      syncGuestUI();
      return;
    }

    window.DemoDanmakuEvent.subscribe((event) => {
      activeEvent = event;
      subscribeLpDanmakuFeed();
      if (status) status.textContent = "";
      syncGuestUI();
    });
  }

  function subscribeLpDanmakuFeed() {
    unsubscribeFeed();
    feedComments = [];
    if (!db || !activeEvent?.eventKey) return;

    unsubscribeFeed = db.collection(collectionForActiveEvent())
      .where("eventKey", "==", activeEvent.eventKey)
      .onSnapshot(
        (snapshot) => {
          feedComments = snapshot.docs.map((doc) => doc.data()).filter((item) => item.comment);
          syncGuestUI();
        },
        () => {
          feedComments = [];
        }
      );
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

  if (stage) {
    [0, 800, 1600].forEach((delay) => setTimeout(addSampleComment, delay));
    setInterval(addSampleComment, 2600);
  }

  comment.addEventListener("input", () => {
    counter.textContent = `${comment.value.length} / 25`;
  });

  sendButton.addEventListener("click", (event) => {
    if (activeEvent && remainingForActiveEvent() <= 0) {
      event.preventDefault();
      showDanmakuLockDialog();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = comment.value.trim();
    if (!text || text.length > 25 || !activeEvent || !db) return;
    if (remainingForActiveEvent() <= 0) {
      showDanmakuLockDialog();
      syncGuestUI();
      return;
    }

    const blocked = moderation?.describe ? moderation.describe(text, { maxLength: 25 }) : null;
    if (blocked?.status === "blocked") {
      if (status) status.textContent = blocked.message;
      return;
    }

    if (feedComments.length >= LP_EVENT_LIMIT) {
      if (status) status.textContent = "このイベントの公開上限に達しました。";
      syncGuestUI();
      return;
    }

    form.querySelector("button").disabled = true;
    try {
      await db.collection(collectionForActiveEvent()).add({
        eventKey: activeEvent.eventKey,
        eventTitle: activeEvent.title,
        displayName: guest.displayName,
        comment: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      guest.submissions.push({ eventKey: activeEvent.eventKey, createdAt: new Date().toISOString() });
      saveGuest(guest);
      comment.value = "";
      counter.textContent = "0 / 25";
      if (status) status.textContent = "受け付けました。";
    } catch (error) {
      if (status) status.textContent = error?.message || "送信できませんでした。時間をおいてもう一度お試しください。";
    } finally {
      syncGuestUI();
    }
  });

  syncGuestUI();
  loadEntryStatus();
});
