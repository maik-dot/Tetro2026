export class KeyboardInput {
  constructor(onFirstInput = null) {
    this.listeners = new Map();
    this.onFirstInput = onFirstInput;
    this._firstInputDone = false;
    this.keyDownHandler = (e) => {
      this.handleKeyDown(e).catch(() => {});
    };
    this.keyUpHandler = (e) => this.handleKeyUp(e);
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  async handleKeyDown(e) {
    if (this.onFirstInput && !this._firstInputDone) {
      this._firstInputDone = true;
      await this.onFirstInput();
    }
    this.doHandleKeyDown(e);
  }

  doHandleKeyDown(e) {
    this._handleKeyDown(e);
  }

  on(action, callback) {
    this.listeners.set(action, callback);
  }

  emit(action, payload) {
    const cb = this.listeners.get(action);
    if (cb) cb(payload);
  }

  _handleKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft':
        this.emit('moveLeft');
        break;
      case 'ArrowRight':
        this.emit('moveRight');
        break;
      case 'ArrowUp':
      case 'KeyX':
        this.emit('rotateCW');
        break;
      case 'ArrowDown':
        this.emit('softDrop');
        break;
      case 'Space':
        e.preventDefault();
        this.emit('hardDrop');
        break;
      case 'Escape':
        this.emit('togglePause');
        break;
      case 'Enter':
      case 'KeyR':
        this.emit('restart');
        break;
      default:
        break;
    }
  }

  handleKeyUp(e) {
    if (e.code === 'ArrowDown') {
      this.emit('softDropEnd');
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
  }
}

