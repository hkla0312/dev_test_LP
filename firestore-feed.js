/* global firebase, FIREBASE_CONFIG */
(() => {
  if (!window.firebase || !window.FIREBASE_CONFIG) return;
  const $ = selector => document.querySelector(selector);
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();
  let events = [];
  let artists = [];
  let settings = {};
  let artistSignals = [];
  const SIGNAL_AXES = ["vocal", "performance", "emotion", "character", "worldview", "visual"];
  const SIGNAL_AXIS_WEIGHTS = { song: { vocal: 70, emotion: 30 }, stage: { performance: 60, worldview: 25, visual: 15 }, character: { character: 70, worldview: 20, emotion: 10 } };

  const toMillis = value => value?.toMillis ? value.toMillis() : Number(value?.seconds || 0) * 1000;
  const enrichArtists = source => source.map(artist => {
    const key = String(artist.id || artist.artistKey || "");
    const signals = artistSignals.filter(signal => String(signal.artistId || signal.artistKey || "") === key);
    const signalAnalytics = signals.reduce((result, signal) => {
      const weights = SIGNAL_AXIS_WEIGHTS[String(signal.signalType || "")] || {};
      SIGNAL_AXES.forEach(axis => { result[axis] += Number(weights[axis] || 0); });
      return result;
    }, { vocal: 0, performance: 0, emotion: 0, character: 0, worldview: 0, visual: 0 });
    const signalComments = signals.filter(signal => signal.source !== "lp_public").slice().sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)).map(signal => signal.commentSummary || signal.comment || "").filter(Boolean).slice(0, 5);
    return { ...artist, signalAnalytics, signalComments };
  });

  const showEventEmpty = () => {
    $("#event-title").textContent = "EVENT INFORMATION COMING SOON";
    $("#event-date").textContent = "---";
    $("#event-venue").textContent = "---";
    $("#event-time").textContent = "--- / ---";
    $("#event-ticket").textContent = "---";
    $("#event-flyer").textContent = "EVENT FLYER";
    $("#ticket-link").removeAttribute("href");
    $("#ticket-link").setAttribute("aria-disabled", "true");
  };

  const render = () => {
    if (!events.length) showEventEmpty();
    window.renderLPAdminData?.({ events, artists: enrichArtists(artists), settings });
  };

  db.collection("events")
    .where("lpVisible", "==", true)
    .where("status", "==", "active")
    .where("environment", "==", "prod")
    .onSnapshot(snapshot => {
      events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => String(a.eventDate || "").localeCompare(String(b.eventDate || "")));
      render();
    }, error => {
      console.error("LP event feed could not be loaded.", error);
      events = [];
      render();
    });

  db.collection("artists")
    .where("lpVisible", "==", true)
    .where("environment", "==", "prod")
    .onSnapshot(snapshot => {
      artists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render();
    }, error => {
      console.error("LP artist feed could not be loaded.", error);
      artists = [];
      render();
    });

  db.collection("artistSignals")
    .where("environment", "==", "prod")
    .where("isDeleted", "==", false)
    .onSnapshot(snapshot => {
      artistSignals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(signal => signal.moderationStatus !== "blocked");
      render();
    }, error => {
      console.error("LP signal feed could not be loaded.", error);
      artistSignals = [];
      render();
    });

  db.collection("siteSettings").doc("main").onSnapshot(snapshot => {
    settings = snapshot.exists ? snapshot.data() : {};
    render();
  }, error => {
    console.error("LP site settings could not be loaded.", error);
    settings = {};
    render();
  });
})();
