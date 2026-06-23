const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const timerEl = document.querySelector("#timer");
const scoreEl = document.querySelector("#score");
const focusEl = document.querySelector("#focus");
const heatFillEl = document.querySelector("#heat-fill");
const missionTitleEl = document.querySelector("#mission-title");
const missionCopyEl = document.querySelector("#mission-copy");
const liveStatusEl = document.querySelector("#live-status");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart");
const muteButton = document.querySelector("#mute");
const dashButton = document.querySelector("#dash");
const checklistEls = [...document.querySelectorAll(".checklist span")];

const bg = new Image();
bg.src = "./assets/devday-lab-bg.png";
const sprites = new Image();
sprites.src = "./assets/sprites.png";

const BASE = { w: 1280, h: 720 };
const RUN_SECONDS = 90;
const spriteCols = 4;
const spriteRows = 2;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

const missions = [
  {
    key: "context",
    label: "Context",
    title: "Context first",
    copy: "Find the real problem before the sprint gets loud.",
    story: "Context locked. The model finally has the brief.",
    x: 0.24,
    y: 0.36,
    value: 360,
    color: "#9aff76",
  },
  {
    key: "tests",
    label: "Tests",
    title: "Make it trustworthy",
    copy: "Bring the checks online while the room pressure rises.",
    story: "Tests green. One crash shield armed.",
    x: 0.58,
    y: 0.52,
    value: 430,
    color: "#39e7ff",
  },
  {
    key: "image",
    label: "Image Assets",
    title: "Give it a soul",
    copy: "Grab Image Gen art so the demo looks alive, not procedural.",
    story: "Image Gen assets landed. Style boost online.",
    x: 0.32,
    y: 0.74,
    value: 520,
    color: "#ffd84f",
  },
  {
    key: "link",
    label: "Playable Link",
    title: "Make it real",
    copy: "Ship the public link before scope creep swallows the sprint.",
    story: "Playable link live. The gate is open.",
    x: 0.73,
    y: 0.74,
    value: 660,
    color: "#5e95ff",
  },
];

const gate = {
  x: 0.84,
  y: 0.27,
};

const hazardDefs = [
  { x: 0.39, y: 0.38, ax: 0.09, ay: 0.035, speed: 1.0, phase: 0.1 },
  { x: 0.52, y: 0.66, ax: 0.11, ay: 0.06, speed: 1.18, phase: 1.7 },
  { x: 0.68, y: 0.48, ax: 0.08, ay: 0.12, speed: 1.32, phase: 2.6 },
  { x: 0.82, y: 0.56, ax: 0.07, ay: 0.05, speed: 1.55, phase: 3.8 },
  { x: 0.20, y: 0.61, ax: 0.08, ay: 0.08, speed: 1.42, phase: 4.7 },
];

const insightDefs = [
  { x: 0.17, y: 0.72, phase: 0.5 },
  { x: 0.47, y: 0.29, phase: 1.9 },
  { x: 0.61, y: 0.31, phase: 2.8 },
  { x: 0.88, y: 0.70, phase: 3.4 },
  { x: 0.43, y: 0.84, phase: 4.1 },
  { x: 0.76, y: 0.38, phase: 5.2 },
];

let world = { w: BASE.w, h: BASE.h, scale: 1, unit: BASE.h, dpr: 1 };
let state;
let keys = new Set();
let pointer = null;
let activePointerId = null;
let lastTime = 0;
let muted = false;
let audioCtx = null;

function scheduleFrame(callback) {
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(callback);
    return;
  }
  window.setTimeout(() => callback(Date.now()), 16);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function pct(def) {
  return {
    x: def.x * world.w,
    y: def.y * world.h,
  };
}

function responsiveSize(base, min, max) {
  return clamp(base * Math.min(world.w / BASE.w, world.h / BASE.h) + world.unit * 0.035, min, max);
}

