import { TetrisGame } from '../tetris/TetrisGame.js';
import { InputManager } from '../input/InputManager.js';
import { Renderer } from '../render/Renderer.js';
import { HudRenderer } from '../ui/HudRenderer.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { ParticleSystem } from '../render/ParticleSystem.js';
import { AnimationSystem } from '../render/AnimationSystem.js';
import { AudioManager } from '../audio/AudioManager.js';
import { FloatingFxManager } from '../ui/FloatingFx.js';
import { MATERIALS, BOARD_HEIGHT } from '../config/gameConfig.js';

export class StandardMode {
  constructor(canvasContext, audioManager, spriteManager) {
    this.canvasContext = canvasContext;
    this.game = new TetrisGame();
    this.audio = audioManager ?? new AudioManager();
    if (!audioManager) {
      this.audio.loadSfx().catch((e) => console.warn('Audio laden:', e));
      this.audio.loadMusicPlaylist().catch((e) => console.warn('Musik laden:', e));
    }
    this.input = new InputManager(this.game, this.audio);
    this.renderer = new Renderer(spriteManager);
    this.hud = new HudRenderer();
    this.particles = new ParticleSystem(BOARD_HEIGHT);
    this.animation = new AnimationSystem();
    this.fx = new FloatingFxManager();
    this._lastLevel = 1;
    this._musicStarted = false;
    this._wasPaused = this.game.paused;
    this._slimeSettleTimer = 0;
    this.pauseMenu = new PauseMenu(this.audio, this.game);
    if (this.pauseMenu) {
      this.pauseMenu.onDebugAnimationChange = (enabled) => {
        if (this.animation?.setDebugSlowAnimations) {
          this.animation.setDebugSlowAnimations(enabled);
        }
      };
    }
  }

  onEnter() {}

  onExit() {
    if (this.input) {
      this.input.dispose();
    }
  }

  update(dt) {
    if (this.input) this.input.update(dt);
    if (this.game) {
      if (this._slimeSettleTimer > 0) {
        this._slimeSettleTimer -= dt;
        if (this._slimeSettleTimer < 0) this._slimeSettleTimer = 0;
      } else {
        this.game.update(dt);
        this.handleGameEvents();
      }
      if (this.game.level > this._lastLevel) {
        this._lastLevel = this.game.level;
        if (this.audio) this.audio.playSfx('levelUp');
        if (this.fx) {
          this.fx.spawnLevelUp({
            level: this.game.level,
            subtitle: 'Speed Increased',
          });
        }
      }
      if (
        this.audio &&
        !this._musicStarted &&
        !this.game.gameOver &&
        this.audio.musicEnabled &&
        this.audio.musicBuffers &&
        this.audio.musicBuffers.length > 0 &&
        this.audio.ctx &&
        this.audio.ctx.state === 'running'
      ) {
        this._musicStarted = true;
        this.audio.startMusic();
      }

      const nowPaused = this.game.paused;
      if (nowPaused !== this._wasPaused) {
        if (this.audio) {
          if (nowPaused) {
            this.audio.pauseMusic();
          } else if (this._musicStarted && this.audio.musicEnabled) {
            this.audio.resumeMusic();
          }
        }
        if (nowPaused) {
          this.pauseMenu?.show();
        } else {
          this.pauseMenu?.hide();
        }
        this._wasPaused = nowPaused;
      }
    }
    if (this.particles) this.particles.update(dt);
    if (this.animation) this.animation.update(dt);
    if (this.fx) this.fx.update(dt);
    if (this.hud) this.hud.updateFromGame(this.game);
  }

  render() {
    if (!this.renderer || !this.canvasContext || !this.game) return;
    this.renderer.render(this.canvasContext, this.game, this.particles, this.animation);
    if (this.fx && this.canvasContext?.ctx) {
      this.fx.draw(this.canvasContext.ctx);
    }
  }

