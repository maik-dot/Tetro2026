import { KeyboardInput } from './KeyboardInput.js';

export class InputManager {
  constructor(game, audio = null) {
    this.game = game;
    this.audio = audio;
    const onFirstInput = audio ? () => audio.unlock() : null;
    this.keyboard = new KeyboardInput(onFirstInput);

    this.keyboard.on('moveLeft', () => {
      this.game.move(-1);
      if (this.audio) this.audio.playSfx('move');
    });
    this.keyboard.on('moveRight', () => {
      this.game.move(1);
      if (this.audio) this.audio.playSfx('move');
    });
    this.keyboard.on('rotateCW', () => {
      this.game.rotateCW();
      if (this.audio) this.audio.playSfx('rotate');
    });
    this.keyboard.on('softDrop', () => this.game.softDropStep());
    this.keyboard.on('softDropEnd', () => {});
    this.keyboard.on('hardDrop', () => this.game.hardDrop());
    this.keyboard.on('togglePause', () => this.game.togglePause());
    this.keyboard.on('restart', () => this.game.reset());
  }

  update() {
    // Platzhalter für zukünftige DAS/ARR-Logik oder Gamepad
  }

  dispose() {
    if (this.keyboard) {
      this.keyboard.dispose();
    }
  }
}

