/* global firebase */
(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  let publishedArtists = [];
  let systemSettings = { signalEnabled: true, systemEnabled: true };

  function refreshSignalForm() {
    const artistSelect = $('#signal-artist-select');
    const typeSelect = $('#signal-emotion-select');
    if (artistSelect) {
      const previous = artistSelect.value;
      artistSelect.innerHTML = publishedArtists.length
        ? publishedArtists.map(artist => `<option value="${escape(artist.id)}">${escape(artist.name)}</option>`).join('')
        : '<option value="">公開中のアーティストがありません</option>';
      if (publishedArtists.some(artist => artist.id === previous)) artistSelect.value = previous;
    }
    if (typeSelect) {
      const previous = typeSelect.value;
      typeSelect.innerHTML = '<option value="song">歌が良い</option><option value="stage">ステージが良い</option><option value="character">キャラが良い</option>';
      if (['song', 'stage', 'character'].includes(previous)) typeSelect.value = previous;
    }
  }

  firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    const db = firebase.firestore();
    const form = $('#signal-form');
    const dialog = $('#signal-dialog');

    db.collection('settings').doc('system').onSnapshot(snapshot => {
      systemSettings = { signalEnabled: true, systemEnabled: true, ...(snapshot.exists ? snapshot.data() : {}) };
    }, error => { const toast=$('#system-toast'); if(toast)toast.textContent='運用設定を読み込めません。管理者へお問い合わせください。'; console.error('運用設定の取得に失敗しました。', error); });
    db.collection('artists').where('lpVisible', '==', true).where('environment', '==', 'prod').onSnapshot(snapshot => {
      publishedArtists = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || 'ARTIST' }));
      refreshSignalForm();
    }, error => console.error('公開アーティストの取得に失敗しました。', error));

    if (dialog) new MutationObserver(refreshSignalForm).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    if (!form || form.dataset.firebaseCore) return;
    form.dataset.firebaseCore = 'true';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const artistId = $('#signal-artist-select')?.value;
      const signalType = $('#signal-emotion-select')?.value;
      const comment = $('#signal-comment')?.value.trim() || '';
      if (!systemSettings.systemEnabled || !systemSettings.signalEnabled) { const toast=$('#system-toast'); if(toast)toast.textContent='現在この機能は一時停止中です'; return; }
      if (!artistId || !['song', 'stage', 'character'].includes(signalType)) return;
      try {
        const member = await db.collection('members').doc(user.uid).get();
        if (!member.exists) throw new Error('member-not-found');
        const data = member.data();
        await db.collection('artistSignals').add({
          artistId,
          memberUid: user.uid,
          memberId: data.memberId,
          memberDisplayName: data.displayName,
          signalType,
          comment,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          environment: 'dev',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        $('#signal-comment').value = '';
        const toast = $('#system-toast');
        if (toast) toast.textContent = 'SIGNALを送信しました。';
        dialog?.close();
      } catch (error) {
        const toast = $('#system-toast');
        if (toast) toast.textContent = error.code === 'permission-denied' ? 'SIGNALを送信する権限がありません。' : 'SIGNALの送信に失敗しました。';
        console.error('SIGNAL送信エラー', error);
      }
    }, true);
  });
})();
