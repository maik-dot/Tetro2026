/**
 * AudioManager – lädt und spielt SFX/Musik aus Dateien (OGG, MP3 oder WAV).
 * Geringe Latenz durch vorheriges Decodieren in AudioBuffers.
 * Dateien liegen im Ordner audio/ (relativ zum Projektroot).
 */

const SFX_NAMES = [
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

const EXTENSIONS = ['.ogg', '.mp3', '.wav'];

export class AudioManager {
  constructor(basePath = 'audio/') {
    this.basePath = basePath.replace(/\/?$/, '/');
    this.ctx = null;
    this.buffers = new Map();
    this.musicBuffers = [];
    this.musicOrder = [];
    this._musicIndex = 0;
    this._musicSource = null;
    this.musicGainNode = null;
    this._musicPaused = false;
    this._musicPausedAt = 0;
    this._musicStartTime = 0;
    this.sfxGain = 0.25;
    // Musik standardmäßig deutlich leiser (25 % des bisherigen Werts)
    this.musicGain = 0.05;
    // Zufällige Tonhöhen-Variation für SFX (z.B. 0.08 = ±8 %)
    this.sfxPitchJitter = 0.08;
    this.muted = false;
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this._unlocked = false;
    this._unlockOnce = () => this.unlock().catch(() => {});
    document.addEventListener('keydown', this._unlockOnce, { once: true });
    document.addEventListener('click', this._unlockOnce, { once: true });
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
      });
      this.musicGainNode = this.ctx.createGain();
      this.musicGainNode.gain.value = this.musicGain;
      this.musicGainNode.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API nicht verfügbar:', e);
    }
  }

  async unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    document.removeEventListener('keydown', this._unlockOnce);
    document.removeEventListener('click', this._unlockOnce);
    this.init();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    return this.ctx;
  }

  async _loadBuffer(relativePathWithoutExt) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    for (const ext of EXTENSIONS) {
      const url = this.basePath + relativePathWithoutExt + ext;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arrayBuffer = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        return buffer;
      } catch (e) {
        // Nächste Extension versuchen
      }
    }
    return null;
  }

  /**
   * Lädt alle SFX aus dem audio/ Ordner.
   * Erwartet Dateinamen wie lock.ogg, lineClear.mp3 usw.
   */
  async loadSfx() {
    for (const name of SFX_NAMES) {
      const buffer = await this._loadBuffer(name);
      if (buffer) {
        this.buffers.set(name, buffer);
      } else {
        console.warn('Audio nicht geladen:', name, '(Datei fehlt oder ungültig)');
      }
    }
  }

  playSfx(name, options = {}) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted || !this.sfxEnabled) return;
    if (ctx.state !== 'running') return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const {
      volumeMultiplier = 1,
      pitchOffset = 0, // z.B. 0.06 → +6 %
      lowpassFreq = null,
      pan = null,
    } = options;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    let node = src;

    // Lautstärke
    const gain = ctx.createGain();
    const finalGain = this.sfxGain * volumeMultiplier;
    gain.gain.setValueAtTime(finalGain, ctx.currentTime);
    node.connect(gain);
    node = gain;

    // Optionaler Lowpass-Filter
    if (lowpassFreq && lowpassFreq > 0) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassFreq, ctx.currentTime);
      node.connect(filter);
      node = filter;
    }

    // Optionales Stereo-Panning
    if (typeof pan === 'number' && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, ctx.currentTime);
      node.connect(panner);
      node = panner;
    }

    node.connect(ctx.destination);

    // Pitch-Variation (globales Jitter + optionaler Offset)
    let rate = 1;
    const jitter = this.sfxPitchJitter ?? 0;
    if (jitter > 0) {
      rate *= 1 + (Math.random() * 2 - 1) * jitter; // 1 ± jitter
    }
    if (pitchOffset) {
      rate *= 1 + pitchOffset;
    }
    src.playbackRate.setValueAtTime(rate, ctx.currentTime);

    src.start(ctx.currentTime);
  }

  setVolume(type, value) {
    if (type === 'sfx') {
      this.sfxGain = Math.max(0, Math.min(1, value));
    }
    if (type === 'music') {
      this.musicGain = Math.max(0, Math.min(1, value));
      if (this.musicGainNode && this.ctx) {
        this.musicGainNode.gain.setValueAtTime(this.musicGain, this.ctx.currentTime || 0);
      }
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.musicGainNode && this.ctx) {
      this.musicGainNode.gain.setValueAtTime(this.muted ? 0 : this.musicGain, this.ctx.currentTime || 0);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = !!enabled;
  }

  setMusicEnabled(enabled) {
    const wasEnabled = this.musicEnabled;
    this.musicEnabled = !!enabled;
    if (!this.musicEnabled) {
      this.stopMusic();
      this._musicPaused = false;
      this._musicPausedAt = 0;
    } else if (!wasEnabled && this.musicBuffers.length) {
      this.startMusic();
    }
  }

  /**
   * Lädt alle vorhandenen Musik-Tracks aus audio/music/.
   * Erwartet Dateinamen 001.*, 002.*, ... bis max. 999.
   */
  async loadMusicPlaylist(maxTracks = 999) {
    this.musicBuffers = [];
    const ctx = this.ensureContext();
    if (!ctx) return;
    for (let i = 1; i <= maxTracks; i++) {
      const id = String(i).padStart(3, '0'); // 001, 002, ...
      const buffer = await this._loadBuffer(`music/${id}`);
      if (buffer) {
        this.musicBuffers.push(buffer);
      } else {
        // Sobald eine ID fehlt, gehen wir davon aus,
        // dass keine höheren IDs existieren (inkrementelle Anlage).
        break;
      }
    }
  }

  _buildMusicOrder() {
    this.musicOrder = this.musicBuffers.map((_, idx) => idx);
    for (let i = this.musicOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.musicOrder[i], this.musicOrder[j]] = [this.musicOrder[j], this.musicOrder[i]];
    }
  }

  startMusic() {
    const ctx = this.ensureContext();
    if (!ctx || this.muted || !this.musicEnabled) return;
    if (!this.musicBuffers.length) return;
    if (!this.musicGainNode) {
      this.musicGainNode = ctx.createGain();
      this.musicGainNode.gain.value = this.musicGain;
      this.musicGainNode.connect(ctx.destination);
    }
    this._buildMusicOrder();
    this._playMusicAt(0);
  }

  _playMusicAt(orderIndex) {
    const ctx = this.ctx;
    if (!ctx || !this.musicBuffers.length) return;
    if (this._musicSource) {
      try {
        this._musicSource.stop();
      } catch {
        // ignorieren
      }
    }
    this._musicIndex = orderIndex;
    const bufferIndex = this.musicOrder[orderIndex % this.musicOrder.length];
    const buffer = this.musicBuffers[bufferIndex];
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.musicGainNode ?? ctx.destination);
    src.onended = () => {
      if (this.muted || this._musicPaused) return;
      const next = (orderIndex + 1) % this.musicOrder.length;
      this._playMusicAt(next);
    };
    this._musicSource = src;
    this._musicPaused = false;
    this._musicPausedAt = 0;
    this._musicStartTime = ctx.currentTime;
    src.start(this._musicStartTime);
  }

  stopMusic() {
    if (this._musicSource) {
      try {
        this._musicSource.stop();
      } catch {
        // ignorieren
      }
      this._musicSource = null;
    }
    // Hartes Stoppen: nicht als Pause weiterführen und keinen Auto-Weiterlauf
    this._musicPaused = true;
    this._musicPausedAt = 0;
  }

  pauseMusic() {
    const ctx = this.ctx;
    if (!ctx || !this._musicSource || this._musicPaused) return;
    const now = ctx.currentTime || 0;
    const elapsed = Math.max(0, now - (this._musicStartTime || now));
    this._musicPausedAt += elapsed;
    try {
      this._musicSource.stop();
    } catch {
      // ignorieren
    }
    this._musicSource = null;
    this._musicPaused = true;
  }

  resumeMusic() {
    const ctx = this.ctx;
    if (!ctx || !this._musicPaused || !this.musicBuffers.length || !this.musicEnabled) return;
    const bufferIndex = this.musicOrder[this._musicIndex % this.musicOrder.length];
    const buffer = this.musicBuffers[bufferIndex];
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.musicGainNode ?? ctx.destination);
    const offset = this._musicPausedAt || 0;
    src.onended = () => {
      if (this.muted || this._musicPaused) return;
      this._musicPausedAt = 0;
      const next = (this._musicIndex + 1) % this.musicOrder.length;
      this._playMusicAt(next);
    };
    this._musicSource = src;
    this._musicStartTime = ctx.currentTime || 0;
    this._musicPaused = false;
    src.start(this._musicStartTime, offset);
  }
}