  handleGameEvents() {
    const events = this.game.consumeEvents?.() ?? [];
    // zuletzt gespielter Material-Impact-SFX (für Bounceback)
    this._lastImpactSfx = null;
    for (const evt of events) {
      if (evt.type === 'linesCleared') {
        if (this.audio) {
          this.audio.playSfx(evt.rows.length >= 4 ? 'tetris' : 'lineClear');
        }
        if (this.particles) {
          this.particles.spawnLineClear(evt.rows, this.game.board.width);
          if (evt.destroyed?.length) {
            this.particles.spawnDestroyBlocks(evt.destroyed);
            if (this.audio) {
              let playedStone = false;
              let playedWood = false;
              let playedGlass = false;
              let playedGrass = false;
              let playedSlime = false;
              for (const d of evt.destroyed) {
                const mat = d.cell?.materialId;
                if (!mat) continue;
                if (mat === 'stone' && !playedStone) {
                  this.audio.playSfx('stoneBreak');
                  playedStone = true;
                } else if (mat === 'wood' && !playedWood) {
                  this.audio.playSfx('woodBreak');
                  playedWood = true;
                } else if (mat === 'glass' && !playedGlass) {
                  this.audio.playSfx('glassBreak');
                  playedGlass = true;
                } else if (mat === 'grass' && !playedGrass) {
                  this.audio.playSfx('grassBreak', { volumeMultiplier: 1.5 });
                  playedGrass = true;
                } else if (mat === 'slime' && !playedSlime) {
                  this.audio.playSfx('slimeBreak');
                  playedSlime = true;
                }
              }
            }
          }
          if (evt.moves?.length) {
            this._spawnMetalSparksFromMoves(evt.moves);
          }
        }
        if (this.animation && evt.rows.length > 0) {
          this.animation.addShake(5 + evt.rows.length * 2, 150 + evt.rows.length * 40);
          const minRow = Math.min(...evt.rows);
          this.animation.addLineFall(minRow);
        }
        if (this.animation && evt.moves?.length) {
          this.animation.addBlockFalls(evt.moves, MATERIALS);
        }
        if (this.fx && evt.rows?.length) {
          const ctx = this.canvasContext?.ctx;
          if (ctx) {
            this.fx.spawnScoreForLines(ctx, evt.rows, this.game.level);
          }
        }
      }
      if (evt.type === 'fragmentDecay') {
        if (this.particles && evt.destroyed?.length) {
          this.particles.spawnDestroyBlocks(evt.destroyed);
        }
        if (this.animation && evt.moves?.length) {
          this.animation.addBlockFalls(evt.moves, MATERIALS);
        }
        if (this.audio && evt.destroyed?.length) {
          let playedStone = false;
          let playedWood = false;
          let playedGlass = false;
          let playedGrass = false;
          let playedSlime = false;
          for (const d of evt.destroyed) {
            const mat = d.cell?.materialId;
            if (!mat) continue;
            if (mat === 'stone' && !playedStone) {
              this.audio.playSfx('stoneBreak');
              playedStone = true;
            } else if (mat === 'wood' && !playedWood) {
              this.audio.playSfx('woodBreak');
              playedWood = true;
            } else if (mat === 'glass' && !playedGlass) {
              this.audio.playSfx('glassBreak');
              playedGlass = true;
            } else if (mat === 'grass' && !playedGrass) {
              this.audio.playSfx('grassBreak', { volumeMultiplier: 1.5 });
              playedGrass = true;
            } else if (mat === 'slime' && !playedSlime) {
              this.audio.playSfx('slimeBreak');
              playedSlime = true;
            }
          }
        }
      }
      if (evt.type === 'pieceLocked') {
        const isSlimePiece = evt.piece?.materialId === 'slime';
        if (this.audio) {
          if (isSlimePiece) {
            // Schleim-Tetromino: eigener Impact-Sound statt lock/lockSoft/lockHard
            this.audio.playSfx('slimeImpact');
          } else {
            if (evt.impactType === 'soft') {
              this.audio.playSfx('lockSoft');
            } else if (evt.impactType === 'normal') {
              this.audio.playSfx('lock');
            }
            // Für impactType === 'hard' wird der Whoosh (lockHard)
            // bereits beim Auslösen des Harddrops im InputManager gespielt.
          }
        }
        if (this.animation && evt.impactType !== 'normal') {
          const shakeByImpact = {
            soft: { strength: 4, duration: 80 },
            hard: { strength: 8, duration: 120 },
          };
          const cfg = shakeByImpact[evt.impactType];
          if (cfg) {
            this.animation.addShake(cfg.strength, cfg.duration);
          }
          if (evt.lockedCells?.length) {
            this.animation.addLockBounce(evt.lockedCells, evt.impactType);
          }
        }
        if (this.particles && evt.lockedCells?.length) {
          this._spawnMetalSparksFromLockedCells(evt.lockedCells);
        }
        // Zusätzlicher, abgeschwächter Bounce-Impact-SFX nach dem visuellen Bounce
        // Soft-Drop nutzt den generischen "lock"-Sound, Hard-Drop nutzt den
        // zuletzt gespielten Material-Impact-SFX (stone-/metal-impact*).
        // Für Schleim keine zusätzlichen Bounce-SFX (nur ein Impact-Sound).
        if (this.audio && evt.impactType === 'soft' && evt.piece?.materialId !== 'slime') {
          const bounceDelay = 80;
          setTimeout(() => {
            if (!this.audio || this.game.gameOver) return;
            const energyFactor = 0.5;
            const volumeMultiplier = energyFactor * 0.6; // ca. 30 % der Basislautstärke
            const base = 1 - energyFactor;
            const pitchOffset = base * 0.12;
            const lowpass = 18000 + (4000 - 18000) * base;
            const panJitter = (Math.random() * 2 - 1) * 0.15;

            this.audio.playSfx('lock', {
              volumeMultiplier,
              pitchOffset,
              lowpassFreq: lowpass,
              pan: panJitter,
            });
          }, bounceDelay);
        } else if (this.audio && evt.impactType === 'hard' && evt.piece?.materialId !== 'slime') {
          const sfxName = this._lastImpactSfx || 'lockHard';
          // Hard-Bounce-SFX zeitlich ans Ende der Bounce-Animation legen
          const bounceDelay = 220;
          setTimeout(() => {
            if (!this.audio || this.game.gameOver) return;
            const energyFactor = 0.5;
            const volumeMultiplier = energyFactor * 0.1; // ca. 30 % der Basislautstärke
            const base = 1 - energyFactor;
            const pitchOffset = base * 0.12;
            const lowpass = 18000 + (4000 - 18000) * base;
            const panJitter = (Math.random() * 2 - 1) * 0.15;

            this.audio.playSfx(sfxName, {
              volumeMultiplier,
              pitchOffset,
              lowpassFreq: lowpass,
              pan: panJitter,
            });
          }, bounceDelay);
        }
      }
      if (evt.type === 'slimeSettle') {
        if (this.animation && evt.moves?.length) {
          this.animation.addBlockFalls(evt.moves, MATERIALS);
          const cells = evt.moves.map((m) => ({ x: m.x, y: m.toY }));
          this.animation.addLockBounce(cells, 'slime');
        }
        if (this.particles && evt.moves?.length) {
          this.particles.spawnSlimeImpactForMoves(evt.moves);
        }
        if (this.audio) {
          this.audio.playSfx('slimeImpact');
        }
        // Spielfluss kurz anhalten, bis die Schleim-Animation fertig ist
        this._slimeSettleTimer = Math.max(this._slimeSettleTimer, 260);
      }
      if (evt.type === 'gameOver' && this.audio) {
        this.audio.stopMusic();
        this._musicStarted = false;
        this.audio.playSfx('gameOver');
      }
    }
  }