function playerRadius() {
  return clamp(world.unit * 0.052, 18, 31);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const previous = { ...world };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.round(rect.width * dpr);
  const nextHeight = Math.round(rect.height * dpr);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  world = {
    w: rect.width,
    h: rect.height,
    dpr,
    scale: Math.min(rect.width / BASE.w, rect.height / BASE.h),
    unit: Math.min(rect.width, rect.height),
  };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (state && previous.w && previous.h) {
    state.player.x = clamp((state.player.x / previous.w) * world.w, playerRadius(), world.w - playerRadius());
    state.player.y = clamp((state.player.y / previous.h) * world.h, playerRadius(), world.h - playerRadius());
    state.player.r = playerRadius();
  }
}

function resetState() {
  resizeCanvas();
  const start = pct({ x: 0.39, y: 0.84 });
  state = {
    mode: "ready",
    elapsed: 0,
    score: 0,
    focus: 100,
    heat: 0,
    combo: 1,
    streak: 0,
    nextIndex: 0,
    collected: Object.fromEntries(missions.map((item) => [item.key, false])),
    player: { x: start.x, y: start.y, vx: 0, vy: 0, r: playerRadius() },
    particles: [],
    floaters: [],
    ripples: [],
    insights: insightDefs.map((item) => ({ ...item, collected: false })),
    message: "The room is quiet. Make the demo undeniable.",
    dashCooldown: 0,
    dashTime: 0,
    shield: 0,
    hitCooldown: 0,
    shake: 0,
    flash: 0,
    gatePulse: 0,
  };
  lastTime = 0;
  syncHud();
  announce("Ready. Collect the four build pieces before the sprint overheats.");
  showOverlay(
    "Make the room believe.",
    "You have 90 seconds to collect context, tests, art, and a playable link before scope creep drains the sprint.",
    "Start 90-sec sprint",
  );
}

function announce(message) {
  liveStatusEl.textContent = message;
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
  if (!state) resetState();
  if (state.mode === "won" || state.mode === "lost") resetState();
  state.mode = "playing";
  syncHud();
  hideOverlay();
  ping(560, 0.05);
}

function currentMission() {
  return missions[state.nextIndex] || null;
}

function syncHud() {
  const remaining = Math.max(0, Math.ceil(RUN_SECONDS - state.elapsed));
  const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs = String(remaining % 60).padStart(2, "0");
  timerEl.textContent = `${mins}:${secs}`;
  scoreEl.textContent = String(Math.max(0, Math.round(state.score))).padStart(4, "0");
  focusEl.textContent = `${Math.round(state.focus)}%`;
  heatFillEl.style.width = `${Math.round(state.heat)}%`;

  const mission = currentMission();
  missionTitleEl.textContent = mission ? mission.title : "Gate is live";
  missionCopyEl.textContent = mission ? mission.copy : "Everything is ready. Launch it before the sprint overheats.";

  checklistEls.forEach((el) => {
    const itemIndex = missions.findIndex((item) => item.key === el.dataset.item);
    el.classList.toggle("is-done", Boolean(state.collected[el.dataset.item]));
    el.classList.toggle("is-current", itemIndex === state.nextIndex);
  });

  if (state.dashCooldown > 0) {
    dashButton.disabled = true;
    dashButton.textContent = `${state.dashCooldown.toFixed(1)}s`;
  } else {
    dashButton.disabled = false;
    dashButton.textContent = state.shield > 0 ? "Shield" : "Dash";
  }
}

