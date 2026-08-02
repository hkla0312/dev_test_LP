const functions = require("firebase-functions/v1");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const sharp = require("sharp");
const { classifyComment } = require("./moderation");

admin.initializeApp();

const db = admin.firestore();
const APP_CHECK_ENFORCED = process.env.ENFORCE_APP_CHECK === "true";
const MAIL_TEMPLATE_DOC = "memberMailTemplate";
const DEFAULT_MEMBER_LOGIN_URL = process.env.MEMBER_LOGIN_URL || "https://example.com/LA_OS/login.html";
const DEFAULT_TERMINAL_URL = process.env.TERMINAL_URL || "https://example.com/LA_Terminal/";
const DEFAULT_MEMBER_PAGE_URL = process.env.MEMBER_PAGE_URL || "https://example.com/LA_OS/index.html";

// テスト期間中はLPの端末別日次上限を解除する。IP上限と連続送信間隔は維持する。
const LP_SIGNAL_DAILY_LIMIT = 0;
const LP_SIGNAL_IP_DAILY_LIMIT = 60;
const LP_SIGNAL_COOLDOWN_MS = 20 * 1000;
const MEMBER_SIGNAL_DAILY_LIMIT = 0;

function memberSignalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hashGuestId(guestId) {
  return crypto.createHash("sha256").update(String(guestId)).digest("hex").slice(0, 32);
}

function lpSignalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function requestIpAddress(request) {
  const forwarded = String(request.rawRequest?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(request.rawRequest?.ip || "unknown");
}

function memberIdDocId(value) {
  return String(value || "").replace(/^#/, "") || `member-${Date.now()}`;
}

function createMemberId() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 4 }, () => characters[crypto.randomInt(0, characters.length)]).join("");
}

async function isAdminUid(uid) {
  if (!uid) {
    return false;
  }
  const [singular, plural] = await Promise.all([
    db.collection("admin").doc(uid).get(),
    db.collection("admins").doc(uid).get(),
  ]);
  return singular.exists || plural.exists;
}

function themeColorFromRawPixels(pixels, channels) {
  const buckets = new Map();
  for (let index = 0; index < pixels.length; index += channels * 2) {
    const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2], alpha = channels > 3 ? pixels[index + 3] : 255;
    const max = Math.max(red, green, blue), min = Math.min(red, green, blue), saturation = max ? (max - min) / max : 0;
    if (alpha < 220 || (max > 244 && min > 225) || max < 18) continue;
    const key = [red, green, blue].map(value => Math.min(240, Math.round(value / 24) * 24)).join(",");
    const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
    buckets.set(key, (buckets.get(key) || 0) + 0.45 + saturation * 1.3 + (luminance > 0.15 && luminance < 0.88 ? 0.25 : 0));
  }
  const selected = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
  return selected ? `#${selected[0].split(",").map(value => Number(value).toString(16).padStart(2, "0")).join("")}` : "#e8e8ec";
}

