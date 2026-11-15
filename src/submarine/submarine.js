// Submarine: movement physics, propeller, robotic arm and the public API.
// Renderer-agnostic: no GL calls; see forEachDrawable() for drawing.

import { Node } from './scene-node.js';
import { buildSubmarineModel } from './submarine-model.js';
import { RoboticArm } from './robotic-arm.js';
import { transformDirection, normalize, getTranslation } from '../math/transforms.js';

export const SUBMARINE_DEFAULTS = {
  thrustAccel: 3.2,       // m/s² at full throttle (W/S)
  verticalAccel: 2.4,     // m/s² at full ascend/descend (Space/Shift)
  turnAccel: 2.4,         // rad/s² at full turn (A/D)
  forwardDamping: 0.8,    // 1/s along the hull's heading → top speed ≈ thrustAccel / forwardDamping
  lateralDamping: 4.0,    // 1/s sideways; much stronger so the sub doesn't slide after turning
  verticalDamping: 1.2,   // 1/s on world Y
  angularDamping: 2.6,    // 1/s on yaw rate
  maxPropRate: 18,        // rad/s propeller speed at full throttle
  propResponse: 2.5,      // 1/s how quickly the propeller spins up / coasts down
  bounds: { minY: -Infinity, maxY: Infinity }   // world-Y limits for the root (e.g. seafloor)
};

export class Submarine {
  constructor({ position = [0, 0, 0], heading = 0, ...options } = {}) {
    this.params = { ...SUBMARINE_DEFAULTS, ...options,
      bounds: { ...SUBMARINE_DEFAULTS.bounds, ...(options.bounds || {}) } };

    const model = buildSubmarineModel();
    /** @type {Node} */ this.root = model.root;
    this.hull = model.hull;
    this.propeller = model.propeller;
    this.lightMount = model.lightMount;
    this.arm = new RoboticArm(model.arm);

    this.position = [...position];
    this.velocity = [0, 0, 0];
    this.heading = heading;     // radians about +Y; 0 = facing −Z, + = turned left
    this.yawRate = 0;
    this.propAngle = 0;
    this.propRate = 0;
    this.throttle = 0;

    this.syncRoot();
    this.root.updateWorldMatrix();
  }

  // input: see submarine-controls.js. parentMatrix: optional world matrix of
  // whatever the submarine is attached to in a larger scene graph.
  update(dt, input = {}, parentMatrix = null) {
    const p = this.params;
    const throttle = clamp1(input.throttle);
    const turn = clamp1(input.turn);
    const vertical = clamp1(input.vertical);
    this.throttle = throttle;

    // --- yaw -----------------------------------------------------------------
    this.yawRate += turn * p.turnAccel * dt;
    this.yawRate *= Math.exp(-p.angularDamping * dt);
    this.heading += this.yawRate * dt;

    // --- linear --------------------------------------------------------------
    const f = this.getHeadingForward();          // horizontal forward (heading only)
    const r = [-f[2], 0, f[0]];                  // right = forward × up
    const v = this.velocity;
    v[0] += f[0] * throttle * p.thrustAccel * dt;
    v[2] += f[2] * throttle * p.thrustAccel * dt;
    v[1] += vertical * p.verticalAccel * dt;

    // Damping split relative to the hull: forward / lateral / vertical.
    const vf = (v[0] * f[0] + v[2] * f[2]) * Math.exp(-p.forwardDamping * dt);
    const vr = (v[0] * r[0] + v[2] * r[2]) * Math.exp(-p.lateralDamping * dt);
    v[0] = f[0] * vf + r[0] * vr;
    v[2] = f[2] * vf + r[2] * vr;
    v[1] *= Math.exp(-p.verticalDamping * dt);

    for (let i = 0; i < 3; i++) this.position[i] += v[i] * dt;
    const { minY, maxY } = p.bounds;
    if (this.position[1] < minY) { this.position[1] = minY; if (v[1] < 0) v[1] = 0; }
    if (this.position[1] > maxY) { this.position[1] = maxY; if (v[1] > 0) v[1] = 0; }

    // --- propeller: follows throttle, coasts down, reverses on S --------------
    const targetRate = throttle * p.maxPropRate;
    this.propRate += (targetRate - this.propRate) * (1 - Math.exp(-p.propResponse * dt));
    this.propAngle = (this.propAngle + this.propRate * dt) % (2 * Math.PI);

    // --- arm -----------------------------------------------------------------
    if (input.resetArm) this.arm.reset();
    this.arm.update(dt, input.arm || {});

    this.syncRoot();
    this.root.updateWorldMatrix(parentMatrix);
  }

  syncRoot() {
    this.root.setTranslation(...this.position);
    this.root.setRotation(0, this.heading, 0);
    // Negative so a positive throttle turns the blades clockwise seen from behind.
    this.propeller.rotation[2] = -this.propAngle;
  }

  // ---------------------------------------------------------------- public API
  getWorldMatrix() { return this.root.getWorldMatrix(); }

  getPosition() { return getTranslation(this.root.getWorldMatrix()); }

  // Unit forward vector in world space (the root's local −Z).
  getForward() { return normalize(transformDirection(this.root.getWorldMatrix(), [0, 0, -1])); }

  // Origin = light lens; local −Z = beam direction; local +Y = beam "up".
  getLightMountWorldMatrix() { return this.lightMount.getWorldMatrix(); }

  getVelocity() { return [...this.velocity]; }
  getSpeed() { return Math.hypot(...this.velocity); }

  // Calls fn(meshKey, worldMeshMatrix, material, node) for every visible part.
  forEachDrawable(fn) {
    const visit = node => {
      if (!node.visible) return;
      if (node.mesh) fn(node.mesh, node.getMeshMatrix(), node.material, node);
      for (const child of node.children) visit(child);
    };
    visit(this.root);
  }

  // Horizontal forward from heading alone (the root's local frame before any parent).
  getHeadingForward() { return [-Math.sin(this.heading), 0, -Math.cos(this.heading)]; }
}

function clamp1(x) { return Math.max(-1, Math.min(1, Number(x) || 0)); }
