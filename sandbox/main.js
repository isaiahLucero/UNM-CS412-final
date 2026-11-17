// Sandbox entry: wires the submarine module to a throwaway renderer, camera
// and test scene. Nothing in src/ imports from here.

import { Submarine, KeyboardControls } from '../src/submarine/index.js';
import { compose, translate, scale, rotateX, add } from '../src/math/transforms.js';
import { createRenderer } from './renderer.js';
import { FollowCamera } from './follow-camera.js';
import { buildTestScene, FLOOR_Y } from './test-objects.js';

const canvas = document.getElementById('glcanvas');
const fatal = document.getElementById('fatal');

let renderer;
try {
  renderer = createRenderer(canvas);
} catch (err) {
  fatal.style.display = 'grid';
  fatal.textContent = err.message;
  throw err;
}

const sub = new Submarine({
  position: [0, 4, 6],
  bounds: { minY: FLOOR_Y + 1.9, maxY: 40 }   // keep the stowed arm off the sandbox floor
});
const controls = new KeyboardControls();
const camera = new FollowCamera(canvas, { floorY: FLOOR_Y });
const scene = buildTestScene();

const debugToggle = document.getElementById('showDebug');
const markerMat = (emissive) => ({ color: [0, 0, 0], diffuse: 0, specular: 0, shininess: 1, emissive });
const CLAW_TIP_MAT = markerMat([0.2, 1.0, 0.9]);
const BEAM_MAT = markerMat([1.0, 0.9, 0.5]);

const hud = {
  speed: document.getElementById('hudSpeed'),
  depth: document.getElementById('hudDepth'),
  heading: document.getElementById('hudHeading'),
  prop: document.getElementById('hudProp'),
  joints: document.getElementById('hudJoints'),
  tip: document.getElementById('hudTip')
};
const fmt = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const PAD = 7;

function updateHud() {
  const pos = sub.getPosition();
  const f = sub.getForward();
  const deg = ((Math.atan2(-f[0], -f[2]) * 180 / Math.PI) + 360) % 360;
  hud.speed.textContent = `${sub.getSpeed().toFixed(2)} m/s`;
  hud.depth.textContent = `${pos[1].toFixed(1)} m above floor`;
  hud.heading.textContent = `${deg.toFixed(0)}°`;
  hud.prop.textContent = `${sub.propRate.toFixed(1)} rad/s`;
  const j = sub.arm.getJointAngles();
  hud.joints.textContent =
    `yaw   ${fmt(j.yaw).padStart(PAD)}°\npitch ${fmt(j.pitch).padStart(PAD)}°\n` +
    `elbow ${fmt(j.elbow).padStart(PAD)}°\nroll  ${fmt(j.roll).padStart(PAD)}°\nclaw  ${fmt(j.claw).padStart(PAD)}°`;
  hud.tip.textContent = sub.arm.getClawTipPosition().map(v => v.toFixed(2)).join(', ');
}

let last = 0, hudTimer = 0;
function frame(ms) {
  const t = ms / 1000;
  const dt = Math.min(0.05, last ? t - last : 0);
  last = t;

  sub.update(dt, controls.getInput());
  const view = camera.update(dt, sub);

  // Sandbox lights ride along with the sub so it's always readable.
  const p = sub.getPosition();
  renderer.beginFrame(view, [
    { position: add(p, [6, 10, 5]), color: [1.0, 0.92, 0.8] },
    { position: add(p, [-8, 4, -7]), color: [0.35, 0.6, 0.9] }
  ]);

  for (const item of scene) renderer.drawMesh(item.mesh, item.matrix, item.material);
  sub.forEachDrawable((mesh, matrix, material) => renderer.drawMesh(mesh, matrix, material));

  if (debugToggle.checked) {
    // Claw grab point and light-mount beam axis, drawn from the public API only.
    const tip = sub.arm.getClawTipPosition();
    renderer.drawMesh('sphere', compose(translate(...tip), scale(0.045, 0.045, 0.045)), CLAW_TIP_MAT);
    renderer.drawMesh('cylinder',
      compose(sub.getLightMountWorldMatrix(), translate(0, 0, -1.5), rotateX(Math.PI / 2), scale(0.012, 1.5, 0.012)),
      BEAM_MAT);
  }

  hudTimer -= dt;
  if (hudTimer <= 0) { updateHud(); hudTimer = 0.1; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Let teammates poke at it from the console: window.sub.getForward(), etc.
window.sub = sub;
