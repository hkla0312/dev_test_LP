(() => {
  "use strict";

  const POLICY_MESSAGE = "LA_Terminal内にポリシー違反が検知されました";

  const CODE_CATALOG = [
    {
      code: "LAOS-AUTH-001",
      category: "auth",
      title: "メールアドレス重複",
      situation: "すでに登録されているメールアドレスで初回登録を試行したとき",
      userAction: "別のメールアドレスを使うか、ログインから入ってください。",
    },
    {
      code: "LAOS-AUTH-002",
      category: "auth",
      title: "メール形式不正",
      situation: "メールアドレスの形式が不正なとき",
      userAction: "メールアドレスの入力形式を確認してください。",
    },
    {
      code: "LAOS-AUTH-003",
      category: "auth",
      title: "パスワード条件未達",
      situation: "初回登録のパスワード条件を満たしていないとき",
      userAction: "英数字5文字以上かつ大文字・小文字を1文字以上含めてください。",
    },
    {
      code: "LAOS-AUTH-004",
      category: "auth",
      title: "認証情報不一致",
      situation: "メールアドレスまたはパスワードが一致しないとき",
      userAction: "入力内容を確認して再試行してください。",
    },
    {
      code: "LAOS-AUTH-005",
      category: "auth",
      title: "未ログイン / セッション切れ",
      situation: "ログイン状態が確認できないとき",
      userAction: "再ログインしてください。",
    },
    {
      code: "LAOS-NET-001",
      category: "network",
      title: "通信失敗",
      situation: "ネットワーク接続が不安定なとき",
      userAction: "通信状態を確認してから再送信してください。",
    },
    {
      code: "LAOS-SRV-001",
      category: "backend",
      title: "保存権限不足",
      situation: "Firestore Rules や保存権限が不足しているとき",
      userAction: "運営へ報告してください。Admin 側で権限設定を確認します。",
    },
    {
      code: "LAOS-SYNC-001",
      category: "backend",
      title: "会員情報未同期",
      situation: "会員プロフィールの同期がまだ完了していないとき",
      userAction: "少し待ってから再試行してください。",
    },
    {
      code: "LAOS-QUO-001",
      category: "backend",
      title: "送信上限到達",
      situation: "SIGNAL や DANMAKU の回数上限に達したとき",
      userAction: "上限回数の回復を待ってから再度お試しください。",
    },
    {
      code: "LAOS-SRV-002",
      category: "backend",
      title: "サービス一時停止",
      situation: "Firebase 側が一時的に応答しないとき",
      userAction: "時間をおいて再試行してください。",
    },
    {
      code: "LAOS-SRV-003",
      category: "backend",
      title: "内部エラー / タイムアウト",
      situation: "処理が内部エラーやタイムアウトで失敗したとき",
      userAction: "エラーコードを添えて運営へ報告してください。",
    },
    {
      code: "LAOS-UNK-001",
      category: "backend",
      title: "未分類",
      situation: "分類できない予期しないエラーが起きたとき",
      userAction: "エラーコードを添えて運営へ報告してください。",
    },
  ];

  const normalizeCode = (value) => String(value || "").trim().toLowerCase();
  const sourcePrefix = (value) => String(value || "").trim().toLowerCase().includes("lp") ? "LP" : "LAOS";
  const clean = (value, limit = 240) => String(value ?? "").trim().replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, limit);

  function resolveCatalogEntry(code) {
    return CODE_CATALOG.find((entry) => entry.code === code) || CODE_CATALOG[CODE_CATALOG.length - 1];
  }

  function classifyError(error, context = {}) {
    const rawCode = normalizeCode(error?.code);
    const rawMessage = clean(error?.message || error?.details || "予期しないエラー");
    const prefix = sourcePrefix(context.source);
    const area = clean(context.area || "system", 60);
    const action = clean(context.action || "", 60);

    if (/ポリシー違反/.test(rawMessage)) {
      return {
        code: `${prefix}-POL-001`,
        category: "policy",
        reportable: false,
        message: POLICY_MESSAGE,
        rawCode,
        rawMessage,
        area,
        action,
      };
    }

    if (rawCode.includes("auth/email-already-in-use")) {
      return { code: `${prefix}-AUTH-001`, category: "validation", reportable: false, message: "このメールアドレスはすでに使用されています。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("auth/invalid-email")) {
      return { code: `${prefix}-AUTH-002`, category: "validation", reportable: false, message: "メールアドレスの形式を確認してください。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("auth/weak-password")) {
      return { code: `${prefix}-AUTH-003`, category: "validation", reportable: false, message: "パスワードの条件を満たしていません。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("auth/user-not-found") || rawCode.includes("auth/wrong-password") || rawCode.includes("auth/invalid-credential")) {
      return { code: `${prefix}-AUTH-004`, category: "validation", reportable: false, message: "メールアドレスまたはパスワードが一致しません。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("auth/network-request-failed")) {
      return { code: `${prefix}-NET-001`, category: "network", reportable: true, message: "通信状態を確認してから再試行してください。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("unauthenticated")) {
      return { code: `${prefix}-AUTH-005`, category: "auth", reportable: false, message: "ログイン状態を確認してください。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("permission-denied")) {
      return { code: `${prefix}-SRV-001`, category: "backend", reportable: true, message: "保存権限がありません。運営へ報告してください。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("failed-precondition") || rawCode === "member-record-not-ready") {
      return { code: `${prefix}-SYNC-001`, category: "backend", reportable: true, message: "会員情報の同期がまだ完了していません。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("resource-exhausted") || rawCode.includes("too-many-requests")) {
      return { code: `${prefix}-QUO-001`, category: "backend", reportable: true, message: "送信上限に達しています。しばらく待ってから再試行してください。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("unavailable")) {
      return { code: `${prefix}-SRV-002`, category: "backend", reportable: true, message: "Firebase に接続できません。時間をおいて再試行してください。", rawCode, rawMessage, area, action };
    }
    if (rawCode.includes("deadline-exceeded") || rawCode.includes("internal")) {
      return { code: `${prefix}-SRV-003`, category: "backend", reportable: true, message: "処理に失敗しました。エラーコードを添えて運営へ報告してください。", rawCode, rawMessage, area, action };
    }

    return {
      code: `${prefix}-UNK-001`,
      category: "backend",
      reportable: true,
      message: "処理に失敗しました。エラーコードを添えて運営へ報告してください。",
      rawCode,
      rawMessage,
      area,
      action,
    };
  }

  function formatUserMessage(error, context = {}) {
    const classified = classifyError(error, context);
    if (classified.category === "policy") {
      return classified.message;
    }
    if (classified.reportable) {
      return `${context.actionLabel || "処理"}に失敗しました。エラーコード ${classified.code}`;
    }
    return classified.message;
  }

  function buildReportPayload(error, context = {}) {
    const classified = classifyError(error, context);
    return {
      source: clean(context.source || "laos", 30),
      area: classified.area,
      action: classified.action,
      errorCode: classified.code,
      errorCategory: classified.category,
      reportable: classified.reportable,
      message: classified.message,
      rawCode: classified.rawCode,
      rawMessage: classified.rawMessage,
      pageUrl: clean(context.pageUrl || window.location.href, 400),
      memberId: clean(context.memberId || "", 24),
      displayName: clean(context.displayName || "", 60),
      email: clean(context.email || "", 120),
      context: context.context || {},
    };
  }

  function getCodeCatalog() {
    return CODE_CATALOG.map((entry) => ({ ...entry }));
  }

  window.LAErrorReporting = {
    classifyError,
    formatUserMessage,
    buildReportPayload,
    getCodeCatalog,
    codeCatalog: getCodeCatalog(),
    resolveCatalogEntry,
    POLICY_MESSAGE,
  };
})();
