(() => {
  const $ = selector => document.querySelector(selector);
  const escapeHTML = value => String(value || "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);
  const render = async () => {
    const content = $("#content");
    if (!content) return;
    content.innerHTML = `<div class="page-head"><div><h1>SITE SETTINGS</h1><p class="sub">LPの共通設定を管理します。</p></div></div><section class="card"><form id="siteSettingsForm"><label class="field">ロゴ画像<input id="siteLogoFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="sub">PNG / JPEG / WebP、5MB以下。保存するとLPのヘッダーとヒーローに反映されます。</p><div id="siteLogoPreview"></div><label class="field">ロゴURL（確認用）<input id="siteLogoUrl" readonly></label><button class="primary" type="submit">サイト設定を保存</button><p id="siteSettingsStatus" class="sub" role="status"></p></form></section>`;
    if (!window.firebase?.firestore) return;
    const doc = await firebase.firestore().collection("siteSettings").doc("main").get();
    const logoUrl = doc.exists ? (doc.data().logoUrl || "") : "";
    $("#siteLogoUrl").value = logoUrl;
    $("#siteLogoPreview").innerHTML = logoUrl ? `<img class="preview" src="${escapeHTML(logoUrl)}" alt="現在のロゴ">` : "<p class=\"sub\">ロゴは未設定です。</p>";
    $("#siteSettingsForm").onsubmit = async event => {
      event.preventDefault();
      const file = $("#siteLogoFile").files[0];
      const status = $("#siteSettingsStatus");
      try {
        let nextUrl = logoUrl;
        if (file) {
          if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error("画像形式または容量を確認してください。");
          status.textContent = "ロゴ画像をアップロード中…";
          const ref = firebase.storage().ref("site-settings/logo");
          await ref.put(file, { contentType: file.type });
          nextUrl = await ref.getDownloadURL();
        }
        await firebase.firestore().collection("siteSettings").doc("main").set({ logoUrl: nextUrl, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: firebase.auth().currentUser?.uid || "" }, { merge: true });
        $("#siteLogoUrl").value = nextUrl;
        $("#siteLogoPreview").innerHTML = nextUrl ? `<img class="preview" src="${escapeHTML(nextUrl)}" alt="設定したロゴ">` : "";
        status.textContent = "保存しました。";
      } catch (error) { status.textContent = error.message || "保存に失敗しました。"; }
    };
  };
  $("#siteSettingsNav")?.addEventListener("click", render);
})();
