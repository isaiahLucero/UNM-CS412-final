// Simple chase camera for the sandbox (the real camera is a teammate's job).
// Sits behind/above the submarine using only the public API
// (getPosition / getForward), eases toward that spot, and supports mouse-drag
// orbit and wheel zoom so the arm can be inspected from any side.

import { lookAt, add, lerpVec } from '../src/math/transforms.js';

export class FollowCamera {
  constructor(canvas, { distance = 9, minDistance = 4, maxDistance = 25, pitch = 0.32, floorY = 0 } = {}) {
    this.distance = distance;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.defaultPitch = pitch;
    this.pitch = pitch;           // radians above the horizon
    this.orbit = 0;               // radians around the sub, relative to "behind"
    this.floorY = floorY;
    this.eye = null;
    this.target = null;
    this.stiffness = 5;           // 1/s easing

    let dragging = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
    canvas.addEventListener('pointermove', e => {
      if (!dragging) return;
      this.orbit -= (e.clientX - lx) * 0.006;
      this.pitch = Math.max(-0.3, Math.min(1.35, this.pitch + (e.clientY - ly) * 0.006));
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + e.deltaY * 0.01));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => this.resetView());
  }

  resetView() { this.orbit = 0; this.pitch = this.defaultPitch; }

  update(dt, sub) {
    const pos = sub.getPosition();
    const f = sub.getForward();
    const heading = Math.atan2(-f[0], -f[2]);            // 0 when facing −Z
    const a = heading + this.orbit;
    const back = [Math.sin(a), 0, Math.cos(a)];          // "behind" the sub, rotated by orbit
    const d = this.distance;
    const desiredEye = add(pos, [back[0] * Math.cos(this.pitch) * d, Math.sin(this.pitch) * d + 0.8, back[2] * Math.cos(this.pitch) * d]);
    desiredEye[1] = Math.max(this.floorY + 0.4, desiredEye[1]);
    const desiredTarget = add(pos, [f[0] * 1.5, 0.2, f[2] * 1.5]);

    const t = this.eye ? 1 - Math.exp(-this.stiffness * dt) : 1;
    this.eye = this.eye ? lerpVec(this.eye, desiredEye, t) : desiredEye;
    this.target = this.target ? lerpVec(this.target, desiredTarget, t) : desiredTarget;
    return this.getViewMatrix();
  }

  getViewMatrix() { return lookAt(this.eye, this.target, [0, 1, 0]); }
}
