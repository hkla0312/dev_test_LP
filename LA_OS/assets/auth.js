/* global firebase, FIREBASE_CONFIG */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const STORAGE_KEY = 'la_os_member_profile_v2';
  const SESSION_MS = 60 * 60 * 1000;
  const LOGIN_URL = new URL('./login.html', window.location.href).href;
  const MEMBER_URL = new URL('./index.html', window.location.href).href;

  const isLoginPage = Boolean($('#authGate'));
  const isMemberPage = Boolean($('.os-shell'));

  let authInstance = null;
  let expiryTimer = null;
  let currentAuthIssue = null;

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

  const clearProfile = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const isFreshProfile = (profile) => Boolean(profile && Number(profile.expiresAt || 0) > Date.now());

  const setMessage = (value, issue = null) => {
    const node = $('#authMessage');
    const reportButton = $('#authReportButton');
    if (node) node.textContent = value || '';
    currentAuthIssue = issue?.reportable ? issue : null;
    if (reportButton) {
      reportButton.hidden = !currentAuthIssue;
      reportButton.onclick = currentAuthIssue ? reportAuthIssue : null;
    }
  };

  const setDebugFlag = (name, value) => {
    try {
      document.documentElement.setAttribute(name, String(value));
    } catch {
      // ignore
    }
  };

  const isValidRegistrationPassword = (value) => {
    const password = String(value || '').trim();
    return password.length >= 5
      && /^[A-Za-z0-9]+$/.test(password)
      && /[A-Z]/.test(password)
      && /[a-z]/.test(password);
  };

  const describeAuthError = (error, actionLabel) => {
    const code = String(error?.code || '');
    const fallback = String(error?.message || '不明なエラー');
    const map = {
      'auth/email-already-in-use': 'このメールアドレスはすでに使われています。',
      'auth/email-already-exists': 'このメールアドレスはすでに使われています。',
      'functions/already-exists': 'このメールアドレスはすでに使われています。',
      'functions/invalid-argument': '入力内容をご確認ください。',
      'functions/permission-denied': '保存権限がありません。',
      'functions/resource-exhausted': 'しばらく時間をおいてください。',
      'functions/failed-precondition': '必要な準備がまだ完了していません。',
      'auth/invalid-email': 'メールアドレスの形式をご確認ください。',
      'auth/weak-password': 'パスワードの条件をご確認ください。',
      'auth/user-not-found': '会員情報が見つかりません。',
      'auth/wrong-password': 'メールアドレスかパスワードが違います。',
      'auth/too-many-requests': '試行回数が多すぎます。少し時間をおいてください。',
      'auth/network-request-failed': 'ネットワーク接続に失敗しました。',
      'auth/operation-not-allowed': 'この認証方法は利用できません。',
      'permission-denied': '保存権限がありません。',
      'unavailable': 'サービスが一時的に利用できません。',
      'failed-precondition': '事前条件を満たしていません。',
    };

    const reason = map[code] || fallback;
    return `${actionLabel}できませんでした。${reason}${code ? `（${code}）` : ''}`;
  };

  const getFunctionsApi = () => {
    if (typeof firebase === 'undefined' || typeof firebase.functions !== 'function') {
      return null;
    }

    try {
      return firebase.functions();
    } catch {
      return null;
    }
  };

  const bootstrapMemberProfile = async (user, fallbackProfile = {}) => {
    const functionsApi = getFunctionsApi();
    if (!functionsApi || !user?.uid) {
      return null;
    }

    try {
      const callable = functionsApi.httpsCallable('bootstrapMemberProfile');
      const response = await callable({
        displayName: fallbackProfile.displayName || user.displayName || '',
        email: fallbackProfile.email || user.email || '',
        memberId: fallbackProfile.memberId || '',
      });
      return response?.data?.member || null;
    } catch (error) {
      console.warn('bootstrap member profile skipped', error);
      return null;
    }
  };

  const registerMemberAccount = async (payload) => {
    const functionsApi = getFunctionsApi();
    if (!functionsApi) {
      throw Object.assign(new Error('Firebase Functions is not available.'), { code: 'failed-precondition' });
    }

    const callable = functionsApi.httpsCallable('registerMemberAccount');
    const response = await callable(payload);
    return response?.data || {};
  };

  const buildAuthIssue = (error, actionLabel, context = {}) => {
    const helper = window.LAErrorReporting;
    const classified = helper?.classifyError
      ? helper.classifyError(error, {
          source: 'laos',
          area: 'auth',
          action: actionLabel,
        })
      : null;

    return {
      message: helper?.formatUserMessage
        ? helper.formatUserMessage(error, {
            source: 'laos',
            area: 'auth',
            action: actionLabel,
            actionLabel,
          })
        : describeAuthError(error, actionLabel),
      reportable: Boolean(classified?.reportable),
      code: classified?.code || String(error?.code || ''),
      error,
      actionLabel,
      context,
    };
  };

  const showAuthIssue = (error, actionLabel, context = {}) => {
    const issue = buildAuthIssue(error, actionLabel, context);
    setMessage(issue.message, issue);
  };

  const reportAuthIssue = async () => {
    if (!currentAuthIssue?.reportable) {
      return;
    }

    const functionsApi = getFunctionsApi();
    if (!functionsApi) {
      setMessage('報告機能の準備ができていません。');
      return;
    }

    try {
      const callable = functionsApi.httpsCallable('reportBackendError');
      const helper = window.LAErrorReporting;
      const payload = helper?.buildReportPayload
        ? helper.buildReportPayload(currentAuthIssue.error, {
            source: 'laos',
            area: 'auth',
            action: currentAuthIssue.actionLabel,
            pageUrl: window.location.href,
            ...currentAuthIssue.context,
          })
        : {
            source: 'laos',
            area: 'auth',
            action: currentAuthIssue.actionLabel,
            pageUrl: window.location.href,
            errorCode: currentAuthIssue.code || 'AUTH_UNKNOWN',
            errorCategory: 'backend',
            message: currentAuthIssue.message,
          };

      await callable(payload);
      currentAuthIssue = null;
      setMessage('報告を送信しました。');
    } catch (error) {
      showAuthIssue(error, '報告');
    }
  };

  const openPanel = (panel) => {
    const intro = $('#authIntro');
    const register = $('#authRegisterPanel');
    const login = $('#authLoginPanel');

    if (intro) intro.hidden = Boolean(panel);
    if (register) register.hidden = panel !== 'register';
    if (login) login.hidden = panel !== 'login';
  };

  const showShell = () => {
    $('.os-shell')?.removeAttribute('hidden');
  };

  const hideShell = () => {
    $('.os-shell')?.setAttribute('hidden', '');
  };

  const memberId = () => `#${String(Math.floor(100000 + Math.random() * 900000))}`;

  const memberIdDocId = (value) => String(value || '').replace(/^#/, '') || `member-${Date.now()}`;

  const LOCAL_AUTH_KEY = 'la_os_local_auth_users_v1';
  const LOCAL_MEMBER_KEY = 'la_os_local_members_v1';
  let localAuthAdapter = null;

  const readLocalJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocalJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  };

  const loadLocalAuthUsers = () => readLocalJson(LOCAL_AUTH_KEY, []);
  const saveLocalAuthUsers = (users) => writeLocalJson(LOCAL_AUTH_KEY, users);
  const loadLocalMembers = () => readLocalJson(LOCAL_MEMBER_KEY, {});
  const saveLocalMembers = (members) => writeLocalJson(LOCAL_MEMBER_KEY, members);

  const syncLocalAuthRecord = (uid, patch) => {
    const users = loadLocalAuthUsers();
    const index = users.findIndex((item) => item.uid === uid);
    if (index >= 0) {
      users[index] = { ...users[index], ...patch };
      saveLocalAuthUsers(users);
    }
  };

  const syncLocalMemberRecord = (uid, patch) => {
    const members = loadLocalMembers();
    if (members[uid]) {
      members[uid] = { ...members[uid], ...patch };
      saveLocalMembers(members);
    }
  };

  const primeAuthToken = async (user) => {
    if (!user || typeof user.getIdToken !== 'function') return;
    try {
      await user.getIdToken(true);
    } catch {
      // Ignore token refresh issues here; downstream Firestore access will report any real failure.
    }
  };

  const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const createProfilePayload = (member, fallback = {}) => ({
    displayName: member?.displayName || fallback.displayName || 'LA_OS',
    email: member?.email || fallback.email || '',
    memberId: member?.memberId || fallback.memberId || memberId(),
    version: member?.version || member?.levelLabel || fallback.version || 'v0.01',
    archiveAccess: Boolean(member?.archiveAccess ?? fallback.archiveAccess ?? true),
    currentProgress: Number(member?.currentProgress ?? fallback.currentProgress ?? 38),
    requiredProgress: Number(member?.requiredProgress ?? fallback.requiredProgress ?? 100),
    versionUpPending: Boolean(member?.versionUpPending ?? fallback.versionUpPending ?? true),
    xAccount: member?.xAccount || member?.xId || fallback.xAccount || '',
  });

  const createLocalUser = (record) => ({
    uid: record.uid,
    email: record.email,
    displayName: record.displayName || '',
    emailVerified: false,
    async updateProfile(profile = {}) {
      const displayName = String(profile.displayName || '').trim();
      this.displayName = displayName;
      syncLocalAuthRecord(record.uid, { displayName });
      syncLocalMemberRecord(record.uid, { displayName });
    },
    async delete() {
      const users = loadLocalAuthUsers().filter((item) => item.uid !== record.uid);
      saveLocalAuthUsers(users);
      const members = loadLocalMembers();
      delete members[record.uid];
      saveLocalMembers(members);
      if (localAuthAdapter?.currentUser?.uid === record.uid) {
        localAuthAdapter.currentUser = null;
        localAuthAdapter.notify();
      }
    },
    async getIdToken() {
      return `local-token-${record.uid}`;
    },
  });

  const createLocalAuthAdapter = () => {
    const listeners = new Set();
    const adapter = {
      __isLocalAuth: true,
      currentUser: null,
      setPersistence: async () => {},
      onAuthStateChanged(callback) {
        listeners.add(callback);
        try {
          callback(adapter.currentUser);
        } catch {
          // ignore
        }
        return () => listeners.delete(callback);
      },
      notify() {
        listeners.forEach((callback) => {
          try {
            callback(adapter.currentUser);
          } catch {
            // ignore
          }
        });
      },
      async createUserWithEmailAndPassword(email, password) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const users = loadLocalAuthUsers();
        if (users.some((item) => item.email === normalizedEmail)) {
          const error = new Error('The email address is already in use by another account.');
          error.code = 'auth/email-already-in-use';
          throw error;
        }
        const userRecord = {
          uid: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          email: normalizedEmail,
          password: String(password || ''),
          displayName: '',
        };
        users.push(userRecord);
        saveLocalAuthUsers(users);
        const user = createLocalUser(userRecord);
        adapter.currentUser = user;
        adapter.notify();
        return { user };
      },
      async signInWithEmailAndPassword(email, password) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const users = loadLocalAuthUsers();
        const userRecord = users.find((item) => item.email === normalizedEmail);
        if (!userRecord) {
          const error = new Error('There is no user record corresponding to this identifier.');
          error.code = 'auth/user-not-found';
          throw error;
        }
        if (String(userRecord.password || '') !== String(password || '')) {
          const error = new Error('The password is invalid or the user does not have a password.');
          error.code = 'auth/wrong-password';
          throw error;
        }
        const user = createLocalUser(userRecord);
        adapter.currentUser = user;
        adapter.notify();
        return { user };
      },
      async signOut() {
        adapter.currentUser = null;
        adapter.notify();
      },
      async fetchSignInMethodsForEmail(email) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        return loadLocalAuthUsers().some((item) => item.email === normalizedEmail) ? ['password'] : [];
      },
    };
    localAuthAdapter = adapter;
    return adapter;
  };

  const persistSession = (profile) => {
    const expiresAt = Date.now() + SESSION_MS;
    saveProfile({
      ...profile,
      expiresAt,
    });

    window.clearTimeout(expiryTimer);
    expiryTimer = window.setTimeout(async () => {
      clearProfile();
      if (authInstance?.currentUser) {
        try {
          await authInstance.signOut();
        } catch {
          // ignore
        }
      }
      window.location.replace(LOGIN_URL);
    }, SESSION_MS);
  };

  const initFirebase = () => {
    if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') return null;

    try {
      if (!firebase.apps?.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      return firebase.auth();
    } catch (error) {
      console.error('Firebase init failed', error);
      return null;
    }
  };

  const ensureMemberRecord = async (user, fallbackProfile = {}) => {
    if (!user) {
      return createProfilePayload(null, fallbackProfile);
    }

    if (authInstance?.__isLocalAuth || typeof firebase === 'undefined' || !firebase.firestore) {
      const members = loadLocalMembers();
      const existing = members[user.uid] || null;
      const fallback = createProfilePayload(existing, fallbackProfile);

      if (!existing) {
        const createdAt = new Date().toISOString();
        const member = {
          uid: user.uid,
          memberId: fallback.memberId,
          displayName: fallback.displayName,
          email: user.email || fallback.email || '',
          emailVerified: Boolean(user.emailVerified),
          progress: fallback.currentProgress,
          currentProgress: fallback.currentProgress,
          requiredProgress: fallback.requiredProgress,
          version: fallback.version,
          versionUpPending: fallback.versionUpPending,
          archiveAccess: fallback.archiveAccess,
          levelValue: 1,
          levelLabel: fallback.version,
          accountStatus: 'active',
          environment: 'prod',
          lastLoginAt: createdAt,
          registeredAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        };
        members[user.uid] = member;
        saveLocalMembers(members);
        syncLocalAuthRecord(user.uid, { displayName: member.displayName, memberId: member.memberId });
        return createProfilePayload(member, fallback);
      }

      return createProfilePayload(existing, fallback);
    }

    await primeAuthToken(user);
    await pause(600);
    const db = firebase.firestore();
    const ref = db.collection('members').doc(user.uid);
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    let member = null;

    try {
      const snapshot = await ref.get();
      member = snapshot.exists ? snapshot.data() : null;
    } catch (readError) {
      console.warn('member profile read skipped', readError);
    }

    const fallback = createProfilePayload(member, fallbackProfile);

    if (!member) {
      member = {
        uid: user.uid,
        memberId: fallback.memberId,
        displayName: fallback.displayName,
        email: user.email || fallback.email || '',
        emailVerified: Boolean(user.emailVerified),
        progress: fallback.currentProgress,
        currentProgress: fallback.currentProgress,
        requiredProgress: fallback.requiredProgress,
        version: fallback.version,
        versionUpPending: fallback.versionUpPending,
        archiveAccess: fallback.archiveAccess,
        levelValue: 1,
        levelLabel: fallback.version,
        accountStatus: 'active',
        environment: 'prod',
        lastLoginAt: timestamp,
        registeredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await ref.set(member);

      try {
        await db.collection('memberIds').doc(memberIdDocId(member.memberId)).set({
          uid: user.uid,
          memberId: member.memberId,
          displayName: member.displayName,
          createdAt: timestamp,
        });
      } catch (memberIdWriteError) {
        console.warn('memberIds write skipped', memberIdWriteError);
      }

      return createProfilePayload(member, fallback);
    }

    return createProfilePayload(member, fallback);
  };

  const saveMemberRecord = async (user, fallbackProfile = {}) => {
    if (!user) {
      return createProfilePayload(null, fallbackProfile);
    }

    if (authInstance?.__isLocalAuth || typeof firebase === 'undefined' || !firebase.firestore) {
      const createdAt = new Date().toISOString();
      const member = {
        uid: user.uid,
        memberId: fallbackProfile.memberId || memberId(),
        displayName: fallbackProfile.displayName || user.displayName || 'LA_OS',
        email: user.email || fallbackProfile.email || '',
        emailVerified: Boolean(user.emailVerified),
        progress: Number(fallbackProfile.currentProgress ?? 38),
        currentProgress: Number(fallbackProfile.currentProgress ?? 38),
        requiredProgress: Number(fallbackProfile.requiredProgress ?? 100),
        version: fallbackProfile.version || 'v0.01',
        versionUpPending: Boolean(fallbackProfile.versionUpPending ?? true),
        archiveAccess: Boolean(fallbackProfile.archiveAccess ?? true),
        levelValue: 1,
        levelLabel: fallbackProfile.version || 'v0.01',
        accountStatus: 'active',
        environment: 'prod',
        lastLoginAt: createdAt,
        registeredAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      };
      const members = loadLocalMembers();
      members[user.uid] = member;
      saveLocalMembers(members);
      syncLocalAuthRecord(user.uid, { displayName: member.displayName, memberId: member.memberId });
      return createProfilePayload(member, fallbackProfile);
    }

    await primeAuthToken(user);
    await pause(600);
    const db = firebase.firestore();
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    const member = {
      uid: user.uid,
      memberId: fallbackProfile.memberId || memberId(),
      displayName: fallbackProfile.displayName || user.displayName || 'LA_OS',
      email: user.email || fallbackProfile.email || '',
      emailVerified: Boolean(user.emailVerified),
      progress: Number(fallbackProfile.currentProgress ?? 38),
      currentProgress: Number(fallbackProfile.currentProgress ?? 38),
      requiredProgress: Number(fallbackProfile.requiredProgress ?? 100),
      version: fallbackProfile.version || 'v0.01',
      versionUpPending: Boolean(fallbackProfile.versionUpPending ?? true),
      archiveAccess: Boolean(fallbackProfile.archiveAccess ?? true),
      levelValue: 1,
      levelLabel: fallbackProfile.version || 'v0.01',
      accountStatus: 'active',
      environment: 'prod',
      lastLoginAt: timestamp,
      registeredAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const memberRef = db.collection('members').doc(user.uid);
    const memberSnapshot = await memberRef.get();

    if (memberSnapshot.exists) {
      const existing = memberSnapshot.data() || {};
      const patch = {
        displayName: member.displayName,
        updatedAt: timestamp,
      };
      await memberRef.update(patch);

      const mergedMember = {
        ...existing,
        ...patch,
        uid: existing.uid || user.uid,
        memberId: existing.memberId || member.memberId,
        email: existing.email || member.email,
        emailVerified: existing.emailVerified ?? member.emailVerified,
        currentProgress: existing.currentProgress ?? member.currentProgress,
        requiredProgress: existing.requiredProgress ?? member.requiredProgress,
        version: existing.version || member.version,
        versionUpPending: existing.versionUpPending ?? member.versionUpPending,
        archiveAccess: existing.archiveAccess ?? member.archiveAccess,
        levelValue: existing.levelValue ?? member.levelValue,
        levelLabel: existing.levelLabel || member.levelLabel,
        accountStatus: existing.accountStatus || member.accountStatus,
        environment: existing.environment || member.environment,
      };

      return createProfilePayload(mergedMember, fallbackProfile);
    }

    const bootstrapMember = await bootstrapMemberProfile(user, fallbackProfile);
    if (bootstrapMember) {
      return createProfilePayload(bootstrapMember, fallbackProfile);
    }

    try {
      await memberRef.set(member);
    } catch (error) {
      if (String(error?.code || '') === 'permission-denied') {
        await primeAuthToken(user);
        await pause(1200);
        const profile = await waitForMemberRecord(user, fallbackProfile, 15000);
        if (profile) {
          return profile;
        }
      }
      throw error;
    }

    try {
      await db.collection('memberIds').doc(memberIdDocId(member.memberId)).set({
        uid: user.uid,
        memberId: member.memberId,
        displayName: member.displayName,
        createdAt: timestamp,
      });
    } catch (memberIdWriteError) {
      console.warn('memberIds write skipped', memberIdWriteError);
    }

    return createProfilePayload(member, fallbackProfile);
  };

  const formatMemberAuthError = (error, actionLabel) => {
    const code = String(error?.code || '');
    const fallback = String(error?.message || '不明なエラー');
    const map = {
      'auth/email-already-in-use': 'このメールアドレスはすでに使用されています。',
      'auth/email-already-exists': 'このメールアドレスはすでに使用されています。',
      'functions/already-exists': 'このメールアドレスはすでに使用されています。',
      'functions/invalid-argument': '入力内容を確認してください。',
      'functions/permission-denied': '保存権限がありません。',
      'functions/resource-exhausted': 'しばらく時間をおいてください。',
      'functions/failed-precondition': '必要な準備がまだ完了していません。',
      'auth/invalid-email': 'メールアドレスの形式を確認してください。',
      'auth/weak-password': 'パスワードの条件を満たしてください。',
      'auth/user-not-found': '該当する会員情報が見つかりません。',
      'auth/wrong-password': 'メールアドレスまたはパスワードが違います。',
      'auth/too-many-requests': '試行回数が多すぎます。少し時間をおいてください。',
      'auth/network-request-failed': 'ネットワーク接続に失敗しました。',
      'auth/operation-not-allowed': 'この認証方法は利用できません。',
      'permission-denied': '保存権限がありません。',
      'unavailable': 'サービスが一時的に利用できません。',
      'failed-precondition': '必要な準備がまだ完了していません。',
      'member-record-not-ready': '会員データの準備がまだ完了していません。少し待ってからもう一度お試しください。',
    };

    const reason = map[code] || fallback;
    return `${actionLabel}に失敗しました。${reason}${code ? `（${code}）` : ''}`;
  };

  const waitForMemberRecord = async (user, fallbackProfile = {}, timeoutMs = 10000) => {
    if (!user) {
      return createProfilePayload(null, fallbackProfile);
    }

    if (authInstance?.__isLocalAuth || typeof firebase === 'undefined' || !firebase.firestore) {
      return ensureMemberRecord(user, fallbackProfile);
    }

    await primeAuthToken(user);
    const db = firebase.firestore();
    const ref = db.collection('members').doc(user.uid);
    const deadline = Date.now() + Math.max(2000, Number(timeoutMs) || 0);
    let lastError = null;

    while (Date.now() < deadline) {
      try {
        const snapshot = await ref.get();
        if (snapshot.exists) {
          return createProfilePayload(snapshot.data(), fallbackProfile);
        }
      } catch (error) {
        lastError = error;
        if (String(error?.code || '') === 'permission-denied') {
          await primeAuthToken(user);
          await pause(900);
          continue;
        }
      }

      await pause(700);
    }

    if (lastError) {
      throw lastError;
    }

    const error = new Error('Member record is not ready yet.');
    error.code = 'member-record-not-ready';
    throw error;
  };

  const isEmailActuallyInUse = async (email) => {
    if (!authInstance || typeof authInstance.fetchSignInMethodsForEmail !== 'function') {
      return null;
    }

    try {
      const methods = await authInstance.fetchSignInMethodsForEmail(email);
      return Array.isArray(methods) && methods.length > 0;
    } catch {
      return null;
    }
  };

  const redirectToLogin = () => window.location.replace(LOGIN_URL);
  const redirectToMember = () => window.location.replace(MEMBER_URL);

  const syncLoginPage = async () => {
    const stored = loadProfile();
    if (isFreshProfile(stored)) {
      redirectToMember();
      return;
    }

    if (authInstance?.currentUser) {
      try {
        await authInstance.signOut();
      } catch {
        // ignore
      }
    }

    openPanel(null);

    const displayNameInput = $('#authRegister [name="displayName"]');
    const emailInput = $('#authRegister [name="email"]');
    const passwordInput = $('#authRegister [name="password"]');
    const loginEmailInput = $('#authLogin [name="email"]');
    const loginPasswordInput = $('#authLogin [name="password"]');

    if (stored) {
      if (displayNameInput && !displayNameInput.value) displayNameInput.value = stored.displayName || '';
      if (emailInput && !emailInput.value) emailInput.value = stored.email || '';
      if (loginEmailInput && !loginEmailInput.value) loginEmailInput.value = stored.email || '';
    }
  };

  const syncMemberPage = async () => {
    const stored = loadProfile();
    if (!isFreshProfile(stored)) {
      clearProfile();
      if (authInstance?.currentUser) {
        try {
          await authInstance.signOut();
        } catch {
          // ignore
        }
      }
      hideShell();
      redirectToLogin();
      return;
    }

    showShell();
  };

  async function handleRegister(event) {
    event.preventDefault();
    setDebugFlag('data-laos-last-auth-action', 'register');
    setDebugFlag('data-laos-register-hit', Number(document.documentElement.getAttribute('data-laos-register-hit') || 0) + 1);
    setMessage('');

    const form = new FormData(event.currentTarget);
    const displayName = String(form.get('displayName') || '').trim();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '').trim();

    if (!displayName) {
      setMessage('名前を入力してください。');
      return;
    }

    if (!email) {
      setMessage('メアドを入力してください。');
      return;
    }

    if (!isValidRegistrationPassword(password)) {
      setMessage('パスワードは英数字5文字以上で、英大文字と英小文字をそれぞれ1文字以上含めてください。');
      return;
    }

    if (!authInstance) {
      setMessage('登録機能の準備ができていません。');
      return;
    }

    const fallbackProfile = createProfilePayload(null, {
      displayName,
      email,
      memberId: memberId(),
      version: 'v0.01',
      archiveAccess: true,
      currentProgress: 38,
      requiredProgress: 100,
      versionUpPending: true,
    });

    try {
      if (authInstance?.__isLocalAuth) {
        const result = await authInstance.createUserWithEmailAndPassword(email, password);
        await result.user.updateProfile({ displayName });
        const profile = await saveMemberRecord(result.user, fallbackProfile);
        persistSession(profile);
        redirectToMember();
        return;
      }

      const result = await registerMemberAccount({ displayName, email, password });
      const customToken = String(result?.customToken || '');
      let credential = null;

      if (customToken) {
        try {
          credential = await authInstance.signInWithCustomToken(customToken);
        } catch (tokenError) {
          console.warn('custom token sign-in skipped', tokenError);
        }
      }

      if (!credential) {
        const deadline = Date.now() + 15000;
        let lastError = null;

        while (Date.now() < deadline) {
          try {
            credential = await authInstance.signInWithEmailAndPassword(email, password);
            break;
          } catch (signInError) {
            lastError = signInError;
            const signInCode = String(signInError?.code || '');
            if (!signInCode.startsWith('auth/')) {
              throw signInError;
            }
            await pause(900);
          }
        }

        if (!credential) {
          throw lastError || Object.assign(new Error('Login is not ready yet.'), { code: 'failed-precondition' });
        }
      }

      await primeAuthToken(credential.user);
      const profile = result.member || await waitForMemberRecord(credential.user, fallbackProfile, 15000);
      persistSession(profile);
      redirectToMember();
    } catch (error) {
      const code = String(error?.code || '');
      if (code === 'auth/email-already-in-use' || code === 'auth/email-already-exists' || code === 'functions/already-exists') {
        showAuthIssue(error, '登録');
        return;
      }
      if (code === 'failed-precondition' || code === 'functions/failed-precondition') {
        showAuthIssue(error, '登録');
        return;
      }
      showAuthIssue(error, '登録');
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setDebugFlag('data-laos-last-auth-action', 'login');
    setDebugFlag('data-laos-login-hit', Number(document.documentElement.getAttribute('data-laos-login-hit') || 0) + 1);
    setMessage('');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');

    if (!email || !password) {
      setMessage('メールアドレスとパスワードを入力してください。');
      return;
    }

    // Static GitHub Pages preview account. Production Firebase authentication remains unchanged.
    if (window.location.hostname.endsWith('github.io') && email === 'demo@la-os.local' && password === 'demo1234') {
      persistSession({
        displayName: 'DEMO MEMBER',
        email,
        memberId: '#DEMO001',
        version: 'v0.02',
        archiveAccess: true,
        currentProgress: 38,
        requiredProgress: 100,
        versionUpPending: false,
      }, password);
      redirectToMember();
      return;
    }

    if (!authInstance) {
      setMessage('ログイン機能の準備ができていません。');
      return;
    }

    try {
      const credential = await authInstance.signInWithEmailAndPassword(email, password);
      await primeAuthToken(credential.user);
      try {
        const profile = await bootstrapMemberProfile(credential.user, loadProfile() || {}) || await waitForMemberRecord(credential.user, loadProfile() || {});
        persistSession(profile);
        redirectToMember();
      } catch (profileError) {
        try {
          await authInstance.signOut();
        } catch {
          // ignore
        }
        showAuthIssue(profileError, 'ログイン');
      }
    } catch (error) {
      showAuthIssue(error, 'ログイン');
    }
  }

  async function handleLogout() {
    clearProfile();
    window.clearTimeout(expiryTimer);
    if (authInstance) {
      try {
        await authInstance.signOut();
      } catch {
        // ignore
      }
    }
    redirectToLogin();
  }

  function bindLoginPage() {
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
  }

  function bindMemberPage() {
    $('#logout-button')?.addEventListener('click', handleLogout);
  }

  function playAuthLoaderSequence() {
    const loader = $('#authLoader');
    const stage = $('.auth-loader-stage');
    const fill = $('.auth-loader-track i');
    const percent = $('#authLoaderPercent');
    if (!loader || !stage || !fill) return;

    const phases = [
      { text: 'CONNECTING SESSION...', delay: 120, width: '22%', percent: '22%' },
      { text: 'VERIFYING PROFILE...', delay: 420, width: '58%', percent: '58%' },
      { text: 'OPENING LA_OS...', delay: 760, width: '86%', percent: '86%' },
      { text: 'SYSTEM ONLINE.', delay: 1120, width: '100%', percent: '100%' },
    ];

    phases.forEach((phase) => {
      window.setTimeout(() => {
        stage.textContent = phase.text;
        fill.style.transform = `scaleX(${Number.parseFloat(phase.percent) / 100})`;
        if (percent) percent.textContent = phase.percent;
      }, phase.delay);
    });

    window.setTimeout(() => {
      loader.classList.add('is-hidden');
    }, 1620);
  }

  async function bootstrap() {
    authInstance = initFirebase();
    setDebugFlag('data-laos-auth-mode', authInstance ? 'firebase' : 'unavailable');

    if (authInstance?.setPersistence && typeof firebase !== 'undefined' && firebase.auth?.Auth) {
      authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    }

    if (!authInstance) {
      if (isLoginPage) {
        setMessage('Firebaseの準備ができていません。オンライン環境と設定を確認してください。');
      }
      playAuthLoaderSequence();
      return;
    }

    if (isLoginPage) {
      bindLoginPage();
      await syncLoginPage();
    }

    if (isMemberPage) {
      bindMemberPage();
      await syncMemberPage();
    }

    if (authInstance) {
      authInstance.onAuthStateChanged(async (user) => {
        const stored = loadProfile();
        const fresh = isFreshProfile(stored);

        if (isLoginPage) {
          if (user && fresh) {
            redirectToMember();
            return;
          }

          if (user && !fresh) {
            try {
              await authInstance.signOut();
            } catch {
              // ignore
            }
            clearProfile();
          }
          return;
        }

        if (isMemberPage) {
          if (!fresh) {
            clearProfile();
            if (user) {
              try {
                await authInstance.signOut();
              } catch {
                // ignore
              }
            }
            redirectToLogin();
          }
        }
      });
    }

    playAuthLoaderSequence();
  }

  bootstrap();
})();
