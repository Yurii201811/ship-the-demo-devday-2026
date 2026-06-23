const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const timerEl = document.querySelector("#timer");
const scoreEl = document.querySelector("#score");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart");
const muteButton = document.querySelector("#mute");
const checklistEls = [...document.querySelectorAll(".checklist span")];

const bg = new Image();
bg.src = "./assets/devday-lab-bg.png";
const sprites = new Image();
sprites.src = "./assets/sprites.png";

const W = canvas.width;
const H = canvas.height;
const RUN_SECONDS = 150;
const spriteCols = 4;
const spriteRows = 2;

const spriteMap = {
  player: [0, 0],
  context: [1, 0],
  tests: [2, 0],
  image: [3, 0],
  link: [0, 1],
  hazard: [1, 1],
  launch: [2, 1],
  spark: [3, 1],
};

const pickups = [
  { key: "context", label: "Context", x: 330, y: 250, value: 260, color: "#9aff76" },
  { key: "tests", label: "Tests", x: 725, y: 360, value: 300, color: "#39e7ff" },
  { key: "image", label: "Image Assets", x: 382, y: 530, value: 340, color: "#ffd84f" },
  { key: "link", label: "Playable Link", x: 918, y: 538, value: 420, color: "#5e95ff" },
];

const hazards = [
  { x: 500, y: 274, r: 46, phase: 0.2 },
  { x: 612, y: 461, r: 48, phase: 1.1 },
  { x: 790, y: 525, r: 45, phase: 2.4 },
  { x: 994, y: 398, r: 48, phase: 3.1 },
  { x: 266, y: 438, r: 44, phase: 4.2 },
];

let state;
let keys = new Set();
let pointer = null;
let lastTime = 0;
let muted = false;
let audioCtx = null;

function resetState() {
  state = {
    mode: "ready",
    elapsed: 0,
    score: 0,
    player: { x: 515, y: 615, vx: 0, vy: 0, r: 26 },
    collected: Object.fromEntries(pickups.map((item) => [item.key, false])),
    particles: [],
    message: "Collect every artifact, then hit the gate.",
    gatePulse: 0,
    hitCooldown: 0,
  };
  lastTime = 0;
  syncHud();
  showOverlay("Ready to ship?", "Grab all four artifacts, dodge scope creep, then reach the DevDay gate.", "Start run");
}

function showOverlay(title, copy, button) {
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  startButton.textContent = button;
  overlay.classList.remove("is-hidden");
}

function hideOverlay() {
  overlay.classList.add("is-hidden");
}

function startRun() {
  if (state.mode === "won" || state.mode === "lost") resetState();
  state.mode = "playing";
  hideOverlay();
  ping(520, 0.05);
}

function syncHud() {
  const remaining = Math.max(0, Math.ceil(RUN_SECONDS - state.elapsed));
  const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs = String(remaining % 60).padStart(2, "0");
  timerEl.textContent = `${mins}:${secs}`;
  scoreEl.textContent = String(Math.max(0, Math.round(state.score))).padStart(4, "0");
  checklistEls.forEach((el) => el.classList.toggle("is-done", Boolean(state.collected[el.dataset.item])));
}

