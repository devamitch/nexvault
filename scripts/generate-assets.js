#!/usr/bin/env node

/**
 * NexVault Complete Asset Generator
 * ===================================
 * Generates ALL app icons, navigation icons, interaction icons,
 * creation icons, state icons, data/visual icons, and splash screens.
 *
 * Style: Dark (#050a14) background, cyan (#00D1FF) glow, holographic/quantum aesthetic
 *
 * Requirements: npm install @napi-rs/canvas
 *
 * Output structure:
 *   assets/
 *     app/           → App store icons (icon, adaptive-icon, favicon, splash)
 *     icons/nav/     → Navigation icons (vault, research, home, back)
 *     icons/create/  → Creation icons (memo, save, entry)
 *     icons/interact/→ Interaction icons (calibration, identity, quantum-idle)
 *     icons/state/   → State icons (listening, processing, grab)
 *     icons/data/    → Data/Visual icons (age, importance, gesture, haptic)
 *     splash/        → Splash screens
 */

const fs = require("fs");
const path = require("path");

// ── Dirs ──────────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "nexvault-assets");
const DIRS = {
  app: path.join(ROOT, "app"),
  nav: path.join(ROOT, "icons", "nav"),
  create: path.join(ROOT, "icons", "create"),
  interact: path.join(ROOT, "icons", "interact"),
  state: path.join(ROOT, "icons", "state"),
  data: path.join(ROOT, "icons", "data"),
  splash: path.join(ROOT, "splash"),
};
Object.values(DIRS).forEach((d) => fs.mkdirSync(d, { recursive: true }));

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg: "#050a14",
  bgDark: "#000000",
  cyan: "#00D1FF",
  cyanDim: "rgba(0,209,255,0.15)",
  cyanMid: "rgba(0,209,255,0.5)",
  cyanGlow: "rgba(0,209,255,0.8)",
  blue: "#0055ff",
  purple: "#7b2fff",
  white: "#ffffff",
  whiteDim: "rgba(255,255,255,0.7)",
};

// ── Seeded PRNG ───────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Canvas factory ────────────────────────────────────────────────────────────
let createCanvas;
async function getCanvas() {
  if (createCanvas) return createCanvas;
  try {
    createCanvas = require("@napi-rs/canvas").createCanvas;
  } catch {
    try {
      createCanvas = require("canvas").createCanvas;
    } catch {
      throw new Error("Canvas not found. Run: npm install @napi-rs/canvas --save-dev");
    }
  }
  return createCanvas;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Dark background fill */
function darkBg(ctx, w, h) {
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, w, h);
}

