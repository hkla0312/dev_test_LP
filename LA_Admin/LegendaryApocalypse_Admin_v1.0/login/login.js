/* global firebase, FIREBASE_CONFIG */
(() => {
  'use strict';
  const form = document.querySelector('#adminLoginForm');
  const error = document.querySelector('#loginError');
  const button = document.querySelector('#loginButton');
  const notice = document.querySelector('#sessionNotice');
  const requestedDestination = new URLSearchParams(location.search).get('next');
  const destination = requestedDestination && requestedDestination.startsWith('../') ? requestedDestination : '../index.html';
  const message = input => { error.textContent = input; error.hidden = !input; };
  const exitReason = sessionStorage.getItem('la-admin-exit-reason');
  if (exitReason) {
    sessionStorage.removeItem('la-admin-exit-reason');
    const labels = { timeout: '2時間無操作のためログアウトしました。', role: '管理者権限の確認に失敗しました。', auth: '認証状態を確認できなかったため、ログイン画面へ戻りました。', error: '管理画面の初期化でエラーが発生しました。' };
    notice.textContent = labels[exitReason] || 'ログイン画面へ戻りました。'; notice.hidden = false;
  }
  const authError = code => ({
    'auth/invalid-email':'メールアドレスの形式を確認してください。',
    'auth/user-not-found':'メールアドレスまたはパスワードが正しくありません。',
    'auth/wrong-password':'メールアドレスまたはパスワードが正しくありません。',
    'auth/invalid-credential':'メールアドレスまたはパスワードが正しくありません。',
    'auth/too-many-requests':'試行回数が多すぎます。時間をおいて再度お試しください。'
  }[code] || 'ログインに失敗しました。設定と通信状態を確認してください。');
  if (!window.FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) { message('Firebase設定がありません。firebase-config.js を確認してください。'); return; }
  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  const continueAsAdmin = async user => {
    const db = firebase.firestore();
    const [admin, admins] = await Promise.all([db.collection('admin').doc(user.uid).get(), db.collection('admins').doc(user.uid).get()]);
    if (!admin.exists && !admins.exists) {
      await auth.signOut();
      const error = new Error('admin-role-required');
      error.uid = user.uid;
      throw error;
    }
    location.replace(destination);
  };
  const setupAuth = async () => {
    try { await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); }
    catch (_) { message('ブラウザの認証セッションを保存できません。file:// ではなく localhost 経由で開いてください。'); return; }
    auth.onAuthStateChanged(async user => {
      if (!user || button.disabled) return;
      button.disabled = true; button.textContent = '管理者権限を確認中…';
      try { await continueAsAdmin(user); }
      catch (reason) { message(reason.message === 'admin-role-required' ? `このアカウントには管理者権限がありません。Firestore の admin または admins コレクションに、ドキュメントID「${reason.uid}」を作成してください。` : authError(reason.code)); button.disabled = false; button.textContent = '管理画面へ進む'; }
    });
  };
  setupAuth();
  form.addEventListener('submit', async event => {
    event.preventDefault(); message('');
    const email = document.querySelector('#email').value.trim(), password = document.querySelector('#password').value;
    if (!email || password.length < 6) { message('メールアドレスと6文字以上のパスワードを入力してください。'); return; }
    button.disabled = true; button.textContent = 'ログインを確認中…';
    try { const result = await auth.signInWithEmailAndPassword(email, password); await continueAsAdmin(result.user); }
    catch (reason) { message(reason.message === 'admin-role-required' ? `このアカウントには管理者権限がありません。Firestore の admin または admins コレクションに、ドキュメントID「${reason.uid}」を作成してください。` : authError(reason.code)); button.disabled = false; button.textContent = '管理画面へ進む'; }
  });
})();
