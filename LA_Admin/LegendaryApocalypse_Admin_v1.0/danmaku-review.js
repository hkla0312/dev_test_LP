/* global firebase */
(() => {
  const nav = document.querySelector("#danmakuReviewNav");
  if (!nav) return;
  let unsubscribe = () => {};
  let events = [];
  let activeEventKey = "";
  const escape = value => String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const format = value => value?.toDate ? value.toDate().toLocaleString("ja-JP") : "--";
  const render = submissions => {
    const content = document.querySelector("#content");
    content.innerHTML = `<div class="page-head"><div><h1>DANMAKU REVIEW</h1><p class="sub">会場スクリーン用の表示イベントと審査キューを管理します。</p></div></div><section class="card"><label class="field">DANMAKU VIEW EVENT<select id="activeDanmakuEvent"><option value="__auto__">AUTO — NEAREST EVENT</option>${events.map(event => `<option value="${escape(event.eventKey || event.id)}" ${(event.eventKey || event.id) === activeEventKey ? "selected" : ""}>${escape(event.title || event.eventKey || event.id)}</option>`).join("")}</select></label><p id="danmakuReviewStatus" class="sub">この設定は会場スクリーン用です。</p><div class="table-wrap"><table class="danmaku-review-table"><thead><tr><th>EVENT</th><th>DISPLAY NAME</th><th>COMMENT</th><th>REASONS</th><th>CREATED</th><th>ACTION</th></tr></thead><tbody>${submissions.length ? submissions.map(item => `<tr><td>${escape(item.eventKey)}</td><td>${escape(item.displayName)}</td><td>${escape(item.comment)}</td><td>${escape((item.moderationReasons || []).join(", "))}</td><td>${format(item.createdAt)}</td><td><button class="primary" data-approve="${item.id}">APPROVE</button><button class="danger" data-reject="${item.id}">REJECT</button></td></tr>`).join("") : '<tr><td colspan="6" class="empty">REVIEW QUEUE IS EMPTY</td></tr>'}</tbody></table></div></section>`;
    document.querySelector("#activeDanmakuEvent").onchange = async event => {
      activeEventKey = event.target.value === "__auto__" ? "" : event.target.value;
      try { await firebase.firestore().collection("settings").doc("danmakuView").set({ mode: activeEventKey ? "manual" : "auto", activeEventKey, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); }
      catch (_) { document.querySelector("#danmakuReviewStatus").textContent = "EVENT SETTING UPDATE FAILED"; }
    };
    document.querySelectorAll("[data-approve], [data-reject]").forEach(button => button.onclick = async () => {
      const action = button.dataset.approve ? "approve" : "reject";
      button.disabled = true;
      try { await firebase.functions().httpsCallable("moderateDanmaku")({ submissionId: button.dataset.approve || button.dataset.reject, action }); }
      catch (_) { document.querySelector("#danmakuReviewStatus").textContent = "UPDATE FAILED"; button.disabled = false; }
    });
  };
  nav.addEventListener("click", () => {
    unsubscribe();
    document.querySelector("#content").innerHTML = '<div class="page-head"><div><h1>DANMAKU REVIEW</h1><p class="sub">Loading review queue...</p></div></div>';
    Promise.all([firebase.firestore().collection("events").where("status", "==", "active").where("environment", "==", "prod").get(), firebase.firestore().collection("settings").doc("danmakuView").get()]).then(([eventSnapshot, settingSnapshot]) => {
      events = eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(event => event.danmakuEnabled !== false);
      activeEventKey = settingSnapshot.data()?.mode === "manual" ? (settingSnapshot.data()?.activeEventKey || "") : "";
      unsubscribe = firebase.firestore().collection("danmakuSubmissions").where("moderationStatus", "==", "review").where("displayStatus", "==", "pending").onSnapshot(snapshot => render(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    });
  });
})();
