/* LP用DANMAKUの送信対象と、イベントキーごとの受付件数を管理する。 */
(() => {
  const LP_EVENT_LIMIT = 300;
  const nav = document.querySelector("#lpDanmakuReviewNav");
  if (!nav) return;

  const escape = value => String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  nav.addEventListener("click", async () => {
    const content = document.querySelector("#content");
    content.innerHTML = `
      <div class="page-head"><div><h1>DANMAKU VIEW（LP用）</h1><p class="sub">LPの送信対象イベントキーを設定します。</p></div></div>
      <section class="card">
        <p class="sub">SAMPLEはLP専用キーです。イベントキー連動では、本番公開中のイベントだけを選択できます。</p>
        <div class="form-grid">
          <button id="lpModeSample" class="secondary" type="button">LP専用表示（SAMPLE）</button>
          <button id="lpModeEvent" class="secondary" type="button">イベントキー連動</button>
        </div>
        <label id="lpEventSelectField" class="field" hidden>登録済みイベント<select id="lpDanmakuEvent"><option value="">イベントを選択</option></select></label>
        <section class="card">
          <p class="sub" id="lpDanmakuTarget">LP専用表示（SAMPLE）</p>
          <strong id="lpDanmakuCount">「サンプルDANMAKU」の送信受付は 0/${LP_EVENT_LIMIT}件</strong>
          <p class="sub">LPからの送信受付は、イベントキーごとに最大${LP_EVENT_LIMIT}件です。</p>
        </section>
        <p id="lpDanmakuStatus" class="sub" role="status"></p>
      </section>`;

    const db = firebase.firestore();
    const select = document.querySelector("#lpDanmakuEvent");
    const field = document.querySelector("#lpEventSelectField");
    const status = document.querySelector("#lpDanmakuStatus");
    const target = document.querySelector("#lpDanmakuTarget");
    const count = document.querySelector("#lpDanmakuCount");
    let unsubscribe = () => {};

    const showCount = (eventKey, label) => {
      unsubscribe();
      target.textContent = eventKey === "SAMPLE" ? "LP専用表示（SAMPLE）" : `イベントキー連動：${eventKey}`;
      count.textContent = `「${label}」の送信受付は 0/${LP_EVENT_LIMIT}件`;
      const collection = eventKey === "SAMPLE" ? "lpDanmakuSamples" : "demoDanamku";
      unsubscribe = db.collection(collection).where("eventKey", "==", eventKey).onSnapshot(snapshot => {
        count.textContent = `「${label}」の送信受付は ${snapshot.size}/${LP_EVENT_LIMIT}件`;
      }, () => { count.textContent = `「${label}」の送信受付は取得できません`; });
    };

    const save = async (displayMode, eventKey = "") => {
      await db.collection("settings").doc("lpDanmakuView").set({
        displayMode,
        activeEventKey: displayMode === "sample" ? "SAMPLE" : eventKey,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      if (displayMode === "sample") {
        field.hidden = true;
        showCount("SAMPLE", "サンプルDANMAKU");
        status.textContent = "LP専用表示（SAMPLE）へ切り替えました。";
      } else {
        showCount(eventKey, eventKey);
        status.textContent = `イベントキー連動へ切り替えました：${eventKey}`;
      }
    };
    const showError = error => { status.textContent = `保存できませんでした：${error.code || "通信エラー"}`; };
    // SAMPLEへの切替は、イベント一覧の取得に失敗していても必ず操作できる。
    document.querySelector("#lpModeSample").onclick = async () => { try { await save("sample"); } catch (error) { showError(error); } };
    document.querySelector("#lpModeEvent").onclick = () => {
      field.hidden = false;
      status.textContent = "連動するイベントを選択してください。選択と同時にLPへ反映されます。";
    };
    select.onchange = async () => {
      if (!select.value) return;
      try { await save("event", select.value); } catch (error) { showError(error); }
    };
    showCount("SAMPLE", "サンプルDANMAKU");

    try {
      const [eventSnapshot, settingSnapshot] = await Promise.all([
        db.collection("events").where("status", "==", "active").where("environment", "==", "prod").get(),
        db.collection("settings").doc("lpDanmakuView").get()
      ]);
      const setting = settingSnapshot.data() || {};
      const activeKey = setting.activeEventKey || "";
      const events = eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(event => event.lpVisible === true).sort((a, b) => String(a.eventDate || "").localeCompare(String(b.eventDate || "")));
      events.forEach(event => {
        if (!event.eventKey) return;
        const selected = event.eventKey === activeKey ? "selected" : "";
        select.insertAdjacentHTML("beforeend", `<option value="${escape(event.eventKey)}" ${selected}>${escape(event.title || event.eventKey)} (${escape(event.eventKey)})</option>`);
      });
      if (!select.options.length || select.options.length === 1) select.insertAdjacentHTML("beforeend", '<option value="" disabled>選択できる本番公開イベントはありません</option>');

      const isEventMode = setting.displayMode === "event" && activeKey;
      field.hidden = !isEventMode;
      showCount(isEventMode ? activeKey : "SAMPLE", isEventMode ? activeKey : "サンプルDANMAKU");
    } catch (error) {
      showError(error);
    }
  });
})();
