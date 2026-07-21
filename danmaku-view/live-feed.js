/* global firebase, FIREBASE_CONFIG */
(() => {
  if (!window.firebase || !window.FIREBASE_CONFIG) return;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();
  const queue = [];
  const savedComments = new Map();
  let unsubscribe = () => {};

  function addLoop() {
    const loop = [...savedComments.values()].sort(() => Math.random() - 0.5);
    queue.push(...loop);
  }

  // Feed comments at a readable pace so the five lanes can avoid collisions.
  window.setInterval(() => {
    if (!queue.length && savedComments.size) addLoop();
    const nextIndex = queue.findIndex(message => window.injectDanmaku?.(message));
    if (nextIndex >= 0) queue.splice(nextIndex, 1);
  }, 850);

  window.DemoDanmakuEvent?.subscribe(event => {
    unsubscribe();
    queue.length = 0;
    savedComments.clear();
    window.setDanmakuLiveMode?.();
    window.setDanmakuLoading?.(true);
    unsubscribe = db.collection("demoDanamku").orderBy("createdAt", "asc").onSnapshot(snapshot => {
      const docs = snapshot.docChanges().filter(change => change.type === "added" && change.doc.data().eventKey === event.eventKey);
      docs.forEach(change => {
        const doc = change.doc;
        const data = doc.data();
        const message = `#${data.displayName}: ${data.comment}`;
        savedComments.set(doc.id, message);
        queue.push(message);
      });
      if (savedComments.size) window.setDanmakuLoading?.(false);
    }, () => window.setDanmakuLoading?.(true));
  });
})();