async function extractThemeColorFromUrl(imageUrl) {
  const url = new URL(String(imageUrl || ""));
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new HttpsError("invalid-argument", "Unsupported artist image URL.");
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new HttpsError("failed-precondition", "Artist image could not be loaded.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const decoded = await sharp(buffer, { failOn: "none" }).resize({ width: 84, height: 84, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return themeColorFromRawPixels(decoded.data, decoded.info.channels);
}

async function generateArtistThemeColorsHandler(context) {
  if (!context.auth?.uid || !await isAdminUid(context.auth.uid)) throw new HttpsError("permission-denied", "Admin only.");
  const requestedIds = Array.isArray(context.data?.artistIds) ? context.data.artistIds.map(value => String(value)).filter(Boolean).slice(0, 300) : [];
  const snapshots = requestedIds.length
    ? await Promise.all(requestedIds.map(id => db.collection("artists").doc(id).get()))
    : (await db.collection("artists").get()).docs;
  let updated = 0, failed = 0;
  for (const snapshot of snapshots) {
    if (!snapshot?.exists) continue;
    const artist = snapshot.data() || {};
    const imageUrl = String(artist.imageUrl || artist.thumbnailUrl || "").trim();
    if (!imageUrl) continue;
    try {
      const imageThemeColor = await extractThemeColorFromUrl(imageUrl);
      await snapshot.ref.update({ imageThemeColor, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      updated += 1;
    } catch (error) {
      failed += 1;
      console.warn("Artist theme color generation failed", snapshot.id, error?.message || error);
    }
  }
  return { ok: true, updated, failed };
}

function normalizeMailText(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function renderMailTemplate(template = {}, data = {}) {
  const values = {
    displayName: String(data.displayName || data.name || "LA_OS"),
    memberId: String(data.memberId || ""),
    email: String(data.email || ""),
    password: String(data.password || ""),
    loginUrl: String(data.loginUrl || DEFAULT_MEMBER_LOGIN_URL),
    terminalUrl: String(data.terminalUrl || DEFAULT_TERMINAL_URL),
    memberPageUrl: String(data.memberPageUrl || DEFAULT_MEMBER_PAGE_URL),
    supportUrl: String(data.supportUrl || ""),
  };
  const replacer = (source = "") => String(source).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  ));

  const subject = replacer(template.subject || "");
  const body = replacer(template.body || "");
  const text = normalizeMailText(body || template.text || "");
  const html = (template.html || body || text).replace(/\n/g, "<br>");
  return {
    subject: subject || "LA_OS",
    text: text || subject || "LA_OS",
    html: html || `<p>${subject || "LA_OS"}</p>`,
  };
}

function mailTransportConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true") !== "false";
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const from = String(process.env.MAIL_FROM || user || "").trim();
  if (!host || !user || !pass || !from) {
    return null;
  }
  return { host, port, secure, user, pass, from };
}

let cachedTransporter = null;
function getMailTransporter() {
  const config = mailTransportConfig();
  if (!config) {
    return null;
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }
  return { transporter: cachedTransporter, from: config.from };
}

async function recordMailOutbox(payload) {
  await db.collection("mailOutbox").add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function dispatchMail(payload) {
  const transport = getMailTransporter();
  if (!transport) {
    await recordMailOutbox({
      ...payload,
      status: "queued",
      provider: "queue",
      note: "SMTP settings are not configured.",
    });
    return { queued: true, sent: false };
  }

  const info = await transport.transporter.sendMail({
    from: `LA_OS <${transport.from}>`,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  await recordMailOutbox({
    ...payload,
    status: "sent",
    provider: "smtp",
    messageId: info.messageId || "",
  });

  return { queued: false, sent: true, messageId: info.messageId || "" };
}

async function loadMailTemplate() {
  const snapshot = await db.collection("settings").doc(MAIL_TEMPLATE_DOC).get();
  return snapshot.exists ? snapshot.data() : {};
}

async function sendMemberEmail(payload) {
  const template = payload.template || {};
  const rendered = renderMailTemplate(template, payload);
  return dispatchMail({
    to: String(payload.to || "").trim(),
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    source: String(payload.source || "admin"),
    templateId: String(payload.templateId || "custom"),
    memberUid: String(payload.memberUid || ""),
    memberId: String(payload.memberId || ""),
    displayName: String(payload.displayName || ""),
    email: String(payload.email || ""),
  });
}

async function createMemberProfile(user) {
  if (!user?.uid) {
    return;
  }

  const memberRef = db.collection("members").doc(user.uid);
  const displayName = String(user.displayName || "LA_OS").trim() || "LA_OS";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const memberId = createMemberId();
    const idRef = db.collection("memberIds").doc(memberIdDocId(memberId));
    try {
      const member = await db.runTransaction(async (transaction) => {
        const [existingMember, existingId] = await Promise.all([transaction.get(memberRef), transaction.get(idRef)]);
        if (existingMember.exists) return existingMember.data();
        if (existingId.exists) throw new Error("member-id-collision");
        const now = admin.firestore.FieldValue.serverTimestamp();
        const profile = {
          uid: user.uid,
          memberId,
          displayName,
          email: user.email || "",
          emailVerified: Boolean(user.emailVerified),
          progress: 0,
          licenseType: "NONE",
          accountStatus: "active",
          environment: "prod",
          totalPaidYen: 0,
          energyBalance: 0,
          financeLocked: true,
          lastLoginAt: now,
          registeredAt: now,
          createdAt: now,
          updatedAt: now,
        };
        transaction.set(memberRef, profile);
        transaction.set(idRef, { uid: user.uid, memberId, displayName, createdAt: now });
        return profile;
      });
      return member;
    } catch (error) {
      if (error?.message !== "member-id-collision") throw error;
    }
  }
  throw new HttpsError("aborted", "Could not allocate a member ID.");
}

async function loadMemberProfile(uid) {
  if (!uid) {
    return null;
  }

  const snapshot = await db.collection("members").doc(uid).get();
  return snapshot.exists ? snapshot.data() : null;
}

function signalTypeLabel(signalType) {
  switch (signalType) {
    case "song":
      return "歌が良い";
    case "stage":
      return "ステージが良い";
    case "character":
      return "キャラが良い";
    default:
      return String(signalType || "");
  }
}

function summarizeSignalComment(comment, signalType) {
  const raw = String(comment || "").normalize("NFKC").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  const cleaned = raw.replace(/[「」『』“”"'`]/g, "").replace(/[。！？!?]+$/g, "");
  if (!cleaned) {
    return signalTypeLabel(signalType) || "SIGNAL";
  }
  return cleaned.length > 18 ? `${cleaned.slice(0, 18)}…` : cleaned;
}

function moderationFailure(result, fallbackMessage = "送信できませんでした。") {
  const reason = result?.reasons?.[0] || "blocked_term";
  const messageMap = {
    empty: "内容を入力してください。",
    length: "文字数を超えています。",
    url: "URLは送れません。",
    email: "メールアドレスは送れません。",
    phone: "電話番号は送れません。",
    excessive_repeat: "同じ文字や記号が多すぎます。",
    blocked_term: "不適切な表現が含まれています。",
    duplicate: "同じ内容は続けて送れません。",
    rapid_post: "少し時間をおいてください。",
  };

  return new HttpsError("invalid-argument", messageMap[reason] || fallbackMessage, {
    reason,
    reasons: result?.reasons || [],
  });
}

function eventCloseAt(event) {
  if (event.danmakuCloseAt?.toDate) return event.danmakuCloseAt.toDate();
  const date = String(event.eventDate || "").replace(/\./g, "-");
  return new Date(`${date}T22:00:00+09:00`);
}

async function currentDanmakuEvent(now = new Date()) {
  const [snapshot, settingSnapshot] = await Promise.all([
    db.collection("events").where("status", "==", "active").where("environment", "==", "prod").get(),
    db.collection("settings").doc("danmakuView").get(),
  ]);
  const configuredEventKey = settingSnapshot.data()?.activeEventKey || "";
  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((event) => event.danmakuEnabled !== false)
    .map((event) => ({ ...event, closeAt: eventCloseAt(event) }))
    .filter((event) => !Number.isNaN(event.closeAt.getTime()) && now <= event.closeAt)
    .sort((left, right) => left.closeAt - right.closeAt);

  return candidates.find((event) => (event.eventKey || event.id) === configuredEventKey) || candidates[0] || null;
}

async function moderationSettings() {
  const snapshot = await db.collection("settings").doc("danmakuModeration").get();
  return snapshot.exists ? snapshot.data() : {};
}

exports.getDanmakuEntryStatus = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async () => {
  const event = await currentDanmakuEvent();
  if (!event) return { enabled: false };
  return {
    enabled: true,
    eventKey: event.eventKey || event.id,
    title: event.title || event.eventKey || event.id,
    closeAt: event.closeAt.toISOString(),
  };
});

exports.createMemberProfileOnAuthCreate = functions.auth.user().onCreate(async (user) => {
  await createMemberProfile(user);
  return null;
});

exports.sendRegistrationReceipt = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const member = await loadMemberProfile(request.auth.uid);
  const authEmail = String(request.auth.token?.email || member?.email || "").trim().toLowerCase();
  const email = String(request.data?.email || member?.email || authEmail || "").trim().toLowerCase();
  if (!email || (authEmail && email !== authEmail)) {
    throw new HttpsError("permission-denied", "Only the signed-in member can request this receipt.");
  }

  const templateDoc = await loadMailTemplate();
  const template = {
    subject: templateDoc.registrationSubject || "[LA_OS] 登録完了のお知らせ",
    body: templateDoc.registrationBody || [
      "{{displayName}} 様",
      "",
      "LA_OSへの登録が完了しました。",
      "",
      "登録情報",
      "メールアドレス: {{email}}",
      "パスワード: {{password}}",
      "",
      "メンバーページ: {{memberPageUrl}}",
      "LA_Terminal: {{terminalUrl}}",
      "ログイン: {{loginUrl}}",
      "",
      "メンバーページから登録情報を変更できます。",
    ].join("\n"),
  };
  const rendered = renderMailTemplate(template, {
    displayName: String(request.data?.displayName || member?.displayName || request.auth.token?.name || "LA_OS"),
    memberId: String(request.data?.memberId || member?.memberId || ""),
    email,
    password: String(request.data?.password || ""),
    memberPageUrl: String(request.data?.memberPageUrl || DEFAULT_MEMBER_PAGE_URL),
    terminalUrl: String(request.data?.terminalUrl || DEFAULT_TERMINAL_URL),
    loginUrl: String(request.data?.loginUrl || DEFAULT_MEMBER_LOGIN_URL),
  });

  return sendMemberEmail({
    to: email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    source: "registration",
    templateId: "registrationComplete",
    memberUid: request.auth.uid,
    memberId: String(request.data?.memberId || member?.memberId || ""),
    displayName: String(request.data?.displayName || member?.displayName || ""),
    email,
    template,
  });
});

exports.bootstrapMemberProfile = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const uid = request.auth.uid;
  const memberRef = db.collection("members").doc(uid);
  const existingSnapshot = await memberRef.get();
  if (existingSnapshot.exists) {
    return { ok: true, member: existingSnapshot.data() };
  }

  const member = await createMemberProfile({
    uid,
    email: String(request.auth.token?.email || request.data?.email || "").trim().toLowerCase(),
    displayName: String(request.auth.token?.name || request.data?.displayName || "").trim(),
    emailVerified: Boolean(request.auth.token?.email_verified),
  });

  const latestSnapshot = await memberRef.get();
  return {
    ok: true,
    member: latestSnapshot.exists ? latestSnapshot.data() : member || null,
  };
});

