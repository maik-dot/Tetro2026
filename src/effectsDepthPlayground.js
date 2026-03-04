const canvas = document.getElementById('depthCanvas');
/** @type {CanvasRenderingContext2D | null} */
const ctx = canvas ? canvas.getContext('2d') : null;

const azimuthInput = document.getElementById('depthAzimuth');
const elevationInput = document.getElementById('depthElevation');
const azimuthLabel = document.getElementById('depthAzimuthValue');
const elevationLabel = document.getElementById('depthElevationValue');
const randomizeBtn = document.getElementById('depthRandomize');

const SIZE = 192;
let seed = 1;

function setSeed(s) {
  seed = s | 0;
}

function rnd() {
  // sehr einfacher deterministischer PRNG
  seed = (seed * 1664525 + 1013904223) | 0;
  return ((seed >>> 0) % 1000000) / 1000000;
}

function heightFn(x, y) {
  // x, y im Bereich [0, 1]
  const nx = x * 2 - 1;
  const ny = y * 2 - 1;
  const r = Math.sqrt(nx * nx + ny * ny);

  // weicher Hügel in der Mitte
  let h = Math.max(0, 1 - r * 1.4);

  // feine Störungen / „Gesteinsstruktur“
  const f1 = Math.sin((nx + ny) * 6 + seed * 0.0002);
  const f2 = Math.cos((nx * 2 - ny) * 8 - seed * 0.0003);
  h += 0.25 * f1 * f2;

  // kleine Kanten
  const stripes = Math.sin(nx * 14) * Math.sin(ny * 10);
  h += 0.18 * stripes;

  // Normalisieren in [0,1]
  h = (h + 1.2) / 2.4;
  if (h < 0) h = 0;
  if (h > 1) h = 1;
  return h;
}

function getAngles() {
  const az = azimuthInput ? Number(azimuthInput.value) || 0 : 315;
  const el = elevationInput ? Number(elevationInput.value) || 0 : 55;
  return { azimuthDeg: az, elevationDeg: el };
}

function computeLightDir() {
  const { azimuthDeg, elevationDeg } = getAngles();
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;

  const lx = Math.cos(el) * Math.cos(az);
  const ly = Math.cos(el) * Math.sin(az);
  const lz = Math.sin(el);

  const len = Math.hypot(lx, ly, lz) || 1;
  return { lx: lx / len, ly: ly / len, lz: lz / len };
}

function render() {
  if (!canvas || !ctx) return;

  const { lx, ly, lz } = computeLightDir();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgb(10,12,20)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = ctx.createImageData(SIZE, SIZE);
  const data = img.data;

  const baseColor = { r: 160, g: 150, b: 140 }; // „Stein“-Grundfarbe

  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const x = i / (SIZE - 1);
      const y = j / (SIZE - 1);

      const hC = heightFn(x, y);
      const hL = heightFn(Math.max(0, x - 1 / SIZE), y);
      const hR = heightFn(Math.min(1, x + 1 / SIZE), y);
      const hU = heightFn(x, Math.max(0, y - 1 / SIZE));
      const hD = heightFn(x, Math.min(1, y + 1 / SIZE));

      const dx = (hR - hL) * 2;
      const dy = (hD - hU) * 2;

      let nx = -dx;
      let ny = -dy;
      let nz = 1;

      const nLen = Math.hypot(nx, ny, nz) || 1;
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;

      const ndotl = Math.max(0, nx * lx + ny * ly + nz * lz);

      const ambient = 0.25;
      const diffuse = ndotl;

      // leichter „Kantenboost“, damit Relief klarer wirkt
      const rim = Math.pow(1 - Math.max(0, nz), 2);

      const shade = Math.min(1.2, ambient + diffuse * 0.9 + rim * 0.4);

      let r = baseColor.r * shade;
      let g = baseColor.g * shade;
      let b = baseColor.b * shade;

      // leichte Farbverschiebung abhängig von Höhe
      const coolWarm = hC * 0.25;
      r += coolWarm * 30;
      g += coolWarm * 10;

      const idx = (j * SIZE + i) * 4;
      data[idx + 0] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  const offsetX = Math.floor((canvas.width - SIZE) / 2);
  const offsetY = Math.floor((canvas.height - SIZE) / 2);
  ctx.putImageData(img, offsetX, offsetY);

  // Einfache Blockkontur außenrum
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX + 1, offsetY + 1, SIZE - 2, SIZE - 2);
}

function updateLabels() {
  if (azimuthInput && azimuthLabel) {
    azimuthLabel.textContent = `${azimuthInput.value}°`;
  }
  if (elevationInput && elevationLabel) {
    elevationLabel.textContent = `${elevationInput.value}°`;
  }
}

if (azimuthInput) {
  azimuthInput.addEventListener('input', () => {
    updateLabels();
    render();
  });
}

if (elevationInput) {
  elevationInput.addEventListener('input', () => {
    updateLabels();
    render();
  });
}

if (randomizeBtn) {
  randomizeBtn.addEventListener('click', () => {
    setSeed((Math.random() * 0x7fffffff) | 0);
    render();
  });
}

if (canvas && ctx) {
  updateLabels();
  render();
}