  _spawnMetalSparksFromLockedCells(cells) {
    const board = this.game?.board;
    const particles = this.particles;
    if (!board || !particles) return;

    let metalImpactPlayed = false;
    let stoneImpactPlayed = false;
    let woodImpactPlayed = false;
    let glassImpactPlayed = false;
    let grassImpactPlayed = false;

    for (const c of cells) {
      const here = board.getCell(c.x, c.y);
      const below = board.getCell(c.x, c.y + 1);
      if (!here || !below) continue;
      const matA = here.materialId;
      const matB = below.materialId;
      if (!matA || !matB) continue;
      const cx = c.x + 0.5;
      const cy = c.y + 1;
      particles.spawnMetalContactSparks(cx, cy, matA, matB);
      particles.spawnStoneImpactDebris(cx, cy, matA, matB);
      particles.spawnWoodImpactDebris(cx, cy, matA, matB);
      particles.spawnGrassImpactDebris(cx, cy, matA, matB);
      if (!metalImpactPlayed) {
        metalImpactPlayed = this._playMetalImpactForPair(matA, matB) || metalImpactPlayed;
      }
      if (!stoneImpactPlayed) {
        stoneImpactPlayed = this._playStoneImpactForPair(matA, matB) || stoneImpactPlayed;
      }
      if (!woodImpactPlayed) {
        woodImpactPlayed = this._playWoodImpactForPair(matA, matB) || woodImpactPlayed;
      }
      if (!glassImpactPlayed) {
        glassImpactPlayed = this._playGlassImpactForPair(matA, matB) || glassImpactPlayed;
      }
      if (!grassImpactPlayed) {
        grassImpactPlayed = this._playGrassImpactForPair(matA, matB) || grassImpactPlayed;
      }
    }
  }

