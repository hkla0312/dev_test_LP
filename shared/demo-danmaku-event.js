/* global firebase, FIREBASE_CONFIG */
(() => {
  const FALLBACK_EVENT_KEY = "LegendaryApocalypseVol.0000";
  const listeners = new Set();
  let events = [];
  let setting = {};
  let eventsLoaded = false;

  function closeAt(event) {
    if (event.danmakuCloseAt?.toDate) return event.danmakuCloseAt.toDate();
    const date = String(event.eventDate || "").replace(/[./]/g, "-");
    return new Date(`${date}T22:00:00+09:00`);
  }

  function resolveEvent() {
    const now = new Date();
    if (setting.displayMode !== "event") return { eventKey: "SAMPLE", title: "DANMAKU（SAMPLE）", mode: "sample" };
    // LP用ビューで選択した本番イベントキーを最優先で使用する。
    const manual = setting.displayMode === "event" && setting.activeEventKey;
    const configured = events.find(event => (event.eventKey || event.id) === setting.activeEventKey);
    const candidates = events
      .map(event => ({ ...event, closeAt: closeAt(event) }))
      .filter(event => !Number.isNaN(event.closeAt.getTime()) && now <= event.closeAt)
      .sort((a, b) => a.closeAt - b.closeAt);
    const selected = manual && configured ? configured : candidates[0] || configured;
    if (manual && !configured) return { eventKey: setting.activeEventKey, title: setting.activeEventKey, mode: "manual" };
    return selected
      ? { eventKey: selected.eventKey || selected.id, title: selected.title || selected.eventKey || selected.id, mode: manual ? "manual" : "auto" }
      : { eventKey: FALLBACK_EVENT_KEY, title: FALLBACK_EVENT_KEY, mode: "fallback" };
  }

  function publish() {
    if (!eventsLoaded) return;
    listeners.forEach(listener => listener(resolveEvent()));
  }

  window.DemoDanmakuEvent = {
    subscribe(listener) {
      listeners.add(listener);
      if (eventsLoaded) listener(resolveEvent());
      return () => listeners.delete(listener);
    }
  };

  if (!window.firebase || !window.FIREBASE_CONFIG) return;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();
  db.collection("events").where("status", "==", "active").where("environment", "==", "prod").where("lpVisible", "==", true).onSnapshot(snapshot => {
    events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    eventsLoaded = true;
    publish();
  }, () => { eventsLoaded = true; publish(); });
  db.collection("settings").doc("lpDanmakuView").onSnapshot(snapshot => {
    setting = snapshot.data() || {};
    publish();
  }, publish);
  window.setInterval(publish, 60_000);
})();
