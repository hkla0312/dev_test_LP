/* global firebase, FIREBASE_CONFIG */
(() => {
  if (!window.firebase || !window.FIREBASE_CONFIG) return;

  const $ = selector => document.querySelector(selector);
  const AXES = ["vocal", "performance", "emotion", "character", "worldview", "visual"];
  const DEFAULT_ANALYTICS = { vocal: 20, performance: 20, emotion: 20, character: 15, worldview: 15, visual: 10 };
  const SIGNAL_WEIGHTS = {
    song: { vocal: 5, performance: 2, emotion: 2 },
    stage: { performance: 5, visual: 2, worldview: 1 },
    character: { character: 5, emotion: 2, worldview: 1 },
  };
  const COMMENT_KEYWORDS = [
    { axis: "vocal", pattern: /(歌|声|うた|ボーカル|歌声|歌唱|メロディ)/u, weight: 2 },
    { axis: "performance", pattern: /(ステージ|演出|パフォーマンス|動き|ライブ)/u, weight: 2 },
    { axis: "emotion", pattern: /(感動|熱い|尊い|最高|好き|泣|楽しい)/u, weight: 2 },
    { axis: "character", pattern: /(キャラ|人柄|雰囲気|かわいい|可愛い|魅力)/u, weight: 2 },
    { axis: "worldview", pattern: /(世界観|空気感|構成|ストーリー|表現)/u, weight: 2 },
    { axis: "visual", pattern: /(衣装|ビジュ|見た目|ビジュアル|色|表情)/u, weight: 2 },
  ];

  const randomize = (items) => [...items].sort(() => Math.random() - 0.5);

  const summarizeSignalComment = (signal) => {
    const fallback = String(signal?.signalLabel || signal?.signalType || "SIGNAL").trim();
    const raw = String(signal?.commentSummary || signal?.comment || fallback)
      .normalize("NFKC")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const cleaned = raw.replace(/[「」『』“”"'`]/g, "").replace(/[。！？!?]+$/g, "");
    if (!cleaned) return fallback;
    return cleaned.length > 18 ? `${cleaned.slice(0, 18)}…` : cleaned;
  };

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();

  let events = [];
  let artists = [];
  let settings = {};
  let artistSignals = [];

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

  const normalizeTotals = (totals) => {
    const values = AXES.map(axis => Math.max(0, Number(totals[axis] || 0)));
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!total) return { ...DEFAULT_ANALYTICS };
    const ratios = values.map(value => Math.round(value / total * 100));
    ratios[ratios.length - 1] += 100 - ratios.reduce((sum, value) => sum + value, 0);
    return AXES.reduce((result, axis, index) => {
      result[axis] = ratios[index];
      return result;
    }, {});
  };

  const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1e6);
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  };

  const enrichAnalytics = (artistId) => {
    const total = { ...DEFAULT_ANALYTICS };
    const items = artistSignals
      .filter(signal => String(signal.artistId || signal.artistKey || "") === String(artistId || ""))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    for (const signal of items) {
      const typeWeight = SIGNAL_WEIGHTS[String(signal.signalType || "").trim()] || {};
      Object.entries(typeWeight).forEach(([axis, weight]) => {
        total[axis] = (total[axis] || 0) + Number(weight || 0);
      });

      const comment = String(signal.comment || "").normalize("NFKC");
      COMMENT_KEYWORDS.forEach(({ axis, pattern, weight }) => {
        if (pattern.test(comment)) total[axis] = (total[axis] || 0) + weight;
      });
    }

    return normalizeTotals(total);
  };

  const enrichArtists = (sourceArtists) => {
    return sourceArtists.map(artist => {
      const key = String(artist.id || artist.artistKey || "").trim();
      const items = artistSignals
        .filter(signal => String(signal.artistId || signal.artistKey || "") === key && signal.isDeleted !== true)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

      const signalComments = randomize(items
        .map(signal => summarizeSignalComment(signal))
        .filter(Boolean)
      ).slice(0, 5);

      return {
        ...artist,
        signalAnalytics: enrichAnalytics(key),
        signalComments,
        signalCount: items.length,
      };
    });
  };

  const render = () => {
    if (!events.length) showEventEmpty();
    window.renderLPAdminData?.({
      events,
      artists: enrichArtists(artists),
      settings,
    });
  };

  db.collection("events")
    .where("lpVisible", "==", true)
    .where("status", "==", "active")
    .where("environment", "==", "prod")
    .onSnapshot(snapshot => {
      events = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
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
      artistSignals = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(signal => signal.moderationStatus !== "blocked");
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
