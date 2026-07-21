const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/iu;
const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu;
const PHONE_PATTERN = /(?:\+?\d[\d\s()-]{8,}\d)/u;
const EXCESSIVE_REPEAT_PATTERN = /(.)\1{5,}/u;
const EXCESSIVE_SYMBOL_PATTERN = /[^\p{L}\p{N}\s]{6,}/u;
const DEFAULT_BLOCKED_TERMS = ["死ね", "殺す", "ころす", "kill yourself"];
const REVIEW_TERMS = ["消えろ", "きもい", "fuck", "shit"];

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

function classifyComment(comment, options = {}) {
  const raw = String(comment || "").trim();
  const normalized = normalizeComment(raw);
  const blockedTerms = [...DEFAULT_BLOCKED_TERMS, ...(options.blockedTerms || [])].map(normalizeComment).filter(Boolean);
  const reasons = [];

  if (!raw || raw.length > 30) reasons.push("length");
  if (URL_PATTERN.test(raw)) reasons.push("url");
  if (EMAIL_PATTERN.test(raw)) reasons.push("email");
  if (PHONE_PATTERN.test(raw)) reasons.push("phone");
  if (EXCESSIVE_REPEAT_PATTERN.test(raw) || EXCESSIVE_SYMBOL_PATTERN.test(raw)) reasons.push("excessive_repeat");
  if (blockedTerms.some(term => normalized.includes(term))) return { status: "blocked", reasons: [...reasons, "blocked_term"], normalized };
  if (REVIEW_TERMS.some(term => normalized.includes(normalizeComment(term)))) reasons.push("abusive_language");
  if (options.sameText) reasons.push("duplicate");
  if (options.rapidPost) reasons.push("rapid_post");
  return { status: reasons.length ? "review" : "safe", reasons, normalized };
}

module.exports = { normalizeComment, classifyComment };
