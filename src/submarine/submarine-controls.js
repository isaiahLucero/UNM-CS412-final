// Keyboard → plain input axes. Submarine.update() only consumes the returned
// object, so any other source (gamepad, AI, network) can produce the same shape:
//
//   { throttle, turn, vertical,                    // each in [-1, 1]
//     arm: { yaw, pitch, elbow, roll, claw },      // each in [-1, 1]
//     resetArm }                                   // true for one frame
//
// Keys are matched by KeyboardEvent.code (physical position), so the map works
// on any layout and holding Shift doesn't change which key is reported.

export const DEFAULT_KEYMAP = {
  // submarine — left hand
  forward: ['KeyW'],      back: ['KeyS'],
  turnLeft: ['KeyA'],     turnRight: ['KeyD'],
  ascend: ['Space'],      descend: ['ShiftLeft', 'ShiftRight'],
  // robotic arm — right hand
  yawLeft: ['KeyJ'],      yawRight: ['KeyL'],
  pitchUp: ['KeyI'],      pitchDown: ['KeyK'],
  elbowFold: ['KeyU'],    elbowExtend: ['KeyO'],
  rollCcw: ['KeyN'],      rollCw: ['KeyM'],
  clawOpen: ['Comma'],    clawClose: ['Period'],
  resetArm: ['KeyR']
};

// Only text-entry fields swallow keys; checkboxes/buttons/sliders don't.
const IGNORE_TARGETS = 'textarea, select, [contenteditable], ' +
  'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button])';

export class KeyboardControls {
  constructor({ target = window, keymap = DEFAULT_KEYMAP } = {}) {
    this.target = target;
    this.keymap = keymap;
    this.held = new Set();
    this.resetQueued = false;
    this.codeToAction = new Map();
    for (const [action, codes] of Object.entries(keymap))
      for (const code of codes) this.codeToAction.set(code, action);

    this._down = e => this.onKeyDown(e);
    this._up = e => this.onKeyUp(e);
    this._blur = () => this.held.clear();
    target.addEventListener('keydown', this._down);
    target.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }

  onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;           // keep browser shortcuts (Cmd+R etc.)
    if (e.target?.closest?.(IGNORE_TARGETS)) return;
    const action = this.codeToAction.get(e.code);
    if (!action) return;
    e.preventDefault();                                       // e.g. Space would scroll the page
    if (action === 'resetArm') { if (!e.repeat) this.resetQueued = true; return; }
    this.held.add(action);
  }

  onKeyUp(e) {
    const action = this.codeToAction.get(e.code);
    if (action) this.held.delete(action);
  }

  axis(pos, neg) { return (this.held.has(pos) ? 1 : 0) - (this.held.has(neg) ? 1 : 0); }

  getInput() {
    const input = {
      throttle: this.axis('forward', 'back'),
      turn: this.axis('turnLeft', 'turnRight'),       // + = turn left (counter-clockwise seen from above)
      vertical: this.axis('ascend', 'descend'),
      arm: {
        yaw: this.axis('yawLeft', 'yawRight'),
        pitch: this.axis('pitchDown', 'pitchUp'),     // + = arm down
        elbow: this.axis('elbowFold', 'elbowExtend'),
        roll: this.axis('rollCcw', 'rollCw'),
        claw: this.axis('clawOpen', 'clawClose')
      },
      resetArm: this.resetQueued
    };
    this.resetQueued = false;
    return input;
  }

  dispose() {
    this.target.removeEventListener('keydown', this._down);
    this.target.removeEventListener('keyup', this._up);
    window.removeEventListener('blur', this._blur);
    this.held.clear();
  }
}
