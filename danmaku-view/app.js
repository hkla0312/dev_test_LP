const sampleStarts = [
  "\u6700\u9ad8\u3067\u3059", "FIRE", "\u3042\u308a\u304c\u3068\u3046", "\u3053\u306e\u77ac\u9593\u3092\u5fd8\u308c\u306a\u3044", "\u3082\u3063\u3068\u4e0a\u3078",
  "\u4e00\u4f53\u611f\u304c\u3059\u3054\u3044", "\u5fc3\u304c\u9707\u3048\u308b", "\u307e\u3060\u7d42\u308f\u3089\u306a\u3044", "\u4f1a\u5834\u304c\u71b1\u3044", "LEGENDARY",
  "\u3053\u306e\u30d3\u30fc\u30c8\u5927\u597d\u304d", "\u3082\u3063\u3068\u8074\u304d\u305f\u3044", "\u5c4a\u3051", "\u6700\u9ad8\u306e\u591c", "\u4f1a\u5834\u304c\u3072\u3068\u3064\u306b\u306a\u3063\u305f",
  "\u97f3\u304c\u8eab\u4f53\u306b\u97ff\u304f", "\u4eca\u65e5\u3053\u3053\u306b\u6765\u3066\u3088\u304b\u3063\u305f", "\u30b9\u30c6\u30fc\u30b8\u304c\u7729\u3057\u3044", "\u305a\u3063\u3068\u3064\u3044\u3066\u3044\u304f", "\u3082\u3046\u4e00\u56de\u8074\u304d\u305f\u3044"
];

const samples = Array.from({ length: 100 }, (_, index) => {
  const id = String(index + 1).padStart(4, "0");
  const first = sampleStarts[Math.floor(Math.random() * sampleStarts.length)];
  const second = Math.random() > 0.45 ? ` ${sampleStarts[Math.floor(Math.random() * sampleStarts.length)]}` : "";
  return `#${id}: ${(first + second).slice(0, 30)}`;
});

const flow = { initialCount: 10, interval: 800, duration: 14, amplitude: 0.68, lanes: 5, laneGap: 260, laneSafety: 1.35 };
const layer = document.querySelector("#comment-layer");
const canvas = document.querySelector("#signal-canvas");
const context = canvas.getContext("2d");
const signalPopup = document.querySelector("#signal-popup");
const popupComment = document.querySelector("#popup-comment");
const loading = document.querySelector("#danmaku-loading");
let spawnTimer;
let signalTick = 0;
let shuffledSamples = [];
let popupTimer;
let pickupTimer;
const receivedComments = [];
const activeCommentBodies = new Set();
const laneReadyAt = Array(flow.lanes).fill(0);

function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }
function commentBody(message) { return String(message).replace(/^#[^:]+:\s*/, ""); }

function nextComment() {
  if (!shuffledSamples.length) shuffledSamples = [...samples].sort(() => Math.random() - 0.5);
  return shuffledSamples.pop();
}

function reserveLane(message, fontSize) {
  const now = Date.now();
  const available = laneReadyAt
    .map((readyAt, lane) => ({ readyAt, lane }))
    .filter(({ readyAt }) => readyAt <= now);
  if (!available.length) return null;

  const lane = randomItem(available).lane;
  const estimatedWidth = message.length * fontSize * .82 * flow.laneSafety;
  const pixelsPerSecond = (window.innerWidth * 2.35) / flow.duration;
  const spacing = ((estimatedWidth + flow.laneGap) / pixelsPerSecond) * 1000;
  laneReadyAt[lane] = now + spacing;
  return lane;
}

function spawnComment(forcedText = "") {
  const text = forcedText || nextComment();
  const body = commentBody(text);
  if (activeCommentBodies.has(body)) return false;
  const fontSize = 26 + Math.random() * 14;
  const lane = reserveLane(text, fontSize);
  if (lane === null) {
    if (!forcedText) shuffledSamples.push(text);
    return false;
  }
  const comment = document.createElement("span");
  comment.className = `comment ${randomItem(["cyan", "magenta", "white", "lime", "amber"])}`;
  comment.textContent = text;
  comment.style.top = `${10 + lane * 19}%`;
  comment.style.fontSize = `${fontSize}px`;
  comment.style.setProperty("--duration", `${flow.duration}s`);
  comment.style.setProperty("--delay", "0s");
  activeCommentBodies.add(body);
  comment.addEventListener("animationend", () => {
    activeCommentBodies.delete(body);
    comment.remove();
  });
  layer.append(comment);
  return true;
}

window.injectDanmaku = text => {
  const message = String(text || "").slice(0, 30);
  if (!message) return false;
  receivedComments.push(message);
  if (receivedComments.length > 100) receivedComments.shift();
  return spawnComment(message);
};
window.setDanmakuLoading = visible => loading?.classList.toggle("is-hidden", !visible);
window.setDanmakuLiveMode = () => {
  window.clearInterval(spawnTimer);
  layer.replaceChildren();
  laneReadyAt.fill(0);
  activeCommentBodies.clear();
};

function startComments() {
  window.clearInterval(spawnTimer);
  layer.replaceChildren();
  shuffledSamples = [];
  laneReadyAt.fill(0);
  for (let index = 0; index < flow.initialCount; index += 1) window.setTimeout(spawnComment, index * 280);
  spawnTimer = window.setInterval(spawnComment, flow.interval);
}

function showPickedSignal() {
  if (!receivedComments.length) return;
  popupComment.textContent = randomItem(receivedComments);
  signalPopup.classList.add("is-visible");
  signalPopup.setAttribute("aria-hidden", "false");
  window.clearTimeout(popupTimer);
  popupTimer = window.setTimeout(() => {
    signalPopup.classList.remove("is-visible");
    signalPopup.setAttribute("aria-hidden", "true");
  }, 3800);
}

function drawSignal() {
  const ratio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.floor(bounds.width * ratio);
  canvas.height = Math.floor(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const { width, height } = bounds;
  const center = height / 2;
  context.clearRect(0, 0, width, height);
  context.lineWidth = 1.5;
  for (let x = 0; x < width; x += 5) {
    const pulse = Math.abs(Math.sin(x * .035 + signalTick) + .55 * Math.sin(x * .11 - signalTick * 1.7));
    const variance = .25 + Math.abs(Math.sin(x * .22 + signalTick * 2.3)) * .75;
    const size = 2 + pulse * variance * flow.amplitude * (height * .41);
    context.strokeStyle = Math.sin(x * .017 + signalTick) > .58 ? "#ff4edb" : "#38f5ff";
    context.globalAlpha = .5 + pulse * .5;
    context.beginPath();
    context.moveTo(x, center - size);
    context.lineTo(x, center + size);
    context.stroke();
  }
  context.globalAlpha = 1;
  signalTick += .075;
  requestAnimationFrame(drawSignal);
}

window.addEventListener("resize", () => { canvas.width = 0; });
window.setDanmakuLoading(true);
pickupTimer = window.setInterval(showPickedSignal, 9000);
drawSignal();