exports.registerMemberAccount = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  const displayName = String(request.data?.displayName || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();
  const password = String(request.data?.password || "");

  if (!displayName) {
    throw new HttpsError("invalid-argument", "Display name is required.");
  }
  if (!email) {
    throw new HttpsError("invalid-argument", "Email is required.");
  }
  if (password.length < 5 || !/^[A-Za-z0-9]+$/.test(password) || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    throw new HttpsError("invalid-argument", "Password does not meet requirements.");
  }

  const existingUser = await admin.auth().getUserByEmail(email).catch((error) => {
    if (error?.code === "auth/user-not-found") {
      return null;
    }
    throw error;
  });

  if (existingUser) {
    throw new HttpsError("already-exists", "Email already in use.");
  }

  const userRecord = await admin.auth().createUser({
    email,
    password,
    displayName,
    emailVerified: false,
    disabled: false,
  });

  try {
    await createMemberProfile({
      uid: userRecord.uid,
      email,
      displayName,
      emailVerified: false,
    });
  } catch (error) {
    await admin.auth().deleteUser(userRecord.uid).catch(() => {});
    throw error;
  }

  const memberSnapshot = await db.collection("members").doc(userRecord.uid).get();
  const member = memberSnapshot.exists ? memberSnapshot.data() : null;
  let customToken = null;
  try {
    customToken = await admin.auth().createCustomToken(userRecord.uid, {
      source: "laos",
      flow: "register",
    });
  } catch (error) {
    console.warn("custom token creation skipped", error);
  }

  return {
    ok: true,
    uid: userRecord.uid,
    customToken,
    member,
  };
});

