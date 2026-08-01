/* global firebase, FIREBASE_CONFIG */
(() => {
  if (!window.firebase || !window.FIREBASE_CONFIG) return;
  const $ = selector => document.querySelector(selector);
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();
  let events = [];
  let artists = [];
  let settings = {};

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
    window.renderLPAdminData?.({ events, artists, settings });
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

  db.collection("siteSettings").doc("main").onSnapshot(snapshot => {
    settings = snapshot.exists ? snapshot.data() : {};
    render();
  }, error => {
    console.error("LP site settings could not be loaded.", error);
    settings = {};
    render();
  });
})();
