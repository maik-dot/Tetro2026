const canvas = document.getElementById('grassCanvas');
/** @type {CanvasRenderingContext2D | null} */
const ctx = canvas ? canvas.getContext('2d') : null;

const seedInput = document.getElementById('grassSeed');
const densityInput = document.getElementById('grassDensity');
const inkInput = document.getElementById('grassInk');
const redrawBtn = document.getElementById('grassRedraw');

const TILE_W = 256;
const TILE_H = 256;

/**
 * Procedural comic grass tile (kachelbar) in pure Canvas2D.
 * Usage:
 *   const tile = generateGrassTile(256, 256, { seed: 1234 });
 *   const pat = ctx.createPattern(tile, "repeat");
 *   ctx.fillStyle = pat; ctx.fillRect(0,0,w,h);
 */
function generateGrassTile(w, h, opt = {}) {
  const {
    seed = 1337,
    density = 1.0, // overall tuft count
    bladeCount = 14, // blades per tuft
    comicInk = 0.6, // 0..1 outline strength
    lightDir = { x: -0.6, y: -1.0 }, // top-left light
  } = opt;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx2 = c.getContext('2d');
  if (!ctx2) return c;

  // ---------- RNG ----------
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rrange = (a, b) => a + (b - a) * rand();

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const norm2 = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  };
  const L = norm2(lightDir.x, lightDir.y);

  // Simple periodic value noise (tileable): sample by wrapping lattice indices
  function hash2(ix, iy) {
    // deterministischer 32-bit Hash aus ix,iy,seed
    let n = (ix * 374761393) ^ (iy * 668265263) ^ (seed * 1274126177);
    n = (n ^ (n >>> 13)) * 1274126177;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967296;
  }
  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function valueNoise(x, y, periodX, periodY) {
    const fx = (x / periodX) * w;
    const fy = (y / periodY) * h;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;

    const ix0 = ((x0 % w) + w) % w;
    const iy0 = ((y0 % h) + h) % h;
    const ix1 = (ix0 + 1) % w;
    const iy1 = (iy0 + 1) % h;

    const v00 = hash2(ix0, iy0);
    const v10 = hash2(ix1, iy0);
    const v01 = hash2(ix0, iy1);
    const v11 = hash2(ix1, iy1);

    const sx = smoothstep(tx);
    const sy = smoothstep(ty);

    const a = mix(v00, v10, sx);
    const b = mix(v01, v11, sx);
    return mix(a, b, sy);
  }

  function fbm(x, y, oct = 5, lac = 2.0, gain = 0.5, periodX = 1, periodY = 1) {
    let amp = 1;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * valueNoise(x * f, y * f, periodX, periodY);
      norm += amp;
      amp *= gain;
      f *= lac;
    }
    return sum / norm;
  }

  // HSL helper (comic grass works well in HSL tweaks)
  function hsl(h, s, l, a = 1) {
    return `hsla(${h},${s}%,${l}%,${a})`;
  }

  // ---------- Layer 1: base underpaint ----------
  ctx2.fillStyle = hsl(110, 35, 22);
  ctx2.fillRect(0, 0, w, h);

  // ---------- Layer 2: macro patches ----------
  // big soft blobs = variety, keeps it "drawn" not photo
  for (let i = 0; i < 220; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rrange(14, 48);
    const n = fbm(x / w, y / h, 4, 2.0, 0.55, 1, 1);
    const hue = 95 + n * 35;
    const sat = 35 + n * 25;
    const lig = 18 + n * 22;

    ctx2.globalAlpha = 0.06;
    ctx2.fillStyle = hsl(hue, sat, lig);
    ctx2.beginPath();
    ctx2.arc(x, y, r, 0, Math.PI * 2);
    ctx2.fill();
  }
  ctx2.globalAlpha = 1;

  // ---------- Layer 3: soil speckles / grit ----------
  const img = ctx2.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const grain = (rand() - 0.5) * 18;
      // slight vignette / depth
      const vy = y / h;
      const shade = (1 - vy) * 6;

      d[i + 0] = clamp(d[i + 0] + grain - shade, 0, 255);
      d[i + 1] = clamp(d[i + 1] + grain - shade, 0, 255);
      d[i + 2] = clamp(d[i + 2] + grain - shade, 0, 255);

      // occasional dark dot
      if (rand() < 0.002) {
        d[i + 0] *= 0.7;
        d[i + 1] *= 0.7;
        d[i + 2] *= 0.7;
      }
      // occasional light dot
      if (rand() < 0.0016) {
        d[i + 0] = clamp(d[i + 0] + 25, 0, 255);
        d[i + 1] = clamp(d[i + 1] + 25, 0, 255);
        d[i + 2] = clamp(d[i + 2] + 25, 0, 255);
      }
    }
  }
  ctx2.putImageData(img, 0, 0);

  // ---------- Layer 4: grass tufts ----------
  // We draw tufts back-to-front: y sorting for depth illusion
  const tuftCount = Math.floor((w * h) / 280 * density);
  const tufts = [];
  for (let i = 0; i < tuftCount; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const depth = y / h; // 0 top, 1 bottom
    tufts.push({ x, y, depth });
  }
  tufts.sort((a, b) => a.depth - b.depth);

  function drawBlade(baseX, baseY, len, bend, width, hueBase, depth) {
    // blade direction varies; slight wind/bend; comic: simplified curve
    const dirX = (rand() - 0.5) * 0.6 + bend;
    const dirY = -1.0;

    const tipX = baseX + dirX * len * 0.7;
    const tipY = baseY + dirY * len;

    // control points for bezier
    const c1x = baseX + dirX * len * 0.2 + (rand() - 0.5) * 2;
    const c1y = baseY - len * 0.35;
    const c2x = baseX + dirX * len * 0.55 + (rand() - 0.5) * 2;
    const c2y = baseY - len * 0.75;

    // base shading: darker near bottom => "AO"
    const ao = clamp(1.0 - (len / 42) * 0.25, 0.65, 1.0);
    const light = clamp(0.25 + (-dirX * L.x + 0.6) * 0.35, 0, 1);
    const hue = hueBase + (rand() - 0.5) * 10;
    const sat = 50 + depth * 10;
    const lig = 22 + light * 18 + depth * 8;

    // Ink outline (optional)
    if (comicInk > 0.01) {
      ctx2.lineWidth = width * (1.45 + comicInk * 0.6);
      ctx2.strokeStyle = 'rgba(10,18,8,0.35)';
      ctx2.beginPath();
      ctx2.moveTo(baseX, baseY);
      ctx2.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
      ctx2.stroke();
    }

    // Blade main stroke
    ctx2.lineWidth = width;
    ctx2.strokeStyle = hsl(hue, sat, lig * ao, 0.95);
    ctx2.beginPath();
    ctx2.moveTo(baseX, baseY);
    ctx2.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
    ctx2.stroke();

    // Rim highlight (thin bright edge)
    ctx2.lineWidth = Math.max(1, width * 0.33);
    ctx2.strokeStyle = hsl(hue + 6, sat - 10, lig + 18, 0.45);
    ctx2.beginPath();
    // offset a bit to simulate light edge
    ctx2.moveTo(baseX + 0.6, baseY);
    ctx2.bezierCurveTo(c1x + 0.6, c1y, c2x + 0.6, c2y, tipX + 0.6, tipY);
    ctx2.stroke();
  }

  for (const t of tufts) {
    const n = fbm(t.x / w, t.y / h, 5, 2.0, 0.5, 1, 1);

    const tuftRadius = rrange(2, 7) + n * 5;
    const hueBase = 95 + n * 35;
    const bend = (fbm(t.x / w + 10, t.y / h + 10, 3, 2.2, 0.55, 1, 1) - 0.5) * 0.9;

    // fake shadow blob behind tuft (depth)
    ctx2.globalAlpha = 0.12;
    ctx2.fillStyle = 'rgba(0,0,0,1)';
    ctx2.beginPath();
    ctx2.ellipse(
      t.x + 2,
      t.y + 2,
      tuftRadius * 2.2,
      tuftRadius * 1.2,
      0,
      0,
      Math.PI * 2,
    );
    ctx2.fill();
    ctx2.globalAlpha = 1;

    const blades = Math.floor(bladeCount * rrange(0.7, 1.25));
    for (let i = 0; i < blades; i++) {
      const bx = t.x + (rand() - 0.5) * tuftRadius * 2.2;
      const by = t.y + (rand() - 0.5) * tuftRadius * 1.2;

      const len = rrange(14, 38) * (0.55 + t.depth * 0.7); // lower area: longer blades
      const width = rrange(1.3, 2.8) * (0.75 + t.depth * 0.7);

      drawBlade(bx, by, len, bend, width, hueBase, t.depth);
    }
  }

  // ---------- Layer 5: sparse comic flowers / leaves ----------
  // Keep very sparse to avoid noise overload
  for (let i = 0; i < Math.floor((w * h) / 9000); i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rrange(1.5, 3.0);
    ctx2.fillStyle = hsl(rrange(10, 60), 70, 60, 0.7);
    ctx2.beginPath();
    ctx2.arc(x, y - 6, r, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = hsl(120, 45, 35, 0.8);
    ctx2.beginPath();
    ctx2.arc(x - 2, y - 3, r * 0.7, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x + 2, y - 3, r * 0.7, 0, Math.PI * 2);
    ctx2.fill();
  }

  return c;
}

