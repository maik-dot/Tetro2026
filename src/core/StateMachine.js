export class StateMachine {
  constructor(initialState = null) {
    this.currentState = null;
    this.states = new Map();
    if (initialState) {
      this.change(initialState);
    }
  }

  register(name, state) {
    this.states.set(name, state);
  }

  change(name, data) {
    const next = this.states.get(name);
    if (!next) return;
    if (this.currentState && this.currentState.onExit) {
      this.currentState.onExit();
    }
    this.currentState = next;
    if (this.currentState.onEnter) {
      this.currentState.onEnter(data);
    }
  }

  update(dt) {
    if (this.currentState && this.currentState.update) {
      this.currentState.update(dt);
    }
  }

  render(ctx) {
    if (this.currentState && this.currentState.render) {
      this.currentState.render(ctx);
    }
  }
}

