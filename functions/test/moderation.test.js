const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyComment, normalizeComment } = require("../moderation");

test("normal comment is safe", () => assert.equal(classifyComment("\u6700\u9ad8\u306e\u30e9\u30a4\u30d6\u3067\u3059").status, "safe"));
test("blocked term is blocked after normalization", () => assert.equal(classifyComment("\u6b7b\u3000\u306d").status, "blocked"));
test("URL, email, phone and repeated symbols require review", () => {
  ["https://example.com", "a@example.com", "090-1234-5678", "!!!!!!!!"].forEach(comment => assert.equal(classifyComment(comment).status, "review"));
});
test("duplicate and rapid posts require review", () => assert.equal(classifyComment("\u540c\u3058\u3067\u3059", { sameText: true, rapidPost: true }).status, "review"));
test("over 30 characters requires review", () => assert.equal(classifyComment("\u3042".repeat(31)).status, "review"));
test("normalization removes spaces and symbols", () => assert.equal(normalizeComment("\uff33\uff21\u3000\uff2d\uff30\uff2c\uff25!!"), "sample"));
