/*
 * LP DANMAKU initial moderation template.
 * Japanese source: whym/Japanese bad words list (CC0 1.0)
 * English source: @dsojevic/profanity-list (MIT)
 * This is an intentionally conservative starter subset for the 25-character LP demo.
 */
(() => {
  const BLOCKED_TERMS = [
    "死ね", "しね", "シネ", "殺す", "ころす", "消えろ", "きもい", "キモイ", "あほ", "アホ", "ばか", "バカ",
    "やりまん", "ヤリマン", "まんこ", "マンコ", "チョン", "支那", "うざい", "うぜー",
    "kill yourself", "kys", "fuck", "shit", "bitch", "asshole", "bastard", "bullshit", "cunt", "dick", "pussy", "whore",
    "nigger", "faggot", "retard", "rape", "rapist", "nazi", "white power", "xvideos", "xnxx", "porn", "xxx"
  ];

  const normalize = value => String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000\p{P}\p{S}_]/gu, "")
    .trim();
  const normalizedTerms = [...new Set(BLOCKED_TERMS.map(normalize).filter(Boolean))];

  window.LPDanmakuModeration = {
    isBlocked(value) {
      const comment = normalize(value);
      return Boolean(comment) && normalizedTerms.some(term => comment.includes(term));
    }
  };
})();
