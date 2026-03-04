/**
 * Erstellt minimale stille WAV-Dateien als Platzhalter im audio/ Ordner.
 * Diese kannst du durch eigene OGG/MP3/WAV ersetzen (gleicher Dateiname).
 */
const fs = require('fs');
const path = require('path');

const NAMES = [
  'lock',
  'lockSoft',
  'lockHard',
  'lineClear',
  'tetris',
  'levelUp',
  'gameOver',
  'move',
  'rotate',
  // Material-/Effekt-SFX
  'metalImpactHeavy',
  'metalImpactMedium',
  'metalImpactLight',
  'woodBreak',
  'glassBreak',
  'stoneBreak',
  'stoneImpactStone',
  'stoneImpactMetal',
  'stoneImpactGlass',
  'stoneImpactWood',
  'woodImpactStone',
  'woodImpactMetal',
  'woodImpactGlass',
  'woodImpactWood',
  // eigener Glas-auf-Glas-Impact
  'glassImpactGlass',
  // neue Materialien
  'grassBreak',
  'slimeBreak',
  'slimeImpact',
  'grassImpact',
];

function createMinimalWav() {
  const sampleRate = 44100;
  const durationSec = 0.1;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buf = Buffer.alloc(headerSize + dataSize);
  let o = 0;
  const write = (str) => { buf.write(str, o); o += str.length; };
  const writeU32 = (n) => { buf.writeUInt32LE(n, o); o += 4; };
  const writeU16 = (n) => { buf.writeUInt16LE(n, o); o += 2; };

  write('RIFF');
  writeU32(fileSize - 8);
  write('WAVE');
  write('fmt ');
  writeU32(16);
  writeU16(1);
  writeU16(1);
  writeU32(sampleRate);
  writeU32(sampleRate * 2);
  writeU16(2);
  writeU16(16);
  write('data');
  writeU32(dataSize);
  return buf;
}

const audioDir = path.join(__dirname, '..', 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

const wav = createMinimalWav();
for (const name of NAMES) {
  const file = path.join(audioDir, name + '.wav');
  fs.writeFileSync(file, wav);
  console.log('Erstellt:', file);
}
console.log('Fertig. Ersetze die .wav durch deine eigenen OGG/MP3/WAV (gleicher Name).');