function drawSprite(name, x, y, size, alpha = 1, rotation = 0) {
  if (!sprites.complete || !sprites.naturalWidth) return;
  const [cx, cy] = spriteMap[name];
  const sw = sprites.naturalWidth / spriteCols;
  const sh = sprites.naturalHeight / spriteRows;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(sprites, cx * sw, cy * sh, sw, sh, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawBackground() {
  if (bg.complete && bg.naturalWidth) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#050706";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  ctx.fillRect(0, 0, W, H);
}

function drawPath() {
  const points = [
    [515, 615],
    [382, 530],
    [330, 250],
    [725, 360],
    [918, 538],
    [1066, 188],
  ];
  ctx.save();
  ctx.setLineDash([2, 18]);
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(57, 231, 255, 0.72)";
  ctx.shadowColor = "#39e7ff";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawLabel(text, x, y, color) {
  ctx.save();
  ctx.font = "800 18px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawGame() {
  drawBackground();
  drawPath();

  const t = state.elapsed;
  pickups.forEach((item) => {
    if (state.collected[item.key]) return;
    const bob = Math.sin(t * 3 + item.x) * 5;
    drawSprite(item.key, item.x, item.y + bob, 104, 1);
    drawLabel(item.label, item.x, item.y + 77 + bob, item.color);
  });

  hazards.forEach((hazard) => {
    const pulse = 1 + Math.sin(t * 4 + hazard.phase) * 0.04;
    drawSprite("hazard", hazard.x, hazard.y, 116 * pulse, 0.96);
  });

  const launchReady = Object.values(state.collected).every(Boolean);
  drawSprite("launch", 1068, 188, launchReady ? 150 + Math.sin(t * 6) * 8 : 128, launchReady ? 1 : 0.5);
  if (launchReady) drawLabel("Launch", 1068, 290, "#9aff76");

  state.particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const p = state.player;
  const angle = Math.atan2(p.vy || -1, p.vx || 1) + Math.PI / 4;
  drawSprite("player", p.x, p.y, 86, state.hitCooldown > 0 ? 0.62 : 1, angle);

  ctx.save();
  ctx.font = "760 18px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(242, 247, 241, 0.92)";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 12;
  ctx.fillText(state.message, 30, H - 28);
  ctx.restore();
}

function spawnBurst(x, y, color, amount = 18) {
  for (let i = 0; i < amount; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 150;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      size: 2 + Math.random() * 4,
      color,
    });
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function update(dt) {
  if (state.mode !== "playing") return;
  state.elapsed += dt;
  state.hitCooldown = Math.max(0, state.hitCooldown - dt);

  const p = state.player;
  let ax = 0;
  let ay = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) ax -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) ax += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) ay -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) ay += 1;
  if (pointer) {
    const dx = pointer.x - p.x;
    const dy = pointer.y - p.y;
    const mag = Math.hypot(dx, dy);
    if (mag > 8) {
      ax += dx / mag;
      ay += dy / mag;
    }
  }

  const mag = Math.hypot(ax, ay) || 1;
  const speed = 440;
  p.vx = (ax / mag) * speed;
  p.vy = (ay / mag) * speed;
  if (!ax && !ay) {
    p.vx *= 0.8;
    p.vy *= 0.8;
  }
  p.x = Math.max(54, Math.min(W - 54, p.x + p.vx * dt));
  p.y = Math.max(74, Math.min(H - 54, p.y + p.vy * dt));

  pickups.forEach((item) => {
    if (state.collected[item.key]) return;
    if (distance(p, item) < 62) {
      state.collected[item.key] = true;
      state.score += item.value;
      state.message = `${item.label} secured.`;
      spawnBurst(item.x, item.y, item.color, 24);
      ping(740, 0.07);
    }
  });

  hazards.forEach((hazard) => {
    if (state.hitCooldown <= 0 && distance(p, hazard) < hazard.r + p.r) {
      state.score = Math.max(0, state.score - 180);
      state.hitCooldown = 0.85;
      state.message = "Scope creep clipped the run. Keep moving.";
      spawnBurst(p.x, p.y, "#ff675e", 12);
      ping(180, 0.08);
    }
  });

  if (Object.values(state.collected).every(Boolean) && Math.hypot(p.x - 1068, p.y - 188) < 78) {
    state.mode = "won";
    const timeBonus = Math.max(0, Math.round((RUN_SECONDS - state.elapsed) * 8));
    state.score += timeBonus + 1000;
    state.message = "Demo launched.";
    spawnBurst(1068, 188, "#9aff76", 48);
    ping(960, 0.12);
    showOverlay("Demo shipped", `Score ${String(Math.round(state.score)).padStart(4, "0")}. Built with context, tests, generated art, and a playable link.`, "Run it again");
  }

  if (state.elapsed >= RUN_SECONDS) {
    state.mode = "lost";
    state.message = "Time boxed too hard. Try one more sprint.";
    showOverlay("Sprint expired", "The best demos ship after one more tight loop.", "Restart");
  }

  state.particles = state.particles
    .map((part) => ({
      ...part,
      x: part.x + part.vx * dt,
      y: part.y + part.vy * dt,
      vx: part.vx * 0.95,
      vy: part.vy * 0.95,
      life: part.life - dt * 1.7,
    }))
    .filter((part) => part.life > 0);
  syncHud();
}

function frame(now) {
  const dt = Math.min(0.033, lastTime ? (now - lastTime) / 1000 : 0);
  lastTime = now;
  update(dt);
  drawGame();
  requestAnimationFrame(frame);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

function ping(freq, duration) {
  if (muted) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.02);
  } catch {
    muted = true;
  }
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === "Space" && state.mode !== "playing") startRun();
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));

canvas.addEventListener("pointerdown", (event) => {
  pointer = canvasPoint(event);
  canvas.setPointerCapture(event.pointerId);
  if (state.mode !== "playing") startRun();
});

canvas.addEventListener("pointermove", (event) => {
  if (event.buttons) pointer = canvasPoint(event);
});

canvas.addEventListener("pointerup", () => {
  pointer = null;
});

startButton.addEventListener("click", startRun);
restartButton.addEventListener("click", resetState);
muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "Sound off" : "Sound on";
});

Promise.all([
  bg.decode().catch(() => {}),
  sprites.decode().catch(() => {}),
]).then(() => {
  resetState();
  requestAnimationFrame(frame);
});
