// Cloud Functions のデプロイ対象に含まれるテンプレートを参照する。
const LICENSE_FREE_TEMPLATE_TERMS = require("./danmaku-blocked-template");

const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/iu;
const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu;
const PHONE_PATTERN = /(?:\+?\d[\d\s()-]{8,}\d)/u;
const EXCESSIVE_REPEAT_PATTERN = /(.)\1{5,}/u;
const EXCESSIVE_SYMBOL_PATTERN = /[^\p{L}\p{N}\s]{6,}/u;

function normalizeComment(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\r\n\t]/g, " ")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[\p{P}\p{S}_]/gu, "")
    .replace(/(.)\1{2,}/gu, "$1$1")
    .trim();
}

function buildBlockedTerms(extraTerms = []) {
  return [...LICENSE_FREE_TEMPLATE_TERMS, ...(extraTerms || [])]
    .map(normalizeComment)
    .filter(Boolean);
}

function classifyComment(comment, options = {}) {
  const raw = String(comment || "").trim();
  const normalized = normalizeComment(raw);
  const blockedTerms = buildBlockedTerms(options.blockedTerms);
  const maxLength = Number.isFinite(options.maxLength) ? options.maxLength : 30;
  const reasons = [];

  if (!raw) reasons.push("empty");
  if (raw.length > maxLength) reasons.push("length");
  if (URL_PATTERN.test(raw)) reasons.push("url");
  if (EMAIL_PATTERN.test(raw)) reasons.push("email");
  if (PHONE_PATTERN.test(raw)) reasons.push("phone");
  if (EXCESSIVE_REPEAT_PATTERN.test(raw) || EXCESSIVE_SYMBOL_PATTERN.test(raw)) reasons.push("excessive_repeat");
  if (blockedTerms.some((term) => normalized.includes(term))) reasons.push("blocked_term");
  if (options.sameText) reasons.push("duplicate");
  if (options.rapidPost) reasons.push("rapid_post");

  return {
    status: reasons.length ? "blocked" : "safe",
    reasons,
    normalized,
  };
}

function moderationMessage(result) {
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

  return messageMap[reason] || "送信できませんでした。";
}

module.exports = { normalizeComment, classifyComment, moderationMessage };
