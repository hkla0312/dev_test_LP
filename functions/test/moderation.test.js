const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyComment, normalizeComment, moderationMessage } = require("../moderation");

test("normal comment is safe", () => {
  assert.equal(classifyComment("最高のライブです").status, "safe");
});

test("blocked term is blocked after normalization", () => {
  const result = classifyComment("死　ね");
  assert.equal(result.status, "blocked");
  assert.equal(result.reasons.includes("blocked_term"), true);
});

test("URL, email, phone and repeated symbols are blocked", () => {
  ["https://example.com", "a@example.com", "090-1234-5678", "!!!!!!!!"].forEach((comment) => {
    assert.equal(classifyComment(comment).status, "blocked");
  });
});

test("duplicate and rapid posts are blocked", () => {
  const result = classifyComment("同じです", { sameText: true, rapidPost: true });
  assert.equal(result.status, "blocked");
  assert.equal(result.reasons.includes("duplicate"), true);
  assert.equal(result.reasons.includes("rapid_post"), true);
});

test("over 30 characters is blocked", () => {
  assert.equal(classifyComment("あ".repeat(31)).status, "blocked");
});

test("normalization removes spaces and symbols", () => {
  assert.equal(normalizeComment("ＳＡ　ＭＰＬＥ!!"), "sample");
});

test("moderation message follows the first blocked reason", () => {
  const result = classifyComment("https://example.com");
  assert.equal(moderationMessage(result), "URLは送れません。");
});
