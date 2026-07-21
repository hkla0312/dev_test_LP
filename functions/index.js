const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { classifyComment } = require("./moderation");

admin.initializeApp();
const db = admin.firestore();
const APP_CHECK_ENFORCED = process.env.ENFORCE_APP_CHECK === "true";
// LP demo: moderation is opt-in. Enable it later with
// settings/danmakuModeration { enabled: true } when operations begin.
const DEFAULT_MODERATION_ENABLED = false;

function hashGuestId(guestId) {
  return crypto.createHash("sha256").update(String(guestId)).digest("hex").slice(0, 32);
}

function eventCloseAt(event) {
  if (event.danmakuCloseAt?.toDate) return event.danmakuCloseAt.toDate();
  const date = String(event.eventDate || "").replace(/\./g, "-");
  return new Date(`${date}T22:00:00+09:00`);
}

async function currentDanmakuEvent(now = new Date()) {
  const [snapshot, settingSnapshot] = await Promise.all([
    db.collection("events").where("status", "==", "active").where("environment", "==", "prod").get(),
    db.collection("settings").doc("danmakuView").get()
  ]);
  const configuredEventKey = settingSnapshot.data()?.activeEventKey || "";
  const candidates = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(event => event.danmakuEnabled !== false)
    .map(event => ({ ...event, closeAt: eventCloseAt(event) }))
    .filter(event => !Number.isNaN(event.closeAt.getTime()) && now <= event.closeAt)
    .sort((left, right) => left.closeAt - right.closeAt);
  // The Admin-selected event has priority while it is valid.  Once its 22:00
  // deadline has passed, transparently move to the next prepared event.
  return candidates.find(event => (event.eventKey || event.id) === configuredEventKey) || candidates[0] || null;
}

async function moderationSettings() {
  const snapshot = await db.collection("settings").doc("danmakuModeration").get();
  return snapshot.exists ? snapshot.data() : {};
}

exports.getDanmakuEntryStatus = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async () => {
  const event = await currentDanmakuEvent();
  if (!event) return { enabled: false };
  return { enabled: true, eventKey: event.eventKey || event.id, title: event.title || event.eventKey || event.id, closeAt: event.closeAt.toISOString() };
});

exports.submitDanmaku = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async request => {
  const comment = String(request.data?.comment || "").trim();
  const displayName = String(request.data?.displayName || "").trim().slice(0, 12);
  const guestId = String(request.data?.guestId || "");
  if (!guestId || !displayName || !comment) throw new HttpsError("invalid-argument", "Invalid submission.");

  const event = await currentDanmakuEvent();
  if (!event) throw new HttpsError("failed-precondition", "No active DANMAKU event.");
  const eventKey = event.eventKey || event.id;
  const guestHash = hashGuestId(guestId);
  const usageRef = db.collection("danmakuGuestUsage").doc(`${eventKey}_${guestHash}`);
  const submissionRef = db.collection("danmakuSubmissions").doc();
  const settings = await moderationSettings();
  let result;
  let remaining = 0;

  await db.runTransaction(async transaction => {
    const usageSnapshot = await transaction.get(usageRef);
    const usage = usageSnapshot.exists ? usageSnapshot.data() : { count: 0 };
    if (Number(usage.count || 0) >= 10) throw new HttpsError("resource-exhausted", "Submission limit reached.");
    const now = admin.firestore.Timestamp.now();
    const lastAt = usage.lastSubmittedAt?.toMillis ? usage.lastSubmittedAt.toMillis() : 0;
    const normalized = classifyComment(comment).normalized;
    result = settings.enabled === true || DEFAULT_MODERATION_ENABLED
      ? classifyComment(comment, {
        blockedTerms: settings.blockedTerms || [],
        sameText: Boolean(usage.lastNormalizedComment && usage.lastNormalizedComment === normalized),
        rapidPost: lastAt > 0 && now.toMillis() - lastAt < 15_000
      })
      : { status: "safe", reasons: [], normalized };
    if (result.status === "blocked") return;
    const displayStatus = result.status === "safe" ? "approved" : "pending";
    transaction.set(submissionRef, {
      eventKey,
      eventTitle: event.title || eventKey,
      guestHash,
      displayName,
      comment,
      normalizedComment: result.normalized,
      moderationStatus: result.status,
      moderationReasons: result.reasons,
      displayStatus,
      createdAt: now,
      reviewedAt: result.status === "safe" ? now : null,
      reviewedBy: result.status === "safe" ? "system" : null
    });
    transaction.set(usageRef, { count: admin.firestore.FieldValue.increment(1), lastNormalizedComment: result.normalized, lastSubmittedAt: now, eventKey, updatedAt: now }, { merge: true });
    remaining = 9 - Number(usage.count || 0);
  });

  if (result.status === "blocked") return { accepted: false, moderationStatus: "blocked" };
  return { accepted: true, moderationStatus: result.status, eventKey, title: event.title || eventKey, remaining };
});

exports.moderateDanmaku = onCall({ enforceAppCheck: APP_CHECK_ENFORCED }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Admin authentication required.");
  const [adminsSnapshot, adminSnapshot] = await Promise.all([
    db.collection("admins").doc(request.auth.uid).get(),
    db.collection("admin").doc(request.auth.uid).get()
  ]);
  if (!adminsSnapshot.exists && !adminSnapshot.exists) throw new HttpsError("permission-denied", "Admin role required.");
  const submissionId = String(request.data?.submissionId || "");
  const action = request.data?.action;
  if (!submissionId || !["approve", "reject"].includes(action)) throw new HttpsError("invalid-argument", "Invalid moderation action.");
  await db.collection("danmakuSubmissions").doc(submissionId).update({
    displayStatus: action === "approve" ? "approved" : "rejected",
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: request.auth.uid
  });
  return { ok: true };
});