exports.sendMemberEmail = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  if (!request.auth?.uid || !await isAdminUid(request.auth.uid)) {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const memberUid = String(request.data?.memberUid || "").trim();
  const member = memberUid ? await loadMemberProfile(memberUid) : null;
  const to = String(request.data?.to || member?.email || "").trim();
  if (!to) {
    throw new HttpsError("invalid-argument", "Recipient email is required.");
  }

  const templateDoc = await loadMailTemplate();
  const templateType = String(request.data?.templateType || "custom");
  const template = templateType === "registrationComplete"
    ? {
        subject: templateDoc.registrationSubject || "[LA_OS] 登録完了のお知らせ",
        body: templateDoc.registrationBody || "",
      }
    : {
        subject: String(request.data?.subject || templateDoc.adminSubject || "[LA_OS] お知らせ"),
        body: String(request.data?.body || templateDoc.adminBody || ""),
      };

  return sendMemberEmail({
    to,
    subject: template.subject,
    text: template.body,
    html: template.body,
    source: "admin",
    templateId: templateType,
    memberUid,
    memberId: String(request.data?.memberId || member?.memberId || ""),
    displayName: String(request.data?.displayName || member?.displayName || ""),
    email: String(request.data?.email || member?.email || ""),
    template,
  });
});

exports.updateMemberProfile = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }

  const uid = request.auth.uid;
  const memberRef = db.collection("members").doc(uid);
  const memberSnapshot = await memberRef.get();
  if (!memberSnapshot.exists) {
    throw new HttpsError("not-found", "Member profile not found.");
  }

  const displayName = String(request.data?.displayName || "").trim();
  const xId = String(request.data?.xId || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();
  const password = String(request.data?.password || "");

  const authUpdate = {};
  if (displayName) authUpdate.displayName = displayName;
  if (email) authUpdate.email = email;
  if (password) authUpdate.password = password;

  if (Object.keys(authUpdate).length) {
    await admin.auth().updateUser(uid, authUpdate);
  }

  const patch = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (displayName) patch.displayName = displayName;
  if (xId) patch.xId = xId;
  if (email) patch.email = email;

  await memberRef.update(patch);
  const member = memberSnapshot.data() || {};
  if (member.memberId) {
    await db.collection("memberIds").doc(memberIdDocId(member.memberId)).set({
      uid,
      memberId: member.memberId,
      displayName: displayName || member.displayName || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await db.collection("adminLogs").add({
    actionType: "MEMBER_UPDATE",
    targetType: "member",
    targetId: uid,
    targetLabel: displayName || member.displayName || uid,
    detail: "member profile updated",
    adminUid: uid,
    adminDisplayName: displayName || member.displayName || "MEMBER",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    email: email || member.email || "",
    displayName: displayName || member.displayName || "",
    xId: xId || member.xId || "",
  };
});

exports.reportBackendError = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  const source = String(request.data?.source || "laos").trim().slice(0, 30);
  const area = String(request.data?.area || "system").trim().slice(0, 60);
  const action = String(request.data?.action || "処理").trim().slice(0, 60);
  const errorCode = String(request.data?.errorCode || "LAOS-UNK-001").trim().slice(0, 40);
  const errorCategory = String(request.data?.errorCategory || "backend").trim().slice(0, 30);
  const message = String(request.data?.message || "処理に失敗しました。").trim().slice(0, 240);
  const rawCode = String(request.data?.rawCode || "").trim().slice(0, 80);
  const rawMessage = String(request.data?.rawMessage || "").trim().slice(0, 500);
  const pageUrl = String(request.data?.pageUrl || "").trim().slice(0, 400);
  const context = request.data?.context && typeof request.data.context === "object" ? request.data.context : {};
  const member = request.auth?.uid ? await loadMemberProfile(request.auth.uid) : null;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = db.collection("errorReports").doc();
  const record = {
    source,
    area,
    action,
    errorCode,
    errorCategory,
    message,
    rawCode,
    rawMessage,
    pageUrl,
    memberUid: request.auth?.uid || "",
    memberId: String(request.data?.memberId || member?.memberId || "").trim().slice(0, 24),
    displayName: String(request.data?.displayName || member?.displayName || request.auth?.token?.name || "").trim().slice(0, 60),
    email: String(request.data?.email || member?.email || request.auth?.token?.email || "").trim().slice(0, 120),
    status: "new",
    context,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(record);
  await db.collection("adminLogs").add({
    actionType: "ERROR_REPORT_CREATE",
    targetType: "errorReport",
    targetId: ref.id,
    targetLabel: `${source}/${errorCode}`,
    detail: `${area} / ${action}`,
    adminUid: request.auth?.uid || "system",
    adminDisplayName: member?.displayName || request.auth?.token?.name || "SYSTEM",
    createdAt: now,
  });

  return { ok: true, reportId: ref.id };
});

async function submitMemberSignalHandler(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");

  const artistId = String(request.data?.artistId || "").trim();
  const signalType = String(request.data?.signalType || "").trim();
  const comment = String(request.data?.comment || "").trim().slice(0, 15);
  if (!artistId || !["song", "stage", "character"].includes(signalType) || !comment) {
    throw new HttpsError("invalid-argument", "Invalid signal.");
  }

  const settings = await moderationSettings();
  const signalModeration = classifyComment(comment, {
    maxLength: 15,
    blockedTerms: settings.blockedTerms || [],
  });
  if (signalModeration.status === "blocked") {
    throw moderationFailure(signalModeration, "SIGNALの内容を確認してください。");
  }

  const [member, artist] = await Promise.all([
    loadMemberProfile(request.auth.uid),
    db.collection("artists").doc(artistId).get(),
  ]);
  if (!artist.exists) throw new HttpsError("not-found", "Artist not found.");
  const memberProfile = member || {
    memberId: request.auth.token?.email || request.auth.uid,
    displayName: request.auth.token?.name || request.auth.token?.email || "LA_OS",
    environment: "prod",
  };

  const artistData = artist.data() || {};
  const dateKey = memberSignalDateKey();
  const usageRef = db.collection("memberSignalUsage").doc(`${dateKey}_${request.auth.uid}`);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const record = {
    artistId,
    artistKey: artistData.artistKey || artist.id,
    artistName: artistData.name || artistData.artistKey || artist.id,
    artistThumbnailUrl: artistData.thumbnailUrl || artistData.imageUrl || "",
    memberUid: request.auth.uid,
    memberId: memberProfile.memberId || "",
    memberDisplayName: memberProfile.displayName || request.auth.token?.name || "LA_OS",
    signalType,
    signalLabel: signalTypeLabel(signalType),
    comment,
    commentSummary: summarizeSignalComment(comment, signalType),
    normalizedComment: signalModeration.normalized,
    moderationStatus: signalModeration.status,
    moderationReasons: signalModeration.reasons,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    environment: memberProfile.environment || "prod",
    createdAt: now,
    updatedAt: now,
  };

  let remaining = 0;
  const ref = await db.runTransaction(async (transaction) => {
    const usageSnapshot = await transaction.get(usageRef);
    const usage = usageSnapshot.exists ? usageSnapshot.data() || {} : {};
    const used = Number(usage.count || 0);
    if (MEMBER_SIGNAL_DAILY_LIMIT > 0 && used >= MEMBER_SIGNAL_DAILY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Daily SIGNAL limit reached.");
    }

    const signalRef = db.collection("artistSignals").doc();
    transaction.set(signalRef, record);
    transaction.set(usageRef, {
      dateKey,
      count: used + 1,
      lastSubmittedAt: now,
      updatedAt: now,
    }, { merge: true });
    remaining = MEMBER_SIGNAL_DAILY_LIMIT > 0
      ? Math.max(0, MEMBER_SIGNAL_DAILY_LIMIT - (used + 1))
      : null;
    return signalRef;
  });

  return {
    ok: true,
    signalId: ref.id,
    artistId,
    artistName: record.artistName,
    artistThumbnailUrl: record.artistThumbnailUrl,
    signalType,
    signalLabel: record.signalLabel,
    comment,
    commentSummary: record.commentSummary,
    remaining,
  };
}

// LP公開向けSIGNAL。会員情報やコメントを持たず、サーバー側で送信回数を制御する。
async function submitLpSignalHandler(request) {
  const artistId = String(request.data?.artistId || "").trim();
  const signalType = String(request.data?.signalType || "").trim();
  const guestId = String(request.data?.guestId || "").trim();
  if (!artistId || !["song", "stage", "character"].includes(signalType) || !/^[A-Za-z0-9_-]{16,100}$/.test(guestId)) {
    throw new HttpsError("invalid-argument", "Invalid LP signal.");
  }

  const artistSnapshot = await db.collection("artists").doc(artistId).get();
  if (!artistSnapshot.exists || artistSnapshot.data()?.environment !== "prod" || artistSnapshot.data()?.lpVisible !== true) {
    throw new HttpsError("not-found", "Artist not found.");
  }

  const dateKey = lpSignalDateKey();
  const guestHash = hashGuestId(guestId);
  const ipHash = hashGuestId(requestIpAddress(request));
  const guestUsageRef = db.collection("lpSignalUsage").doc(`${dateKey}_${guestHash}`);
  const ipUsageRef = db.collection("lpSignalIpUsage").doc(`${dateKey}_${ipHash}`);
  const signalRef = db.collection("artistSignals").doc();
  const nowMs = Date.now();
  const artist = artistSnapshot.data() || {};
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async transaction => {
    const [guestUsage, ipUsage] = await Promise.all([transaction.get(guestUsageRef), transaction.get(ipUsageRef)]);
    const guest = guestUsage.exists ? guestUsage.data() || {} : {};
    const ip = ipUsage.exists ? ipUsage.data() || {} : {};
    const guestCount = Number(guest.count || 0);
    const ipCount = Number(ip.count || 0);
    if (LP_SIGNAL_DAILY_LIMIT > 0 && guestCount >= LP_SIGNAL_DAILY_LIMIT) {
      throw new HttpsError("resource-exhausted", "本日のSIGNAL送信上限に達しています。");
    }
    if (ipCount >= LP_SIGNAL_IP_DAILY_LIMIT) {
      throw new HttpsError("resource-exhausted", "このネットワークからの送信上限に達しています。時間をおいてお試しください。");
    }
    if (nowMs - Number(guest.lastSubmittedAtMs || 0) < LP_SIGNAL_COOLDOWN_MS) {
      throw new HttpsError("resource-exhausted", "連続送信を制限しています。少し時間をおいてお試しください。");
    }

    transaction.set(guestUsageRef, { dateKey, count: guestCount + 1, lastSubmittedAtMs: nowMs, updatedAt: now }, { merge: true });
    transaction.set(ipUsageRef, { dateKey, count: ipCount + 1, updatedAt: now }, { merge: true });
    transaction.set(signalRef, {
      artistId,
      artistKey: artist.artistKey || artistId,
      artistName: artist.name || artist.artistKey || artistId,
      artistThumbnailUrl: artist.thumbnailUrl || artist.imageUrl || "",
      memberUid: null,
      memberId: "LP-GUEST",
      memberDisplayName: "LP GUEST",
      signalType,
      signalLabel: signalTypeLabel(signalType),
      comment: "",
      commentSummary: "",
      normalizedComment: "",
      moderationStatus: "safe",
      moderationReasons: [],
      source: "lp_public",
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      environment: "prod",
      createdAt: now,
      updatedAt: now,
    });
  });

  return { ok: true, artistId, signalType, remaining: LP_SIGNAL_DAILY_LIMIT > 0 ? Math.max(0, LP_SIGNAL_DAILY_LIMIT - (Number((await guestUsageRef.get()).data()?.count || 0))) : null };
}

function sendCallableError(response, error) {
  const codeMap = {
    unauthenticated: [401, "UNAUTHENTICATED"],
    "invalid-argument": [400, "INVALID_ARGUMENT"],
    "not-found": [404, "NOT_FOUND"],
    "failed-precondition": [400, "FAILED_PRECONDITION"],
    "resource-exhausted": [429, "RESOURCE_EXHAUSTED"],
  };
  const [status, callableStatus] = codeMap[error?.code] || [500, "INTERNAL"];
  response.status(status).json({
    error: {
      status: callableStatus,
      message: error?.message || "SIGNAL could not be sent.",
    },
  });
}

async function authenticatedCallableRequest(request) {
  const authorization = String(request.get("authorization") || "");
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpsError("unauthenticated", "Login required.");
  const decoded = await admin.auth().verifyIdToken(token);
  return { data: request.body?.data || {}, auth: { uid: decoded.uid, token: decoded }, rawRequest: request };
}

// LA_OSの会員SIGNAL。Firebase Callable互換の公開HTTP入口で、IDトークンを検証する。
// Admin既存アーティスト画像のテーマカラー生成。Storage CORSの制約を受けずに処理する。
exports.generateArtistThemeColors = onRequest({ invoker: "public", cors: true }, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: { status: "INVALID_ARGUMENT", message: "POST only." } });
    return;
  }
  try {
    const result = await generateArtistThemeColorsHandler(await authenticatedCallableRequest(request));
    response.status(200).json({ data: result });
  } catch (error) {
    sendCallableError(response, error);
  }
});