function drawImageCover(image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) * 0.5;
  const sy = (image.naturalHeight - sh) * 0.5;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
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
    drawImageCover(bg, 0, 0, world.w, world.h);
  } else {
    ctx.fillStyle = "#050706";
    ctx.fillRect(0, 0, world.w, world.h);
  }

  const heatAlpha = state ? state.heat / 100 : 0;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.12 + heatAlpha * 0.1})`;
  ctx.fillRect(0, 0, world.w, world.h);

  const vignette = ctx.createRadialGradient(
    world.w * 0.54,
    world.h * 0.56,
    world.unit * 0.1,
    world.w * 0.54,
    world.h * 0.56,
    world.unit * 0.82,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.36)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, world.w, world.h);

  if (state?.flash > 0) {
    ctx.fillStyle = `rgba(255, 103, 94, ${state.flash * 0.18})`;
    ctx.fillRect(0, 0, world.w, world.h);
  }
}

function drawRoute() {
  const points = [
    pct({ x: 0.39, y: 0.84 }),
    ...missions.map(pct),
    pct(gate),
  ];

  ctx.save();
  ctx.setLineDash([2, responsiveSize(22, 10, 20)]);
  ctx.lineCap = "round";
  ctx.lineWidth = responsiveSize(5, 3, 5);
  ctx.strokeStyle = "rgba(57, 231, 255, 0.35)";
  ctx.shadowColor = "#39e7ff";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  const active = clamp(state.nextIndex + 1, 1, points.length - 1);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(154, 255, 118, 0.82)";
  ctx.shadowColor = "#9aff76";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  points.slice(0, active + 1).forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawLabel(text, x, y, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${clamp(world.unit * 0.035, 13, 18)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawTargetRing(x, y, radius, color, t) {
  ctx.save();
  ctx.lineWidth = responsiveSize(4, 2, 4);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, radius + Math.sin(t * 5) * 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.24;
  ctx.beginPath();
  ctx.arc(x, y, radius + 18 + Math.sin(t * 3) * 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function hazardPosition(hazard) {
  const difficulty = 1 + (state.elapsed / RUN_SECONDS) * 0.45 + state.nextIndex * 0.08;
  return {
    x: (hazard.x + Math.sin(state.elapsed * hazard.speed * difficulty + hazard.phase) * hazard.ax) * world.w,
    y: (hazard.y + Math.cos(state.elapsed * hazard.speed * 0.86 * difficulty + hazard.phase) * hazard.ay) * world.h,
    r: clamp(world.unit * 0.068, 22, 42),
  };
}

function drawDeadlineHeat() {
  const heat = state.heat / 100;
  if (heat <= 0.02) return;

  ctx.save();
  const width = lerp(world.w * 0.06, world.w * 0.32, heat);
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, `rgba(255, 103, 94, ${0.18 + heat * 0.14})`);
  gradient.addColorStop(1, "rgba(255, 103, 94, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, world.h);
  ctx.restore();
}

function drawGame() {
  if (!state) return;

  ctx.save();
  if (state.shake > 0 && !reduceMotion) {
    const amount = state.shake * 10;
    ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
  }

  drawBackground();
  drawDeadlineHeat();
  drawRoute();

  const t = state.elapsed;
  const pickupSize = responsiveSize(112, 64, 118);
  missions.forEach((item, index) => {
    const point = pct(item);
    const isCollected = state.collected[item.key];
    const isCurrent = index === state.nextIndex;
    const isLocked = index > state.nextIndex;
    const bob = reduceMotion ? 0 : Math.sin(t * 3 + index) * responsiveSize(6, 2, 5);
    const alpha = isCollected ? 0.18 : isLocked ? 0.36 : 1;

    if (!isCollected) {
      if (isCurrent) drawTargetRing(point.x, point.y + bob, pickupSize * 0.5, item.color, t);
      drawSprite(item.key, point.x, point.y + bob, pickupSize, alpha);
      drawLabel(item.label, point.x, point.y + pickupSize * 0.72 + bob, isCurrent ? item.color : "rgba(242,247,241,0.58)", alpha);
    } else {
      drawSprite("spark", point.x, point.y + bob, pickupSize * 0.44, 0.55);
    }
  });

  state.insights.forEach((item, index) => {
    if (item.collected) return;
    const point = pct(item);
    const bob = reduceMotion ? 0 : Math.sin(t * 3.2 + item.phase) * responsiveSize(7, 2, 6);
    const size = responsiveSize(54, 34, 62);
    drawSprite("spark", point.x, point.y + bob, size, 0.82, Math.sin(t + index) * 0.2);
  });

  hazardDefs.forEach((hazard) => {
    const point = hazardPosition(hazard);
    const pulse = reduceMotion ? 1 : 1 + Math.sin(t * 5 + hazard.phase) * 0.045;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#ff675e";
    ctx.lineWidth = responsiveSize(3, 1.5, 3);
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.r * 1.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawSprite("hazard", point.x, point.y, point.r * 2.22 * pulse, 0.96);
  });

  const gatePoint = pct(gate);
  const launchReady = state.nextIndex >= missions.length;
  const gateSize = responsiveSize(150, 80, 156);
  drawSprite("launch", gatePoint.x, gatePoint.y, launchReady ? gateSize + Math.sin(t * 6) * 8 : gateSize * 0.82, launchReady ? 1 : 0.44);
  drawLabel(launchReady ? "Launch" : "Gate locked", gatePoint.x, gatePoint.y + gateSize * 0.64, launchReady ? "#9aff76" : "rgba(242,247,241,0.5)", launchReady ? 1 : 0.7);
  if (launchReady) drawTargetRing(gatePoint.x, gatePoint.y, gateSize * 0.45, "#9aff76", t);

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

  state.floaters.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.font = `800 ${clamp(world.unit * 0.034, 13, 19)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  });

  const p = state.player;
  const playerSize = responsiveSize(90, 58, 96);
  const angle = Math.atan2(p.vy || -1, p.vx || 1) + Math.PI / 4;
  if (state.shield > 0) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = "#ffd84f";
    ctx.shadowColor = "#ffd84f";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, playerSize * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawSprite("player", p.x, p.y, playerSize, state.hitCooldown > 0 ? 0.62 : 1, angle);

  ctx.save();
  ctx.font = `760 ${clamp(world.unit * 0.032, 13, 18)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(242, 247, 241, 0.94)";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 12;
  ctx.fillText(state.message, responsiveSize(30, 14, 30), world.h - responsiveSize(30, 18, 30));
  ctx.restore();

  ctx.restore();
}

function spawnBurst(x, y, color, amount = 18) {
  for (let i = 0; i < amount; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = responsiveSize(150, 90, 170) + Math.random() * responsiveSize(130, 70, 150);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      size: clamp(world.unit * 0.006, 2, 5) + Math.random() * 2,
      color,
    });
  }
}

function addFloater(text, x, y, color = "#f2f7f1") {
  state.floaters.push({ text, x, y, vy: responsiveSize(42, 25, 52), life: 1, color });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dash() {
  if (!state || state.mode !== "playing" || state.dashCooldown > 0) return;
  state.dashTime = 0.24;
  state.dashCooldown = 1.4;
  state.shield = 0.34;
  state.message = "A clean dash buys one brave second.";
  spawnBurst(state.player.x, state.player.y, "#ffd84f", 14);
  ping(860, 0.04);
  syncHud();
}

function updateMovement(dt) {
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
    if (mag > playerRadius() * 0.55) {
      ax += dx / mag;
      ay += dy / mag;
    } else if (!pointer.active) {
      pointer = null;
    }
  }

  const mag = Math.hypot(ax, ay);
  const speed = responsiveSize(560, 300, 620) * (state.dashTime > 0 ? 2.15 : 1);

  if (mag > 0) {
    p.vx = (ax / mag) * speed;
    p.vy = (ay / mag) * speed;
  } else {
    p.vx *= 0.82;
    p.vy *= 0.82;
  }

  p.x = clamp(p.x + p.vx * dt, p.r, world.w - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, world.h - p.r);
}

function collectMission(item, point) {
  state.collected[item.key] = true;
  state.nextIndex += 1;
  state.streak += 1;
  state.combo = clamp(1 + state.streak * 0.22, 1, 2.1);
  state.score += item.value * state.combo;
  state.focus = clamp(state.focus + 12, 0, 100);
  state.heat = clamp(state.heat - 14, 0, 100);
  if (state.nextIndex >= missions.length) state.shield = Math.max(state.shield, 1.2);
  if (item.key === "tests") state.shield = Math.max(state.shield, 1.45);
  if (item.key === "image") {
    state.dashTime = Math.max(state.dashTime, 0.32);
    state.dashCooldown = 0;
  }
  state.message = item.story;
  announce(item.story);
  spawnBurst(point.x, point.y, item.color, 28);
  addFloater(`+${Math.round(item.value * state.combo)}`, point.x, point.y - 20, item.color);
  ping(720 + state.streak * 70, 0.07);
}

function winRun() {
  state.mode = "won";
  const timeBonus = Math.max(0, Math.round((RUN_SECONDS - state.elapsed) * 12));
  const focusBonus = Math.round(state.focus * 7);
  state.score += timeBonus + focusBonus + 1200;
  state.message = "Demo launched. The gate opened because the proof was playable.";
  announce("Demo shipped. The gate opened because the proof was playable.");
  const gatePoint = pct(gate);
  spawnBurst(gatePoint.x, gatePoint.y, "#9aff76", 62);
  ping(980, 0.13);
  showOverlay(
    "Demo shipped.",
    `Score ${String(Math.round(state.score)).padStart(4, "0")}. Static HTML/canvas, GPT-5.5 Pro critique, Codex implementation, and Image Gen art.`,
    "Run it again",
  );
}

function loseRun(title, copy) {
  state.mode = "lost";
  state.message = copy;
  announce(copy);
  showOverlay(title, copy, "Try again");
  ping(180, 0.09);
}

function update(dt) {
  if (!state || state.mode !== "playing") return;

  state.elapsed += dt;
  state.hitCooldown = Math.max(0, state.hitCooldown - dt);
  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
  state.dashTime = Math.max(0, state.dashTime - dt);
  state.shield = Math.max(0, state.shield - dt);
  state.shake = Math.max(0, state.shake - dt * 3);
  state.flash = Math.max(0, state.flash - dt * 2.4);
  state.heat = clamp(state.heat + dt * (0.54 + state.nextIndex * 0.22), 0, 100);
  state.player.r = playerRadius();

  updateMovement(dt);

  const mission = currentMission();
  if (mission) {
    const point = pct(mission);
    if (distance(state.player, point) < playerRadius() + responsiveSize(42, 28, 54)) {
      collectMission(mission, point);
    }
  }

  state.insights.forEach((item) => {
    if (item.collected) return;
    const point = pct(item);
    if (distance(state.player, point) < playerRadius() + responsiveSize(22, 18, 28)) {
      item.collected = true;
      state.score += 90 * state.combo;
      state.focus = clamp(state.focus + 7, 0, 100);
      state.heat = clamp(state.heat - 6, 0, 100);
      state.message = "A tiny insight cooled the sprint.";
      announce("Insight collected. Sprint heat cooled.");
      spawnBurst(point.x, point.y, "#39e7ff", 12);
      addFloater("+insight", point.x, point.y - 12, "#39e7ff");
      ping(640, 0.04);
    }
  });

  const gatePoint = pct(gate);
  if (state.nextIndex >= missions.length && distance(state.player, gatePoint) < playerRadius() + responsiveSize(54, 32, 66)) {
    winRun();
    syncHud();
    return;
  }

  hazardDefs.forEach((hazard) => {
    const point = hazardPosition(hazard);
    if (distance(state.player, point) < point.r + state.player.r) {
      if (state.shield > 0) {
        state.score += 35;
        state.message = "The dash slipped past a scope trap.";
        announce("Dash slipped past a scope trap.");
        spawnBurst(point.x, point.y, "#ffd84f", 8);
        return;
      }

      if (state.hitCooldown <= 0) {
        state.score = Math.max(0, state.score - 180);
        state.focus = clamp(state.focus - 12, 0, 100);
        state.heat = clamp(state.heat + 9, 0, 100);
        state.combo = 1;
        state.streak = 0;
        state.hitCooldown = 1.05;
        state.shake = 0.28;
        state.flash = 0.8;
        state.message = "Scope creep clipped the run. Breathe, recover, move.";
        announce("Scope creep clipped the run. Recover and keep moving.");
        const dx = state.player.x - point.x;
        const dy = state.player.y - point.y;
        const mag = Math.hypot(dx, dy) || 1;
        state.player.vx += (dx / mag) * responsiveSize(220, 140, 260);
        state.player.vy += (dy / mag) * responsiveSize(220, 140, 260);
        spawnBurst(state.player.x, state.player.y, "#ff675e", 14);
        addFloater("-focus", state.player.x, state.player.y - 18, "#ff675e");
        ping(160, 0.08);
      }
    }
  });

  if (state.focus <= 0) {
    loseRun("Focus broke.", "The sprint got noisy. Tighten the route and try one more run.");
  } else if (state.heat >= 100) {
    loseRun("Demo overheated.", "Too much scope, not enough signal. Cool the sprint by collecting proof faster.");
  } else if (state.elapsed >= RUN_SECONDS) {
    loseRun("Sprint expired.", "The best demos ship after one more focused loop.");
  }

  state.particles = state.particles
    .map((part) => ({
      ...part,
      x: part.x + part.vx * dt,
      y: part.y + part.vy * dt,
      vx: part.vx * 0.95,
      vy: part.vy * 0.95,
      life: part.life - dt * 1.65,
    }))
    .filter((part) => part.life > 0);

  state.floaters = state.floaters
    .map((part) => ({
      ...part,
      y: part.y - part.vy * dt,
      life: part.life - dt * 1.25,
    }))
    .filter((part) => part.life > 0);

  syncHud();
}

function frame(now) {
  resizeCanvas();
  const dt = Math.min(0.033, lastTime ? (now - lastTime) / 1000 : 0);
  lastTime = now;
  update(dt);
  drawGame();
  scheduleFrame(frame);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height),
  };
}

function ping(freq, duration) {
  if (muted) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, audioCtx.currentTime + 0.01);
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
  if (event.code === "Space") {
    if (state.mode === "playing") dash();
    else startRun();
    return;
  }
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("resize", resizeCanvas);

canvas.addEventListener("pointerdown", (event) => {
  activePointerId = event.pointerId;
  pointer = { ...canvasPoint(event), active: true };
  canvas.setPointerCapture(event.pointerId);
  if (state.mode !== "playing") startRun();
  if (event.detail >= 2) dash();
});

canvas.addEventListener("pointermove", (event) => {
  if (event.buttons && event.pointerId === activePointerId) pointer = { ...canvasPoint(event), active: true };
});

function releasePointer(event) {
  if (!event || event.pointerId === activePointerId) {
    if (pointer) pointer.active = false;
    activePointerId = null;
  }
}

canvas.addEventListener("pointerup", releasePointer);

canvas.addEventListener("pointercancel", () => {
  pointer = null;
  activePointerId = null;
});

canvas.addEventListener("lostpointercapture", releasePointer);

window.addEventListener("blur", () => {
  keys.clear();
  pointer = null;
  activePointerId = null;
});

startButton.addEventListener("click", startRun);
restartButton.addEventListener("click", resetState);
dashButton.addEventListener("click", dash);
muteButton.addEventListener("click", () => {
  muted = !muted;
  muteButton.textContent = muted ? "Sound off" : "Sound on";
});

resizeCanvas();
resetState();
scheduleFrame(frame);