  _spawnMetalSparksFromMoves(moves) {
    const board = this.game?.board;
    const particles = this.particles;
    if (!board || !particles) return;

    let metalImpactPlayed = false;
    let stoneImpactPlayed = false;
    let woodImpactPlayed = false;
    let glassImpactPlayed = false;
    let grassImpactPlayed = false;

    for (const m of moves) {
      const x = m.x;
      const y = m.toY;
      const here = board.getCell(x, y);
      const below = board.getCell(x, y + 1);
      if (!here || !below) continue;
      const matA = here.materialId;
      const matB = below.materialId;
      if (!matA || !matB) continue;
      const cx = x + 0.5;
      const cy = y + 1;
      particles.spawnMetalContactSparks(cx, cy, matA, matB);
      particles.spawnStoneImpactDebris(cx, cy, matA, matB);
      particles.spawnWoodImpactDebris(cx, cy, matA, matB);
      particles.spawnGrassImpactDebris(cx, cy, matA, matB);
      if (!metalImpactPlayed) {
        metalImpactPlayed = this._playMetalImpactForPair(matA, matB) || metalImpactPlayed;
      }
      if (!stoneImpactPlayed) {
        stoneImpactPlayed = this._playStoneImpactForPair(matA, matB) || stoneImpactPlayed;
      }
      if (!woodImpactPlayed) {
        woodImpactPlayed = this._playWoodImpactForPair(matA, matB) || woodImpactPlayed;
      }
      if (!glassImpactPlayed) {
        glassImpactPlayed = this._playGlassImpactForPair(matA, matB) || glassImpactPlayed;
      }
      if (!grassImpactPlayed) {
        grassImpactPlayed = this._playGrassImpactForPair(matA, matB) || grassImpactPlayed;
      }
    }
  }

  _playMetalImpactForPair(matA, matB) {
    if (!this.audio) return false;
    const aIsMetal = matA === 'metal';
    const bIsMetal = matB === 'metal';
    if (!aIsMetal && !bIsMetal) return false;
    const other = aIsMetal ? matB : matA;
    let sfx = null;
    if (aIsMetal && bIsMetal) {
      sfx = 'metalImpactHeavy';
    } else if (other === 'stone') {
      sfx = 'metalImpactMedium';
    } else if (other === 'glass') {
      sfx = 'metalImpactLight';
    } else {
      // Holz oder anderes → kein spezieller Metall-Impact
      return false;
    }
    this.audio.playSfx(sfx);
    this._lastImpactSfx = sfx;
    return true;
  }

  _playStoneImpactForPair(matA, matB) {
    if (!this.audio) return false;
    if (matA !== 'stone' && matB !== 'stone') return false;
    const other = matA === 'stone' ? matB : matA;
    let sfx = null;
    switch (other) {
      case 'stone':
        sfx = 'stoneImpactStone';
        break;
      case 'metal':
        sfx = 'stoneImpactMetal';
        break;
      case 'glass':
        sfx = 'stoneImpactGlass';
        break;
      case 'wood':
        sfx = 'stoneImpactWood';
        break;
      default:
        return false;
    }
    this.audio.playSfx(sfx);
    this._lastImpactSfx = sfx;
    return true;
  }

  _playWoodImpactForPair(matA, matB) {
    if (!this.audio) return false;
    if (matA !== 'wood' && matB !== 'wood') return false;
    const other = matA === 'wood' ? matB : matA;
    let sfx = null;
    switch (other) {
      case 'stone':
        // Holz auf Stein nutzt denselben SFX wie Stein auf Holz
        sfx = 'stoneImpactWood';
        break;
      case 'metal':
        // Holz auf Metall nutzt denselben SFX wie Stein auf Metall (mittlere Härte)
        sfx = 'metalImpactMedium';
        break;
      case 'glass':
        sfx = 'woodImpactGlass';
        break;
      case 'wood':
        sfx = 'woodImpactWood';
        break;
      default:
        return false;
    }
    this.audio.playSfx(sfx);
    this._lastImpactSfx = sfx;
    return true;
  }

  _playGlassImpactForPair(matA, matB) {
    if (!this.audio) return false;
    if (matA !== 'glass' && matB !== 'glass') return false;
    const other = matA === 'glass' ? matB : matA;
    let sfx = null;
    switch (other) {
      case 'stone':
        // Glas auf Stein nutzt denselben SFX wie Stein auf Glas
        sfx = 'stoneImpactGlass';
        break;
      case 'metal':
        // Glas auf Metall nutzt den leichten Metall-Impact für Glas
        sfx = 'metalImpactLight';
        break;
      case 'glass':
        // eigener Glas-auf-Glas-Impact
        sfx = 'glassImpactGlass';
        break;
      case 'wood':
        // Glas auf Holz nutzt denselben SFX wie Holz auf Glas
        sfx = 'woodImpactGlass';
        break;
      default:
        return false;
    }
    this.audio.playSfx(sfx);
    this._lastImpactSfx = sfx;
    return true;
  }

  _playGrassImpactForPair(matA, matB) {
    if (!this.audio) return false;
    if (matA !== 'grass' && matB !== 'grass') return false;
    // Immer derselbe SFX, unabhängig vom Kollisionspartner.
    this.audio.playSfx('grassImpact');
    return true;
  }
}

