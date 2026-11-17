// Robotic-arm controller: joint limits, rate-limited targets, smooth motion.
//
// Each joint has a TARGET angle that held keys move at `rate` deg/s, clamped
// to [min, max]. The visible ANGLE follows the target with frame-rate
// independent exponential smoothing, so joints ease in/out and settle softly
// at the limits. Angles are stored in degrees; `sign` maps the human-friendly
// direction (e.g. "pitch +" = arm down) onto the node's rotation axis.

import { ARM_DIMS } from './submarine-model.js';

const DEG = Math.PI / 180;

// Initial values; tune freely. `rest` is the stowed pose used by reset().
export const ARM_JOINT_DEFS = {
  yaw:   { node: 'shoulder', axis: 'y', sign: +1, min: -120, max: 120, rate: 70,  rest: 0   }, // + = left
  pitch: { node: 'upperArm', axis: 'x', sign: -1, min: -15,  max: 100, rate: 55,  rest: -8  }, // + = down
  elbow: { node: 'elbow',    axis: 'x', sign: -1, min: 0,    max: 140, rate: 70,  rest: 135 }, // + = fold
  roll:  { node: 'wrist',    axis: 'z', sign: +1, min: -180, max: 180, rate: 120, rest: 0   }, // + = ccw
  claw:  { node: null,       axis: 'y', sign: +1, min: 0,    max: 35,  rate: 60,  rest: 8   }  // + = open
};

const AXIS_INDEX = { x: 0, y: 1, z: 2 };

export class RoboticArm {
  constructor(nodes, { smoothing = 10, jointDefs = ARM_JOINT_DEFS } = {}) {
    // nodes: { armBase, shoulder, upperArm, elbow, wrist, claw, fingerL, fingerR, clawTip }
    Object.assign(this, nodes);
    this.smoothing = smoothing;   // 1/s; higher = snappier
    this.joints = {};
    for (const [name, def] of Object.entries(jointDefs)) {
      this.joints[name] = { ...def, target: def.rest, angle: def.rest };
    }
    this.apply();
  }

  // axes: { yaw, pitch, elbow, roll, claw } each in [-1, 1] (missing = 0).
  update(dt, axes = {}) {
    const blend = 1 - Math.exp(-this.smoothing * dt);
    for (const [name, j] of Object.entries(this.joints)) {
      const a = Math.max(-1, Math.min(1, axes[name] || 0));
      j.target = Math.max(j.min, Math.min(j.max, j.target + a * j.rate * dt));
      j.angle += (j.target - j.angle) * blend;
    }
    this.apply();
  }

  // Write current angles into the scene-graph nodes.
  apply() {
    for (const j of Object.values(this.joints)) {
      if (!j.node) continue;
      this[j.node].rotation[AXIS_INDEX[j.axis]] = j.sign * j.angle * DEG;
    }
    const spread = this.joints.claw.angle * DEG;
    this.fingerL.rotation[1] = +spread;   // left finger tip swings toward −X
    this.fingerR.rotation[1] = -spread;   // right finger tip swings toward +X
    // Keep clawTip at the midpoint between the two fingertips. The fingers
    // are mirror images, so the midpoint stays on the claw's centre axis
    // and only its depth changes with the spread.
    const { fingerHingeZ, fingerLength } = ARM_DIMS;
    this.clawTip.setTranslation(0, 0, fingerHingeZ - fingerLength * Math.cos(spread));
  }

  // Ease back to the stowed pose (targets jump, angles follow smoothly).
  reset() {
    for (const j of Object.values(this.joints)) j.target = j.rest;
  }

  setTarget(name, degrees) {
    const j = this.joints[name];
    if (j) j.target = Math.max(j.min, Math.min(j.max, degrees));
  }

  // Current (smoothed) angles in degrees, for HUDs/debugging.
  getJointAngles() {
    const out = {};
    for (const [name, j] of Object.entries(this.joints)) out[name] = j.angle;
    return out;
  }

  getClawTipWorldMatrix() { return this.clawTip.getWorldMatrix(); }
  getClawTipPosition() { return this.clawTip.getWorldPosition(); }
}