exports.submitSignal = onRequest({ invoker: "public", cors: true }, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: { status: "INVALID_ARGUMENT", message: "POST only." } });
    return;
  }
  try {
    const result = await submitMemberSignalHandler(await authenticatedCallableRequest(request));
    response.status(200).json({ data: result });
  } catch (error) {
    sendCallableError(response, error);
  }
});

// LPはログイン不要の公開導線。Firebase Callable互換のJSON形式を返す。
exports.submitLpSignal = onRequest({ invoker: "public", cors: true }, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: { status: "INVALID_ARGUMENT", message: "POST only." } });
    return;
  }

  try {
    const result = await submitLpSignalHandler({
      data: request.body?.data || {},
      rawRequest: request,
    });
    response.status(200).json({ data: result });
  } catch (error) {
    sendCallableError(response, error);
  }
});

exports.submitDanmaku = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  const comment = String(request.data?.comment || "").trim().slice(0, 30);
  const emote = String(request.data?.emote || "").trim().slice(0, 20);
  const senderMode = String(request.data?.senderMode || "id").trim() === "displayName" ? "displayName" : "id";
  const guestId = String(request.data?.guestId || "").trim();
  const guestName = String(request.data?.displayName || "").trim().slice(0, 12);

  const event = await currentDanmakuEvent();
  if (!event) throw new HttpsError("failed-precondition", "No active DANMAKU event.");
  if (!comment || !emote) throw new HttpsError("invalid-argument", "Invalid submission.");

  const eventKey = event.eventKey || event.id;
  const authUser = request.auth?.uid ? await loadMemberProfile(request.auth.uid) : null;
  const senderMemberId = authUser?.memberId || "";
  const senderDisplayName = authUser?.displayName || guestName || "LA_OS";
  const senderLabel = senderMode === "displayName" ? senderDisplayName : (senderMemberId || guestId || senderDisplayName);
  const participantKey = request.auth?.uid || guestId;
  if (!participantKey) throw new HttpsError("unauthenticated", "Login required.");

  const usageRef = db.collection("danmakuGuestUsage").doc(`${eventKey}_${participantKey}`);
  const submissionRef = db.collection("danmakuSubmissions").doc();
  const settings = await moderationSettings();
  let remaining = 0;

  await db.runTransaction(async (transaction) => {
    const usageSnapshot = await transaction.get(usageRef);
    const usage = usageSnapshot.exists ? usageSnapshot.data() : { count: 0 };
    if (Number(usage.count || 0) >= 5) {
      throw new HttpsError("resource-exhausted", "Submission limit reached.");
    }

    const now = admin.firestore.Timestamp.now();
    const lastAt = usage.lastSubmittedAt?.toMillis ? usage.lastSubmittedAt.toMillis() : 0;
    const commentModeration = classifyComment(comment, {
      maxLength: 30,
      blockedTerms: settings.blockedTerms || [],
      sameText: Boolean(usage.lastNormalizedComment && usage.lastNormalizedComment === classifyComment(comment).normalized),
      rapidPost: lastAt > 0 && now.toMillis() - lastAt < 15_000,
    });

    if (commentModeration.status === "blocked") {
      throw moderationFailure(commentModeration, "DANMAKUの内容を確認してください。");
    }

    transaction.set(submissionRef, {
      eventKey,
      eventTitle: event.title || eventKey,
      memberUid: request.auth?.uid || "",
      memberId: senderMemberId,
      memberDisplayName: senderDisplayName,
      senderMode,
      senderLabel,
      emote,
      comment,
      normalizedComment: commentModeration.normalized,
      moderationStatus: commentModeration.status,
      moderationReasons: commentModeration.reasons,
      displayStatus: "approved",
      createdAt: now,
      reviewedAt: now,
      reviewedBy: "system",
    });
    transaction.set(usageRef, {
      count: admin.firestore.FieldValue.increment(1),
      lastNormalizedComment: commentModeration.normalized,
      lastSubmittedAt: now,
      eventKey,
      updatedAt: now,
    }, { merge: true });
    remaining = 4 - Number(usage.count || 0);
  });

  return { accepted: true, moderationStatus: "approved", eventKey, title: event.title || eventKey, remaining };
});

exports.moderateDanmaku = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Admin authentication required.");
  const [adminsSnapshot, adminSnapshot] = await Promise.all([
    db.collection("admins").doc(request.auth.uid).get(),
    db.collection("admin").doc(request.auth.uid).get(),
  ]);
  if (!adminsSnapshot.exists && !adminSnapshot.exists) throw new HttpsError("permission-denied", "Admin role required.");

  const submissionId = String(request.data?.submissionId || "");
  const action = request.data?.action;
  if (!submissionId || !["approve", "reject"].includes(action)) throw new HttpsError("invalid-argument", "Invalid moderation action.");

  await db.collection("danmakuSubmissions").doc(submissionId).update({
    displayStatus: action === "approve" ? "approved" : "rejected",
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: request.auth.uid,
  });
  return { ok: true };
});
