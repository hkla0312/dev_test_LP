const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { classifyComment } = require("./moderation");

admin.initializeApp();

const db = admin.firestore();
const APP_CHECK_ENFORCED = process.env.ENFORCE_APP_CHECK === "true";
const LP_SIGNAL_DAILY_LIMIT = 3;
const LP_SIGNAL_IP_DAILY_LIMIT = 60;
const LP_SIGNAL_COOLDOWN_MS = 20 * 1000;

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

async function allocateMemberId() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `#${String(crypto.randomInt(100000, 1000000))}`;
    const snapshot = await db.collection("memberIds").doc(memberIdDocId(candidate)).get();
    if (!snapshot.exists) {
      return candidate;
    }
  }

  return `#${String(crypto.randomInt(100000, 1000000))}`;
}

async function createMemberProfile(user) {
  if (!user?.uid) {
    return;
  }

  const memberRef = db.collection("members").doc(user.uid);
  const memberSnapshot = await memberRef.get();
  if (memberSnapshot.exists) {
    return;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const memberId = await allocateMemberId();
  const displayName = String(user.displayName || "LA_OS").trim() || "LA_OS";
  const member = {
    uid: user.uid,
    memberId,
    displayName,
    email: user.email || "",
    emailVerified: Boolean(user.emailVerified),
    progress: 38,
    currentProgress: 38,
    requiredProgress: 100,
    version: "v0.01",
    versionUpPending: true,
    archiveAccess: true,
    levelValue: 1,
    levelLabel: "v0.01",
    accountStatus: "active",
    environment: "prod",
    lastLoginAt: now,
    registeredAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await memberRef.set(member, { merge: true });
  await db.collection("memberIds").doc(memberIdDocId(memberId)).set({
    uid: user.uid,
    memberId,
    displayName,
    createdAt: now,
  }, { merge: true });
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
    case "other":
      return "そのほか";
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

exports.submitSignal = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");

  const artistId = String(request.data?.artistId || "").trim();
  const signalType = String(request.data?.signalType || "").trim();
  const comment = String(request.data?.comment || "").trim().slice(0, 15);
  if (!artistId || !["song", "stage", "character", "other"].includes(signalType) || !comment) {
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
  if (!member) throw new HttpsError("failed-precondition", "Member profile not found.");
  if (!artist.exists) throw new HttpsError("not-found", "Artist not found.");

  const artistData = artist.data() || {};
  const now = admin.firestore.FieldValue.serverTimestamp();
  const record = {
    artistId,
    artistKey: artistData.artistKey || artist.id,
    artistName: artistData.name || artistData.artistKey || artist.id,
    artistThumbnailUrl: artistData.thumbnailUrl || artistData.imageUrl || "",
    memberUid: request.auth.uid,
    memberId: member.memberId || "",
    memberDisplayName: member.displayName || request.auth.token?.name || "LA_OS",
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
    environment: member.environment || "prod",
    createdAt: now,
    updatedAt: now,
  };

  const ref = await db.collection("artistSignals").add(record);
  return { ok: true, signalId: ref.id, artistId, artistName: record.artistName, signalType, comment };
});

// LP公開向けSIGNAL。会員情報やコメントを持たず、サーバー側で送信回数を制御する。
exports.submitLpSignal = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async (request) => {
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
    if (guestCount >= LP_SIGNAL_DAILY_LIMIT) {
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

  return { ok: true, artistId, signalType, remaining: Math.max(0, LP_SIGNAL_DAILY_LIMIT - (Number((await guestUsageRef.get()).data()?.count || 0))) };
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