/** Radial glow at cx,cy with given radius and color */
function radialGlow(ctx, cx, cy, r, color, innerColor) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, innerColor || color);
  g.addColorStop(0.5, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/** Save PNG to disk */
function savePNG(cvs, filePath) {
  const buf = cvs.toBuffer("image/png");
  fs.writeFileSync(filePath, buf);
  const rel = path.relative(ROOT, filePath);
  console.log(`  ✓ ${rel}`);
}

/** Scatter tiny particles */
function particles(ctx, w, h, count, seed, alpha = 0.35, maxR = 2.5) {
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = rng() * maxR + 0.4;
    const a = rng() * alpha + 0.04;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,209,255,${a})`;
    ctx.fill();
  }
}

/** Draw a rounded square clip (iOS-like) */
function roundedClip(ctx, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.quadraticCurveTo(w, 0, w, radius);
  ctx.lineTo(w, h - radius);
  ctx.quadraticCurveTo(w, h, w - radius, h);
  ctx.lineTo(radius, h);
  ctx.quadraticCurveTo(0, h, 0, h - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();
}

/** Glowing stroke circle */
function glowCircle(ctx, cx, cy, r, color, lineW, blur) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Glowing line */
function glowLine(ctx, x1, y1, x2, y2, color, lineW, blur) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

// ══════════════════════════════════════════════════════════════════════════════
// APP ICONS
// ══════════════════════════════════════════════════════════════════════════════

/** Main App Icon — swirling quantum vortex */
async function genAppIcon(cc) {
  const S = 1024;
  const cvs = cc(S, S);
  const ctx = cvs.getContext("2d");

  // Background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, S, S);

  // iOS rounded clip
  ctx.save();
  roundedClip(ctx, S, S, 220);

  // Deep space bg
  const bgGrad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.7);
  bgGrad.addColorStop(0, "#0a1628");
  bgGrad.addColorStop(0.5, "#040810");
  bgGrad.addColorStop(1, "#000000");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, S, S);

  // Star particles
  particles(ctx, S, S, 200, 7, 0.5, 1.5);

  // Outer spiral rings
  const cx = S / 2,
    cy = S / 2;
  const rings = [
    { r: 440, w: 2.5, a: 0.3 },
    { r: 380, w: 2.0, a: 0.4 },
    { r: 310, w: 1.5, a: 0.5 },
    { r: 240, w: 1.5, a: 0.6 },
  ];
  rings.forEach(({ r, w, a }) => {
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = `rgba(0,209,255,${a})`;
    ctx.strokeStyle = `rgba(0,209,255,${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // Spinning particle arcs (simulate vortex)
  const rng = mulberry32(42);
  for (let arc = 0; arc < 6; arc++) {
    const startAngle = arc * (Math.PI / 3);
    const sweep = Math.PI * 0.7;
    const radius = 200 + rng() * 200;
    ctx.save();
    ctx.shadowBlur = 25;
    ctx.shadowColor = T.cyan;
    ctx.strokeStyle = `rgba(0,209,255,${0.3 + rng() * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sweep);
    ctx.stroke();
    ctx.restore();
  }

  // Scattered arc particles
  for (let i = 0; i < 120; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 80 + rng() * 370;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const r = rng() * 3 + 0.5;
    const a = 0.4 + rng() * 0.6;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
    g.addColorStop(0, `rgba(0,209,255,${a})`);
    g.addColorStop(1, "rgba(0,209,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central core glow
  const coreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
  coreG.addColorStop(0, "rgba(255,255,255,1)");
  coreG.addColorStop(0.15, "rgba(0,209,255,0.9)");
  coreG.addColorStop(0.5, "rgba(0,100,255,0.3)");
  coreG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = coreG;
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.fill();

  // Bright center point
  const cp = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
  cp.addColorStop(0, "rgba(255,255,255,1)");
  cp.addColorStop(0.5, "rgba(180,240,255,0.8)");
  cp.addColorStop(1, "rgba(0,209,255,0)");
  ctx.fillStyle = cp;
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  savePNG(cvs, path.join(DIRS.app, "icon.png"));
}

/** Adaptive Icon (same but no clip, slightly smaller content) */
async function genAdaptiveIcon(cc) {
  const S = 1024;
  const cvs = cc(S, S);
  const ctx = cvs.getContext("2d");

  const bgGrad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.7);
  bgGrad.addColorStop(0, "#0a1628");
  bgGrad.addColorStop(1, "#000000");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, S, S);

  particles(ctx, S, S, 150, 12, 0.4, 1.5);

  const cx = S / 2,
    cy = S / 2;
  const rng = mulberry32(55);

  [350, 290, 230, 175].forEach((r, i) => {
    glowCircle(ctx, cx, cy, r, T.cyan, 1.5, 15);
  });

  for (let i = 0; i < 90; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 60 + rng() * 290;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const r = rng() * 2.5 + 0.5;
    ctx.fillStyle = `rgba(0,209,255,${0.3 + rng() * 0.5})`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const coreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100);
  coreG.addColorStop(0, "rgba(255,255,255,1)");
  coreG.addColorStop(0.2, "rgba(0,209,255,0.9)");
  coreG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = coreG;
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.fill();

  savePNG(cvs, path.join(DIRS.app, "adaptive-icon.png"));
}

/** Favicon 48x48 */
async function genFavicon(cc) {
  const S = 48;
  const cvs = cc(S, S);
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, S, S);

  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, "rgba(0,209,255,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = T.cyan;
  ctx.fillStyle = T.cyan;
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", S / 2, S / 2 + 1);
  ctx.restore();

  savePNG(cvs, path.join(DIRS.app, "favicon.png"));
}

/** Notification icon — white N on transparent */
async function genNotificationIcon(cc) {
  const S = 96;
  const cvs = cc(S, S);
  const ctx = cvs.getContext("2d");
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", S / 2, S / 2 + 2);
  savePNG(cvs, path.join(DIRS.app, "notification-icon.png"));
}

// ══════════════════════════════════════════════════════════════════════════════
// SPLASH SCREEN
// ══════════════════════════════════════════════════════════════════════════════

async function genSplash(cc) {
  const W = 1284,
    H = 2778;
  const cvs = cc(W, H);
  const ctx = cvs.getContext("2d");

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#000000");
  bg.addColorStop(0.4, "#020810");
  bg.addColorStop(0.6, "#020810");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  particles(ctx, W, H, 300, 99, 0.45, 2.5);

  const cx = W / 2,
    cy = H / 2;

  // Vortex rings
  [520, 430, 340, 255].forEach((r, i) => {
    glowCircle(ctx, cx, cy, r, `rgba(0,209,255,${0.2 + i * 0.08})`, 1.5, 20);
  });

  // Core glow
  const coreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
  coreG.addColorStop(0, "rgba(255,255,255,0.9)");
  coreG.addColorStop(0.1, "rgba(0,209,255,0.8)");
  coreG.addColorStop(0.4, "rgba(0,80,200,0.3)");
  coreG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = coreG;
  ctx.fillRect(cx - 200, cy - 200, 400, 400);

  // NEXVAULT text
  ctx.save();
  ctx.shadowBlur = 40;
  ctx.shadowColor = T.cyan;
  ctx.fillStyle = T.white;
  ctx.font = "bold 110px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NEXVAULT", cx, cy + 380);
  ctx.restore();

  // Tagline
  ctx.fillStyle = "rgba(0,209,255,0.5)";
  ctx.font = "30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Quantum Spatial Research Interface", cx, cy + 490);

  // Bottom watermark
  ctx.fillStyle = "rgba(0,209,255,0.25)";
  ctx.font = "22px sans-serif";
  ctx.fillText("NexVault ✦", cx, H - 80);

  savePNG(cvs, path.join(DIRS.splash, "splash.png"));
  savePNG(cvs, path.join(DIRS.app, "splash.png")); // also in app dir
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION ICONS  (256x256 each)
// ══════════════════════════════════════════════════════════════════════════════

const ICON_SIZE = 256;

function iconBase(cc) {
  const cvs = cc(ICON_SIZE, ICON_SIZE);
  const ctx = cvs.getContext("2d");
  darkBg(ctx, ICON_SIZE, ICON_SIZE);
  return { cvs, ctx, S: ICON_SIZE, cx: ICON_SIZE / 2, cy: ICON_SIZE / 2 };
}

/** Vault icon — glowing cube with lock lines */
async function genVaultIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);

  // Glow
  radialGlow(ctx, cx, cy, S * 0.5, "rgba(0,209,255,0.12)");

  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 3;

  // Front face
  const s = 80;
  ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);

  // Perspective lines (top right face)
  const off = 35;
  [
    [cx - s, cy - s],
    [cx + s, cy - s],
    [cx + s, cy + s],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + off, y - off);
    ctx.stroke();
  });
  // Top right face outline
  ctx.beginPath();
  ctx.moveTo(cx - s + off, cy - s - off);
  ctx.lineTo(cx + s + off, cy - s - off);
  ctx.lineTo(cx + s + off, cy + s - off);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s + off, cy - s - off);
  ctx.lineTo(cx + s + off, cy - s - off);
  ctx.stroke();

  // Lock dial circle
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.stroke();
  // Dial tick marks
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20);
    ctx.lineTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28);
    ctx.stroke();
  }

  ctx.restore();
  savePNG(cvs, path.join(DIRS.nav, "vault.png"));
}

/** Research icon — microscope + data streams */
async function genResearchIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.5, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 3;

  // Microscope body (simplified)
  const bx = cx - 15;
  // Stage
  ctx.beginPath();
  ctx.moveTo(bx - 40, cy + 70);
  ctx.lineTo(bx + 40, cy + 70);
  ctx.stroke();
  // Arm up
  ctx.beginPath();
  ctx.moveTo(bx, cy + 70);
  ctx.lineTo(bx, cy - 40);
  ctx.stroke();
  // Head
  ctx.beginPath();
  ctx.moveTo(bx - 25, cy - 40);
  ctx.lineTo(bx + 25, cy - 40);
  ctx.stroke();
  // Eyepiece
  ctx.beginPath();
  ctx.moveTo(bx + 15, cy - 40);
  ctx.lineTo(bx + 15, cy - 75);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx + 15, cy - 82, 10, 0, Math.PI * 2);
  ctx.stroke();
  // Lens
  ctx.beginPath();
  ctx.arc(bx, cy + 10, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Data stream lines (right side)
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,209,255,0.5)";
  [cy - 30, cy - 10, cy + 10, cy + 30, cy + 50].forEach((y, i) => {
    const w = 20 + (i % 3) * 15;
    ctx.beginPath();
    ctx.moveTo(cx + 40, y);
    ctx.lineTo(cx + 40 + w, y);
    ctx.stroke();
  });

  ctx.restore();
  savePNG(cvs, path.join(DIRS.nav, "research.png"));
}

/** Home icon — holographic house */
async function genHomeIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.5, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 3;

  // Roof
  ctx.beginPath();
  ctx.moveTo(cx, cy - 80);
  ctx.lineTo(cx - 80, cy - 10);
  ctx.lineTo(cx + 80, cy - 10);
  ctx.closePath();
  ctx.stroke();

  // Walls
  ctx.strokeRect(cx - 60, cy - 10, 120, 90);

  // Door
  ctx.strokeRect(cx - 18, cy + 30, 36, 50);

  // Windows
  ctx.strokeRect(cx - 50, cy + 10, 28, 28);
  ctx.strokeRect(cx + 22, cy + 10, 28, 28);

  // Subtle grid lines on house (holographic effect)
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = "rgba(0,209,255,0.25)";
  for (let y = cy; y < cy + 90; y += 18) {
    ctx.beginPath();
    ctx.moveTo(cx - 60, y);
    ctx.lineTo(cx + 60, y);
    ctx.stroke();
  }

  ctx.restore();
  savePNG(cvs, path.join(DIRS.nav, "home.png"));
}

/** Back icon — glowing curved arrow */
async function genBackIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.5, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 22;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  // Curved arc
  ctx.beginPath();
  ctx.arc(cx + 10, cy + 10, 65, Math.PI * 1.0, Math.PI * 2.0, false);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(cx - 55, cy + 10);
  ctx.lineTo(cx - 30, cy - 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 55, cy + 10);
  ctx.lineTo(cx - 20, cy + 15);
  ctx.stroke();

  ctx.restore();
  savePNG(cvs, path.join(DIRS.nav, "back.png"));
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATION ICONS
// ══════════════════════════════════════════════════════════════════════════════

/** New Memo — microphone in orb */
async function genNewMemoIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.45, "rgba(0,209,255,0.12)");

  ctx.save();
  ctx.shadowBlur = 22;
  ctx.shadowColor = T.cyan;

  // Outer orb
  ctx.strokeStyle = "rgba(0,209,255,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 95, 0, Math.PI * 2);
  ctx.stroke();

  // Inner orb highlight
  ctx.strokeStyle = "rgba(0,209,255,0.15)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy - 20, 75, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();

  // Microphone capsule
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect
    ? ctx.roundRect(cx - 20, cy - 55, 40, 65, 20)
    : ctx.rect(cx - 20, cy - 55, 40, 65);
  ctx.stroke();

  // Mic stand arc
  ctx.beginPath();
  ctx.arc(cx, cy + 10, 35, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Stand pole
  ctx.beginPath();
  ctx.moveTo(cx, cy + 45);
  ctx.lineTo(cx, cy + 70);
  ctx.stroke();
  // Stand base
  ctx.beginPath();
  ctx.moveTo(cx - 25, cy + 70);
  ctx.lineTo(cx + 25, cy + 70);
  ctx.stroke();

  ctx.restore();
  savePNG(cvs, path.join(DIRS.create, "new-memo.png"));
}

/** Save — glowing download into cylinder */
async function genSaveIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.45, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 3;

  // Cylinder top ellipse
  ctx.beginPath();
  ctx.ellipse(cx, cy + 25, 60, 20, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Cylinder body
  ctx.beginPath();
  ctx.moveTo(cx - 60, cy + 25);
  ctx.lineTo(cx - 60, cy + 75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 60, cy + 25);
  ctx.lineTo(cx + 60, cy + 75);
  ctx.stroke();
  // Cylinder bottom ellipse
  ctx.beginPath();
  ctx.ellipse(cx, cy + 75, 60, 20, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Down arrow
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 80);
  ctx.lineTo(cx, cy - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 25, cy - 35);
  ctx.lineTo(cx, cy - 10);
  ctx.lineTo(cx + 25, cy - 35);
  ctx.stroke();

  // Particle dots above
  ctx.fillStyle = "rgba(0,209,255,0.6)";
  [-20, 0, 20].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(cx + dx, cy - 95, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
  savePNG(cvs, path.join(DIRS.create, "save.png"));
}

/** Create Entry — glowing plus */
async function genCreateEntryIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.45, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 30;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 16;
  ctx.lineCap = "round";

  // Plus sign
  const arm = 70;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();

  // Corner dots
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  const cr = 15;
  [
    [cx - arm - 8, cy - arm - 8],
    [cx + arm + 8, cy - arm - 8],
    [cx - arm - 8, cy + arm + 8],
    [cx + arm + 8, cy + arm + 8],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, cr, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
  savePNG(cvs, path.join(DIRS.create, "create-entry.png"));
}

// ══════════════════════════════════════════════════════════════════════════════
// INTERACTION ICONS
// ══════════════════════════════════════════════════════════════════════════════

/** Calibration (Phase 1) — finger touching glowing bar */
async function genCalibrationIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.5, "rgba(0,209,255,0.08)");

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = T.cyan;

  // Progress bar (glowing)
  const bx = cx - 90,
    by = cy - 15,
    bw = 180,
    bh = 12;
  ctx.strokeStyle = "rgba(0,209,255,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  // Filled portion
  const fillG = ctx.createLinearGradient(bx, 0, bx + bw * 0.6, 0);
  fillG.addColorStop(0, "rgba(0,209,255,0.8)");
  fillG.addColorStop(1, "rgba(0,209,255,0.3)");
  ctx.fillStyle = fillG;
  ctx.fillRect(bx + 1, by + 1, bw * 0.6 - 2, bh - 2);

  // Finger / cursor
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 2.5;
  // Fingertip glow spot
  const fx = bx + bw * 0.6,
    fy = by + bh / 2;
  const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 20);
  fg.addColorStop(0, "rgba(0,209,255,0.6)");
  fg.addColorStop(1, "rgba(0,209,255,0)");
  ctx.fillStyle = fg;
  ctx.fillRect(fx - 20, fy - 20, 40, 40);

  // Simplified hand/finger shape
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 2.5;
  // Finger
  const handY = fy + 20;
  ctx.beginPath();
  ctx.moveTo(fx - 8, handY);
  ctx.lineTo(fx - 8, handY + 60);
  ctx.lineTo(fx + 8, handY + 60);
  ctx.lineTo(fx + 8, handY);
  ctx.closePath();
  ctx.stroke();
  // Palm
  ctx.beginPath();
  ctx.moveTo(fx - 35, handY + 60);
  ctx.lineTo(fx + 35, handY + 60);
  ctx.lineTo(fx + 30, handY + 95);
  ctx.lineTo(fx - 30, handY + 95);
  ctx.closePath();
  ctx.stroke();

  // Arrow down
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,209,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(fx, handY - 30);
  ctx.lineTo(fx, handY - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fx - 8, handY - 18);
  ctx.lineTo(fx, handY - 10);
  ctx.lineTo(fx + 8, handY - 18);
  ctx.stroke();

  ctx.restore();
  savePNG(cvs, path.join(DIRS.interact, "calibration.png"));
}

/** Identity (Phase 2) — fingerprint on dark square */
async function genIdentityIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);

  // Dark card background
  ctx.fillStyle = "#0a0f1a";
  ctx.fillRect(cx - 95, cy - 95, 190, 190);
  ctx.strokeStyle = "rgba(0,209,255,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 95, cy - 95, 190, 190);

  // Fingerprint rings
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = T.white;
  ctx.strokeStyle = T.white;
  ctx.lineWidth = 2;

  // Concentric ellipse rings (fingerprint look)
  for (let i = 1; i <= 6; i++) {
    const rx = 12 + i * 13;
    const ry = 14 + i * 11;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Central core
  ctx.fillStyle = T.white;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 10, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Grid overlay (subtle)
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.5;
  for (let gx = cx - 95; gx <= cx + 95; gx += 19) {
    ctx.beginPath();
    ctx.moveTo(gx, cy - 95);
    ctx.lineTo(gx, cy + 95);
    ctx.stroke();
  }
  for (let gy = cy - 95; gy <= cy + 95; gy += 19) {
    ctx.beginPath();
    ctx.moveTo(cx - 95, gy);
    ctx.lineTo(cx + 95, gy);
    ctx.stroke();
  }

  ctx.restore();
  savePNG(cvs, path.join(DIRS.interact, "identity.png"));
}

/** Quantum Island Idle (Phase 3) — glowing pill/capsule */
async function genQuantumIdleIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.45, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 3;

  // Pill / capsule shape
  const pw = 45,
    ph = 90;
  ctx.beginPath();
  ctx.moveTo(cx - pw, cy - ph + pw);
  ctx.arc(cx, cy - ph + pw, pw, Math.PI, 0);
  ctx.lineTo(cx + pw, cy + ph - pw);
  ctx.arc(cx, cy + ph - pw, pw, 0, Math.PI);
  ctx.closePath();
  ctx.stroke();

  // Inner glow fill
  const pillG = ctx.createLinearGradient(cx, cy - ph, cx, cy + ph);
  pillG.addColorStop(0, "rgba(0,209,255,0.15)");
  pillG.addColorStop(0.5, "rgba(0,209,255,0.05)");
  pillG.addColorStop(1, "rgba(0,209,255,0.15)");
  ctx.fillStyle = pillG;
  ctx.beginPath();
  ctx.moveTo(cx - pw, cy - ph + pw);
  ctx.arc(cx, cy - ph + pw, pw, Math.PI, 0);
  ctx.lineTo(cx + pw, cy + ph - pw);
  ctx.arc(cx, cy + ph - pw, pw, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // Floating particles around pill
  const rng = mulberry32(77);
  for (let i = 0; i < 12; i++) {
    const angle = rng() * Math.PI * 2;
    const d = 80 + rng() * 40;
    const px = cx + Math.cos(angle) * d;
    const py = cy + Math.sin(angle) * d;
    ctx.fillStyle = `rgba(0,209,255,${0.3 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.arc(px, py, rng() * 3 + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  savePNG(cvs, path.join(DIRS.interact, "quantum-idle.png"));
}

// ══════════════════════════════════════════════════════════════════════════════
// STATE ICONS
// ══════════════════════════════════════════════════════════════════════════════

/** Listening — sound wave bars in glass orb */
async function genListeningIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.45, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = T.cyan;

  // Glass box
  ctx.strokeStyle = "rgba(0,209,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 85, cy - 70, 170, 140);

  // Sound wave bars
  const barCount = 9;
  const barW = 12;
  const gap = 7;
  const totalW = barCount * (barW + gap) - gap;
  const startX = cx - totalW / 2;
  const heights = [30, 50, 65, 80, 55, 80, 65, 50, 30];

  for (let i = 0; i < barCount; i++) {
    const h = heights[i];
    const x = startX + i * (barW + gap);
    const y = cy - h / 2;

    const isCenter = i === 4;
    const barG = ctx.createLinearGradient(0, y, 0, y + h);
    barG.addColorStop(0, isCenter ? "rgba(180,100,255,0.9)" : "rgba(0,209,255,0.9)");
    barG.addColorStop(1, isCenter ? "rgba(100,0,255,0.6)" : "rgba(0,100,255,0.6)");
    ctx.fillStyle = barG;
    ctx.fillRect(x, y, barW, h);
  }

  ctx.restore();
  savePNG(cvs, path.join(DIRS.state, "listening.png"));
}

/** Processing — spinning vortex spiral */
async function genProcessingIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.45, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = T.cyan;

  // Spiral arms
  for (let arm = 0; arm < 3; arm++) {
    const startAngle = arm * ((Math.PI * 2) / 3);
    ctx.strokeStyle = `rgba(0,209,255,${0.5 + arm * 0.15})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.02) {
      const angle = startAngle + t * Math.PI * 1.6;
      const r = 20 + t * 80;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Outer ring
  ctx.strokeStyle = "rgba(0,209,255,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.stroke();

  // Particle dots
  const rng = mulberry32(33);
  for (let i = 0; i < 20; i++) {
    const a = rng() * Math.PI * 2;
    const d = 40 + rng() * 65;
    ctx.fillStyle = `rgba(0,209,255,${0.4 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rng() * 3 + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  savePNG(cvs, path.join(DIRS.state, "processing.png"));
}

/** Grab — outstretched glowing hand */
async function genGrabIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx + 20, cy, S * 0.45, "rgba(0,209,255,0.10)");

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 2.5;

  // Palm
  const px = cx + 10,
    py = cy + 20;
  ctx.beginPath();
  ctx.moveTo(px - 55, py);
  ctx.lineTo(px - 55, py + 55);
  ctx.quadraticCurveTo(px - 55, py + 85, px - 20, py + 90);
  ctx.lineTo(px + 30, py + 90);
  ctx.quadraticCurveTo(px + 60, py + 85, px + 60, py + 55);
  ctx.lineTo(px + 60, py + 10);
  ctx.stroke();

  // Fingers (4)
  const fingers = [
    [px - 45, py, px - 45, py - 70],
    [px - 18, py - 8, px - 18, py - 85],
    [px + 12, py - 5, px + 12, py - 82],
    [px + 42, py, px + 42, py - 65],
  ];
  fingers.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  // Thumb
  ctx.beginPath();
  ctx.moveTo(px - 55, py + 20);
  ctx.quadraticCurveTo(px - 95, py - 10, px - 85, py - 35);
  ctx.stroke();

  // Glow particle being grabbed
  const itemG = ctx.createRadialGradient(px - 100, cy - 50, 0, px - 100, cy - 50, 25);
  itemG.addColorStop(0, "rgba(0,209,255,0.8)");
  itemG.addColorStop(1, "rgba(0,209,255,0)");
  ctx.fillStyle = itemG;
  ctx.fillRect(px - 125, cy - 75, 50, 50);

  ctx.restore();
  savePNG(cvs, path.join(DIRS.state, "grab.png"));
}

// ══════════════════════════════════════════════════════════════════════════════
// DATA / VISUAL ICONS
// ══════════════════════════════════════════════════════════════════════════════

/** Data Age — particle cloud dispersing (age = dispersion) */
async function genDataAgeIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.5, "rgba(0,209,255,0.08)");

  const rng = mulberry32(11);
  // Dense center → sparse edge gradient
  for (let i = 0; i < 180; i++) {
    const t = i / 180;
    const dist = rng() * 100 * (0.3 + t * 0.7);
    const angle = rng() * Math.PI * 2;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const r = (1 - t) * 5 + rng() * 2;
    const a = (1 - t) * 0.8 + 0.05;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
    g.addColorStop(0, `rgba(0,209,255,${a})`);
    g.addColorStop(1, "rgba(0,209,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  savePNG(cvs, path.join(DIRS.data, "data-age.png"));
}

/** Item Importance — starburst glow */
async function genItemImportanceIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.5, "rgba(0,209,255,0.15)");

  ctx.save();

  // Starburst rays
  const rays = 8;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const inner = 25,
      outer = 100 + (i % 2) * 20;
    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * outer;
    const y2 = cy + Math.sin(angle) * outer;
    const a = 0.4 + (i % 2) * 0.3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = T.cyan;
    ctx.strokeStyle = `rgba(0,209,255,${a})`;
    ctx.lineWidth = i % 2 === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Sparks
  const rng = mulberry32(22);
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const d = 50 + rng() * 50;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(0,209,255,${0.5 + rng() * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sx = cx + Math.cos(a) * d;
    const sy = cy + Math.sin(a) * d;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a) * 12, sy + Math.sin(a) * 12);
    ctx.stroke();
  }

  // Core
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
  cg.addColorStop(0, "rgba(255,255,255,1)");
  cg.addColorStop(0.4, "rgba(0,209,255,0.8)");
  cg.addColorStop(1, "rgba(0,209,255,0)");
  ctx.fillStyle = cg;
  ctx.shadowBlur = 30;
  ctx.fillRect(cx - 30, cy - 30, 60, 60);

  ctx.restore();
  savePNG(cvs, path.join(DIRS.data, "item-importance.png"));
}

/** Gesture Trail — hand with motion streak */
async function genGestureTrailIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx - 20, cy, S * 0.45, "rgba(0,209,255,0.08)");

  ctx.save();

  // Trail streak
  for (let i = 0; i < 30; i++) {
    const t = i / 30;
    const tx = cx - 100 + t * 90;
    const ty = cy + Math.sin(t * Math.PI) * 15;
    const a = t * 0.5;
    const r = 4 + t * 6;
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
    g.addColorStop(0, `rgba(0,209,255,${a})`);
    g.addColorStop(1, "rgba(0,209,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glove / hand (simplified outline)
  ctx.shadowBlur = 18;
  ctx.shadowColor = T.cyan;
  ctx.strokeStyle = T.cyan;
  ctx.lineWidth = 2.5;

  const hx = cx + 20,
    hy = cy;
  // Palm outline
  ctx.beginPath();
  ctx.moveTo(hx - 45, hy + 15);
  ctx.lineTo(hx - 45, hy + 60);
  ctx.quadraticCurveTo(hx - 45, hy + 85, hx - 15, hy + 90);
  ctx.lineTo(hx + 35, hy + 90);
  ctx.quadraticCurveTo(hx + 55, hy + 80, hx + 55, hy + 55);
  ctx.lineTo(hx + 55, hy + 15);
  ctx.stroke();
  // Fingers
  [
    [hx - 38, hy + 15, hx - 38, hy - 55],
    [hx - 12, hy + 8, hx - 12, hy - 68],
    [hx + 15, hy + 8, hx + 15, hy - 65],
    [hx + 42, hy + 15, hx + 42, hy - 50],
  ].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  ctx.restore();
  savePNG(cvs, path.join(DIRS.data, "gesture-trail.png"));
}

/** Haptic Morse — dots and dashes in cyan */
async function genHapticMorseIcon(cc) {
  const { cvs, ctx, S, cx, cy } = iconBase(cc);
  radialGlow(ctx, cx, cy, S * 0.4, "rgba(0,209,255,0.08)");

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = T.cyan;
  ctx.fillStyle = T.cyan;

  // Morse: ·  ·  · – – – · · ·  (SOS pattern)
  const pattern = ["dot", "dot", "dot", "dash", "dash", "dash", "dot", "dot", "dot"];
  const dotR = 10,
    dashW = 38,
    dashH = 20,
    gap = 14;
  const totalW = pattern.reduce(
    (s, p) => s + (p === "dot" ? dotR * 2 : dashW) + gap,
    -gap
  );
  let x = cx - totalW / 2;

  pattern.forEach((p) => {
    if (p === "dot") {
      ctx.beginPath();
      ctx.arc(x + dotR, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
      x += dotR * 2 + gap;
    } else {
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(x, cy - dashH / 2, dashW, dashH, 10)
        : ctx.rect(x, cy - dashH / 2, dashW, dashH);
      ctx.fill();
      x += dashW + gap;
    }
  });

  // Ripple rings (haptic suggestion)
  ctx.strokeStyle = "rgba(0,209,255,0.25)";
  ctx.lineWidth = 1.5;
  [55, 80, 105].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
  savePNG(cvs, path.join(DIRS.data, "haptic-morse.png"));
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   NexVault Complete Asset Generator  ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`Output: ${ROOT}\n`);

  const cc = await getCanvas();

  console.log("── App Icons ────────────────────────────");
  await genAppIcon(cc);
  await genAdaptiveIcon(cc);
  await genFavicon(cc);
  await genNotificationIcon(cc);

  console.log("\n── Splash Screen ────────────────────────");
  await genSplash(cc);

  console.log("\n── Navigation Icons ─────────────────────");
  await genVaultIcon(cc);
  await genResearchIcon(cc);
  await genHomeIcon(cc);
  await genBackIcon(cc);

  console.log("\n── Creation Icons ───────────────────────");
  await genNewMemoIcon(cc);
  await genSaveIcon(cc);
  await genCreateEntryIcon(cc);

  console.log("\n── Interaction Icons ────────────────────");
  await genCalibrationIcon(cc);
  await genIdentityIcon(cc);
  await genQuantumIdleIcon(cc);

  console.log("\n── State Icons ──────────────────────────");
  await genListeningIcon(cc);
  await genProcessingIcon(cc);
  await genGrabIcon(cc);

  console.log("\n── Data / Visual Icons ──────────────────");
  await genDataAgeIcon(cc);
  await genItemImportanceIcon(cc);
  await genGestureTrailIcon(cc);
  await genHapticMorseIcon(cc);

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   All 20 assets generated! ✓         ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log("Directory structure:");
  console.log("  nexvault-assets/");
  console.log(
    "    app/            → icon, adaptive-icon, favicon, notification-icon, splash"
  );
  console.log("    icons/nav/      → vault, research, home, back");
  console.log("    icons/create/   → new-memo, save, create-entry");
  console.log("    icons/interact/ → calibration, identity, quantum-idle");
  console.log("    icons/state/    → listening, processing, grab");
  console.log(
    "    icons/data/     → data-age, item-importance, gesture-trail, haptic-morse"
  );
  console.log("    splash/         → splash.png\n");
  console.log("Usage in app.json:");
  console.log('  "icon": "./nexvault-assets/app/icon.png"');
  console.log('  "splash": { "image": "./nexvault-assets/app/splash.png" }');
  console.log(
    '  "android": { "adaptiveIcon": { "foregroundImage": "./nexvault-assets/app/adaptive-icon.png" } }'
  );
  console.log('  "web": { "favicon": "./nexvault-assets/app/favicon.png" }\n');
}

main().catch((err) => {
  console.error("\n✗ Generation failed:", err.message);
  console.error("\nInstall canvas: npm install @napi-rs/canvas --save-dev\n");
  process.exit(1);
});
