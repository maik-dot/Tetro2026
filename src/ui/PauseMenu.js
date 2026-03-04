export class PauseMenu {
  constructor(audio, game) {
    this.audio = audio;
    this.game = game;
    this.overlay = document.getElementById('pauseOverlay');
    this.musicEnabledEl = document.getElementById('pauseMusicEnabled');
    this.musicVolumeEl = document.getElementById('pauseMusicVolume');
    this.sfxEnabledEl = document.getElementById('pauseSfxEnabled');
    this.sfxVolumeEl = document.getElementById('pauseSfxVolume');
    this.debugAnimEl = document.getElementById('pauseDebugAnimation');
    this.resumeBtn = document.getElementById('pauseResumeBtn');

    this._wireEvents();
  }

  _wireEvents() {
    if (this.resumeBtn) {
      this.resumeBtn.addEventListener('click', () => {
        if (this.game && this.game.paused) {
          this.game.togglePause();
        }
        this.hide();
      });
    }

    if (this.musicEnabledEl) {
      this.musicEnabledEl.addEventListener('change', () => {
        if (!this.audio) return;
        const enabled = !!this.musicEnabledEl.checked;
        this.audio.setMusicEnabled?.(enabled);
      });
    }

    if (this.musicVolumeEl) {
      this.musicVolumeEl.addEventListener('input', () => {
        if (!this.audio) return;
        const v = parseFloat(this.musicVolumeEl.value);
        if (!Number.isNaN(v)) {
          this.audio.setVolume('music', v);
        }
      });
    }

    if (this.sfxEnabledEl) {
      this.sfxEnabledEl.addEventListener('change', () => {
        if (!this.audio) return;
        const enabled = !!this.sfxEnabledEl.checked;
        this.audio.setSfxEnabled?.(enabled);
      });
    }

    if (this.sfxVolumeEl) {
      this.sfxVolumeEl.addEventListener('input', () => {
        if (!this.audio) return;
        const v = parseFloat(this.sfxVolumeEl.value);
        if (!Number.isNaN(v)) {
          this.audio.setVolume('sfx', v);
        }
      });
    }

    if (this.debugAnimEl) {
      this.debugAnimEl.addEventListener('change', () => {
        const enabled = !!this.debugAnimEl.checked;
        if (typeof this.onDebugAnimationChange === 'function') {
          this.onDebugAnimationChange(enabled);
        }
      });
    }
  }

  show() {
    if (!this.overlay) return;
    if (this.audio) {
      if (this.musicVolumeEl) {
        this.musicVolumeEl.value = String(this.audio.musicGain ?? 0.8);
      }
      if (this.sfxVolumeEl) {
        this.sfxVolumeEl.value = String(this.audio.sfxGain ?? 0.8);
      }
    }
    this.overlay.classList.remove('hidden');
  }

  hide() {
    if (!this.overlay) return;
    this.overlay.classList.add('hidden');
  }
}

