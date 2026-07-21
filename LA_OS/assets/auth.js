/* global firebase, FIREBASE_CONFIG */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const STORAGE_KEY = 'la_os_member_profile_v2';
  const SESSION_MS = 60 * 60 * 1000;

  let authInstance = null;
  let unsubscribeMember = null;
  let expiryTimer = null;

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));

  const message = (value) => {
    const node = $('#authMessage');
    if (node) node.textContent = value || '';
  };

  const loadProfile = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveProfile = (profile) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
  };

  const isFreshProfile = (profile) => Boolean(profile && Number(profile.expiresAt || 0) > Date.now());

  const clearSession = () => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  };

  const scheduleExpiry = (expiresAt) => {
    clearSession();
    const remaining = Number(expiresAt || 0) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    expiryTimer = window.setTimeout(async () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      if (authInstance?.currentUser) {
        try {
          await authInstance.signOut();
        } catch {
          // ignore
        }
      }
      showGate();
      message('セッションの有効期限が切れました。もう一度ログインしてください。');
    }, remaining);
  };

  const memberId = () => `#${String(Math.floor(100000 + Math.random() * 900000))}`;

  const tempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let value = '';
    for (let i = 0; i < 18; i += 1) {
      value += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${value}!9`;
  };

  const showGate = () => {
    $('#authGate')?.removeAttribute('hidden');
    $('.os-shell')?.setAttribute('hidden', '');
    openPanel(null);
  };

  const showShell = () => {
    $('#authGate')?.setAttribute('hidden', '');
    $('.os-shell')?.removeAttribute('hidden');
  };

  const openPanel = (panel) => {
    const register = $('#authRegisterPanel');
    const login = $('#authLoginPanel');
    if (register) register.hidden = panel !== 'register';
    if (login) login.hidden = panel !== 'login';
  };

  const loginSuccess = (name) => {
    document.querySelector('.login-success-dialog')?.remove();
    const dialog = document.createElement('section');
    dialog.className = 'login-success-dialog';
    dialog.innerHTML = `
      <div>
        <p>REGISTERED</p>
        <h2>${escapeHtml(name)} さん、ようこそ。</h2>
        <span>会員ページを開きます。</span>
        <button type="button">LA_OSを開く</button>
      </div>
    `;
    document.body.append(dialog);
    dialog.querySelector('button')?.addEventListener('click', () => dialog.remove());
  };

  const renderMember = (member) => {
    const displayName = member?.displayName || 'LA_OS';
    const version = member?.version || member?.levelLabel || 'v0.01';
    const email = member?.email || '';
    const code = member?.memberId || '—';
    const progress = Number(member?.progress ?? member?.currentProgress ?? 0);
    const required = Number(member?.requiredProgress ?? 100);
    const ratio = required > 0 ? Math.max(0, Math.min(100, Math.round((progress / required) * 100))) : 0;

    const header = $('#header-identity');
    if (header) header.textContent = `${displayName} ${version}`;

    const displayNameInput = $('#settings-display-name');
    if (displayNameInput) displayNameInput.value = displayName;

    const emailInput = $('#settings-email');
    if (emailInput) emailInput.value = email;

    const memberIdNode = $('#settings-member-id');
    if (memberIdNode) memberIdNode.textContent = code;

    const progressValue = $('#progress-value');
    if (progressValue) progressValue.textContent = String(ratio);

    const progressNote = $('#progress-note');
    if (progressNote) progressNote.textContent = '進捗を表示中。なにか起こるかも。';

    const progressFill = $('#progress-fill');
    if (progressFill) progressFill.style.width = `${ratio}%`;

    const progressTrack = $('#progress-track');
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(ratio));
  };

  async function createMemberRecord(user, displayName, assignedMemberId = memberId()) {
    const db = firebase.firestore();
    const batch = db.batch();
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();

    batch.set(db.collection('memberIds').doc(assignedMemberId), {
      uid: user.uid,
      createdAt: timestamp,
    });

    batch.set(db.collection('members').doc(user.uid), {
      uid: user.uid,
      memberId: assignedMemberId,
      displayName,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      xId: null,
      progress: 0,
      levelValue: 1,
      levelLabel: 'v0.01',
      licenseType: 'NONE',
      accountStatus: 'active',
      environment: 'dev',
      registeredAt: timestamp,
      lastLoginAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await batch.commit();
    return assignedMemberId;
  }

  async function showMember(user) {
    await user.reload();
    const currentUser = firebase.auth().currentUser || user;
    const db = firebase.firestore();
    const ref = db.collection('members').doc(currentUser.uid);
    const snap = await ref.get();

    let member = snap.exists ? snap.data() : null;
    if (!member) {
      const stored = loadProfile();
      const fallbackDisplayName = (stored && stored.displayName) || currentUser.displayName || currentUser.email?.split('@')[0] || 'LA_OS';
      const fallbackMemberId = (stored && stored.memberId) || memberId();
      await createMemberRecord(currentUser, fallbackDisplayName, fallbackMemberId);
      member = {
        uid: currentUser.uid,
        memberId: fallbackMemberId,
        displayName: fallbackDisplayName,
        email: currentUser.email,
        emailVerified: Boolean(currentUser.emailVerified),
        progress: 0,
        levelValue: 1,
        levelLabel: 'v0.01',
        version: 'v0.01',
      };
    }

    if (!member.displayName) {
      member.displayName = currentUser.displayName || 'LA_OS';
      await ref.set({ displayName: member.displayName, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    if (currentUser.emailVerified && !member.emailVerified) {
      await ref.set({ emailVerified: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    await ref.set(
      {
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    saveProfile({
      displayName: member.displayName,
      email: currentUser.email,
      memberId: member.memberId,
      version: member.version || member.levelLabel || 'v0.01',
      secret: loadProfile()?.secret || '',
      expiresAt: Date.now() + SESSION_MS,
    });
    scheduleExpiry(Date.now() + SESSION_MS);

    showShell();
    renderMember(member);

    if (unsubscribeMember) unsubscribeMember();
    unsubscribeMember = ref.onSnapshot(
      (doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        renderMember(data);
        saveProfile({
          displayName: data.displayName,
          email: data.email || currentUser.email,
          memberId: data.memberId,
          version: data.version || data.levelLabel || 'v0.01',
          secret: loadProfile()?.secret || '',
          expiresAt: Date.now() + SESSION_MS,
        });
        scheduleExpiry(Date.now() + SESSION_MS);
      },
      () => {
        message('会員データの同期に失敗しました。');
      }
    );
  }

  async function handleRegister(event) {
    event.preventDefault();
    message('');

    const form = new FormData(event.currentTarget);
    const displayName = String(form.get('displayName') || '').trim();
    const email = String(form.get('email') || '').trim().toLowerCase();

    if (!displayName) {
      message('名前を入力してください。');
      return;
    }

    if (!email) {
      message('メアドを入力してください。');
      return;
    }

    const profile = {
      displayName,
      email,
      memberId: memberId(),
      version: 'v0.01',
    };
    const secret = tempPassword();
    saveProfile({ ...profile, secret, expiresAt: Date.now() + SESSION_MS });
    scheduleExpiry(Date.now() + SESSION_MS);

    if (!authInstance) {
      renderMember({ ...profile, progress: 0, levelLabel: 'v0.01' });
      showShell();
      return;
    }

    try {
      const result = await authInstance.createUserWithEmailAndPassword(email, secret);
      await result.user.updateProfile({ displayName });
      const assignedMemberId = await createMemberRecord(result.user, displayName, profile.memberId);
      saveProfile({ ...profile, memberId: assignedMemberId, secret, expiresAt: Date.now() + SESSION_MS });
      scheduleExpiry(Date.now() + SESSION_MS);
      await showMember(result.user);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        const stored = loadProfile();
        if (stored && stored.email === email && stored.secret) {
          try {
            const result = await authInstance.signInWithEmailAndPassword(email, stored.secret);
            await showMember(result.user);
            return;
          } catch {
            // fall through
          }
        }
        message('このメールアドレスは登録済みです。');
        return;
      }

      console.error('Registration fallback', error);
      renderMember({ ...profile, progress: 0, levelLabel: 'v0.01' });
      showShell();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    message('');

    if (!authInstance) {
      message('ログイン機能を準備中です。');
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');

    try {
      const credential = await authInstance.signInWithEmailAndPassword(email, password);
      await showMember(credential.user || authInstance.currentUser || { reload: async () => {} });
    } catch (error) {
      message(
        error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found'
          ? 'メールアドレスかパスワードが違います。'
          : 'ログインに失敗しました。'
      );
    }
  }

  function init() {
    const stored = loadProfile();
    openPanel(null);
    if (stored) {
      const displayNameInput = $('#authRegister [name="displayName"]');
      const emailInput = $('#authRegister [name="email"]');
      const loginEmailInput = $('#authLogin [name="email"]');
      const loginPasswordInput = $('#authLogin [name="password"]');
      if (displayNameInput && !displayNameInput.value) displayNameInput.value = stored.displayName || '';
      if (emailInput && !emailInput.value) emailInput.value = stored.email || '';
      if (loginEmailInput && !loginEmailInput.value) loginEmailInput.value = stored.email || '';
      if (loginPasswordInput && !loginPasswordInput.value && stored.secret) loginPasswordInput.value = stored.secret;
    }

    if (typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined') {
      try {
        firebase.initializeApp(FIREBASE_CONFIG);
        authInstance = firebase.auth();
        if (authInstance.setPersistence) {
          authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
        }
        authInstance.onAuthStateChanged(async (user) => {
          if (!user) return;
          try {
            const cached = loadProfile();
            if (!isFreshProfile(cached) || (cached?.email && cached.email !== user.email)) {
              await authInstance.signOut();
              showGate();
              return;
            }
            await showMember(user);
          } catch (error) {
            message(error.message || '会員情報の表示に失敗しました。');
          }
        });
      } catch (error) {
        console.error('Firebase init failed', error);
      }
    }

    $('#auth-show-register')?.addEventListener('click', () => {
      openPanel('register');
      $('#authRegister [name="displayName"]')?.focus();
    });

    $('#auth-show-login')?.addEventListener('click', () => {
      openPanel('login');
      $('#authLogin [name="email"]')?.focus();
    });

    $('#authRegister')?.addEventListener('submit', handleRegister);
    $('#authLogin')?.addEventListener('submit', handleLogin);

    $('#logout-button')?.addEventListener('click', async () => {
      clearSession();
      if (unsubscribeMember) unsubscribeMember();
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }

      if (authInstance) {
        try {
          await authInstance.signOut();
        } catch {
          // ignore
        }
      }

      showGate();
      location.reload();
    });

    const cached = loadProfile();
    if (isFreshProfile(cached)) {
      scheduleExpiry(cached.expiresAt);
      showShell();
      renderMember({
        displayName: cached.displayName || 'LA_OS',
        email: cached.email || '',
        memberId: cached.memberId || '#000000',
        version: cached.version || 'v0.01',
        progress: 0,
        levelLabel: cached.version || 'v0.01',
      });
    }

    setTimeout(() => $('#authLoader')?.classList.add('is-hidden'), 700);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
