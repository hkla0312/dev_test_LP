/* global firebase */
(() => {
  const nav = document.querySelector("#danmakuReviewNav");
  if (!nav) return;

  const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  const format = (value) => value?.toDate ? value.toDate().toLocaleString("ja-JP") : "--";

  let unsubscribe = () => {};

  function render(settings = {}, submissions = []) {
    const content = document.querySelector("#content");
    const templateTerms = Array.isArray(window.LicenseFreeDanmakuBlockedTemplate) ? window.LicenseFreeDanmakuBlockedTemplate : [];
    const blockedTerms = Array.isArray(settings.blockedTerms) && settings.blockedTerms.length
      ? settings.blockedTerms.join("\n")
      : templateTerms.join("\n");
    content.innerHTML = `
      <div class="page-head">
        <div>
          <h1>DANMAKU FILTER</h1>
          <p class="sub">ライセンスフリーのテンプレートを編集して保存できます。通過したDANMAKUはそのまま表示されます。</p>
        </div>
      </div>
      <section class="card">
        <label class="field">
          <span>禁止ワード</span>
          <textarea id="blockedTermsInput" rows="8" placeholder="1行に1語、またはカンマ区切りで入力">${escape(blockedTerms)}</textarea>
        </label>
        <p class="sub">URL / メール / 電話番号 / 連続記号もここで止めます。中間審査は行いません。</p>
        <div class="row-actions">
          <button class="secondary" id="loadBlockedTermsTemplate" type="button">テンプレートを読み込む</button>
          <button class="primary" id="saveBlockedTerms" type="button">保存する</button>
        </div>
        <p id="danmakuReviewStatus" class="sub" role="status"></p>
      </section>
      <section class="card">
        <h2>最新のDANMAKU</h2>
        <div class="table-wrap">
          <table class="danmaku-review-table">
            <thead>
              <tr>
                <th>EVENT</th>
                <th>DISPLAY NAME</th>
                <th>COMMENT</th>
                <th>EMOTE</th>
                <th>CREATED</th>
              </tr>
            </thead>
            <tbody>
              ${submissions.length ? submissions.map((item) => `
                <tr>
                  <td>${escape(item.eventKey)}</td>
                  <td>${escape(item.senderLabel || item.memberDisplayName || item.memberId)}</td>
                  <td>${escape(item.comment)}</td>
                  <td>${escape(item.emote || "")}</td>
                  <td>${format(item.createdAt)}</td>
                </tr>
              `).join("") : '<tr><td colspan="5" class="empty">DANMAKUはまだありません。</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const status = document.querySelector("#danmakuReviewStatus");
    const input = document.querySelector("#blockedTermsInput");
    const loadButton = document.querySelector("#loadBlockedTermsTemplate");
    const saveButton = document.querySelector("#saveBlockedTerms");
    if (loadButton) {
      loadButton.onclick = () => {
        const templateTerms = Array.isArray(window.LicenseFreeDanmakuBlockedTemplate) ? window.LicenseFreeDanmakuBlockedTemplate : [];
        input.value = templateTerms.join("\n");
        if (status) status.textContent = "テンプレートを読み込みました。必要に応じて編集して保存してください。";
      };
    }
    if (saveButton) {
      saveButton.onclick = async () => {
        const raw = String(input.value || "");
        const blockedTerms = raw
          .split(/[\n,]/)
          .map((item) => item.trim())
          .filter(Boolean);
        try {
          await firebase.firestore().collection("settings").doc("danmakuModeration").set({
            blockedTerms,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          if (status) status.textContent = "禁止ワードを保存しました。";
        } catch (error) {
          if (status) status.textContent = `保存に失敗しました。${error.code || "unknown"}`;
        }
      };
    }
  }

  nav.addEventListener("click", () => {
    unsubscribe();
    document.querySelector("#content").innerHTML = '<div class="page-head"><div><h1>DANMAKU FILTER</h1><p class="sub">読み込み中...</p></div></div>';

    Promise.all([
      firebase.firestore().collection("settings").doc("danmakuModeration").get(),
      firebase.firestore().collection("danmakuSubmissions")
        .where("displayStatus", "==", "approved")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get()
    ]).then(([settingSnapshot, submissionSnapshot]) => {
      const settings = settingSnapshot.exists ? settingSnapshot.data() : {};
      const submissions = submissionSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      render(settings, submissions);
      unsubscribe = firebase.firestore().collection("danmakuSubmissions")
        .where("displayStatus", "==", "approved")
        .orderBy("createdAt", "desc")
        .limit(20)
        .onSnapshot((snapshot) => {
          render(settings, snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });
    });
  });
})();