function getDensity() {
  if (!densityInput) return 1.0;
  const v = Number(densityInput.value) || 0;
  return Math.max(0.25, Math.min(2.0, v / 100));
}

function getInk() {
  if (!inkInput) return 0.6;
  const v = Number(inkInput.value) || 0;
  return Math.max(0, Math.min(1, v / 100));
}

function getSeed() {
  if (!seedInput) return 1337;
  const v = Number(seedInput.value);
  if (!Number.isFinite(v)) return 1337;
  return Math.floor(v) || 0;
}

function drawScene() {
  if (!canvas || !ctx) return;

  const seed = getSeed();
  const density = getDensity();
  const ink = getInk();

  const tile = generateGrassTile(TILE_W, TILE_H, {
    seed,
    density,
    bladeCount: 14,
    comicInk: ink,
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Hintergrund mit Pattern füllen
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Einzelne Tile verkleinert oben rechts anzeigen
  const previewSize = 128;
  const px = canvas.width - previewSize - 12;
  const py = 12;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px - 4, py - 4, previewSize + 8, previewSize + 8);
  ctx.strokeRect(px - 4, py - 4, previewSize + 8, previewSize + 8);

  ctx.drawImage(tile, px, py, previewSize, previewSize);
  ctx.restore();

  // Beschriftung
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font =
    '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Pattern (Wiederholung) im Hintergrund', 12, canvas.height - 30);
  ctx.fillText('Einzelne Tile (128×128) oben rechts', 12, canvas.height - 14);
}

if (redrawBtn) {
  redrawBtn.addEventListener('click', drawScene);
}
if (densityInput) densityInput.addEventListener('input', drawScene);
if (inkInput) inkInput.addEventListener('input', drawScene);
if (seedInput) seedInput.addEventListener('change', drawScene);

if (canvas && ctx) {
  drawScene();
}

