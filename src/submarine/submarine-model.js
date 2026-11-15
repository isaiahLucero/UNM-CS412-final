// Builds the submarine's node hierarchy from placeholder primitives.
//
// Coordinate convention (see README.md): +Y up, forward = −Z, right = +X,
// units ≈ metres, origin = hull centre. Canonical primitive sizes are listed
// in src/geometry/primitives.js (cube = [-1,1]^3, cylinder axis = +Y, ...).
//
// submarine (root)
// └─ hull
//    ├─ (decoration: nose, viewport, tail, tower, fins)
//    ├─ propeller            spins about local Z
//    │  └─ hub, blade0..2
//    ├─ lightMount           origin = lens, local −Z = beam direction
//    └─ armBase
//       └─ shoulder          YAW   (rotation.y)
//          └─ upperArm       PITCH (rotation.x)
//             └─ elbow       PITCH (rotation.x), carries the forearm
//                └─ wrist    ROLL  (rotation.z, about the forearm axis)
//                   └─ claw
//                      ├─ fingerL, fingerR   spread (rotation.y, mirrored)
//                      └─ clawTip            empty grab point between fingertips

import { Node } from './scene-node.js';
import { compose, translate, scale, rotateX, rotateY } from '../math/transforms.js';

const HALF_PI = Math.PI / 2;

// Materials use the CS412 hw5 shape so the sandbox shader can consume them
// directly; a teammate's renderer is free to map them to anything else.
export const material = (color, diffuse = 0.8, specular = 0.3, shininess = 32, emissive = [0, 0, 0]) =>
  ({ color, diffuse, specular, shininess, emissive });

export const SUB_MATERIALS = {
  hull:    material([0.95, 0.70, 0.16], 0.85, 0.45, 40),
  hullDark: material([0.20, 0.24, 0.30], 0.80, 0.30, 30),
  window:  material([0.20, 0.55, 0.75], 0.60, 0.90, 90, [0.02, 0.08, 0.12]),
  bronze:  material([0.80, 0.52, 0.25], 0.80, 0.80, 64),
  lens:    material([1.00, 0.96, 0.80], 0.20, 0.20, 16, [1.0, 0.95, 0.75]),
  armMetal: material([0.55, 0.62, 0.70], 0.80, 0.70, 60),
  joint:   material([0.75, 0.80, 0.86], 0.70, 1.00, 90),
  claw:    material([0.18, 0.20, 0.24], 0.90, 0.25, 20)
};

// Mesh-only node (no joint of its own beyond an optional fixed offset).
function part(name, mesh, mat, shape, opts = {}) {
  return new Node(name, { mesh, material: mat, shape, ...opts });
}

// Arm dimensions, exported so the arm controller can keep clawTip exact.
export const ARM_DIMS = {
  upperArmLength: 0.9,
  forearmLength: 0.7,
  wristToClaw: 0.12,
  fingerOffsetX: 0.1,   // finger hinge distance from claw centre
  fingerHingeZ: -0.1,   // finger hinge position along claw −Z
  fingerLength: 0.36    // hinge → fingertip
};

export function buildSubmarineModel() {
  const M = SUB_MATERIALS;
  const D = ARM_DIMS;

  const root = new Node('submarine');
  const hull = root.addChild(part('hull', 'cylinder', M.hull,
    compose(rotateX(HALF_PI), scale(0.7, 1.5, 0.7))));            // z ∈ [-1.5, 1.5]

  // --- fixed decoration ----------------------------------------------------
  hull.addChild(part('nose', 'sphere', M.hull,
    compose(translate(0, 0, -1.5), scale(0.7, 0.7, 0.6))));
  hull.addChild(part('viewport', 'sphere', M.window,
    compose(translate(0, 0.12, -1.95), scale(0.32, 0.28, 0.2))));
  hull.addChild(part('tail', 'cone', M.hull,
    compose(translate(0, 0, 1.95), rotateX(HALF_PI), scale(0.7, 0.45, 0.7))));
  hull.addChild(part('tower', 'cube', M.hull,
    compose(translate(0, 0.9, -0.2), scale(0.22, 0.28, 0.55))));
  hull.addChild(part('towerCap', 'cube', M.hullDark,
    compose(translate(0, 1.19, -0.2), scale(0.23, 0.02, 0.56))));
  hull.addChild(part('finVertical', 'cube', M.hullDark,
    compose(translate(0, 0.55, 1.75), scale(0.03, 0.35, 0.25))));
  hull.addChild(part('finHorizontal', 'cube', M.hullDark,
    compose(translate(0, 0, 1.75), scale(0.95, 0.03, 0.2))));

  // --- propeller (spins about its local Z) ---------------------------------
  const propeller = hull.addChild(new Node('propeller', { translation: [0, 0, 2.45] }));
  propeller.addChild(part('propHub', 'cylinder', M.bronze,
    compose(rotateX(HALF_PI), scale(0.08, 0.1, 0.08))));
  for (let i = 0; i < 3; i++) {
    const blade = propeller.addChild(new Node(`blade${i}`, { rotation: [0, 0, (i * 2 * Math.PI) / 3] }));
    blade.mesh = 'cube';
    blade.material = M.bronze;
    blade.shape = compose(translate(0, 0.24, 0), rotateY(0.45), scale(0.08, 0.17, 0.012));
  }

  // --- light mount: origin at the lens face, beam along local −Z ------------
  const lightMount = hull.addChild(new Node('lightMount', {
    translation: [0, 0.48, -1.8],
    rotation: [-0.2, 0, 0]                       // tilted ~11° down
  }));
  lightMount.addChild(part('lightHousing', 'cylinder', M.hullDark,
    compose(translate(0, 0, 0.12), rotateX(HALF_PI), scale(0.12, 0.12, 0.12))));
  lightMount.addChild(part('lightLens', 'cylinder', M.lens,
    compose(translate(0, 0, -0.005), rotateX(HALF_PI), scale(0.095, 0.01, 0.095))));

  // --- robotic arm ------------------------------------------------------------
  const armBase = hull.addChild(part('armBase', 'cylinder', M.hullDark,
    compose(translate(0, -0.08, 0), scale(0.18, 0.08, 0.18)),
    { translation: [0, -0.68, -1.2] }));

  const shoulder = armBase.addChild(part('shoulder', 'sphere', M.joint,
    scale(0.14, 0.14, 0.14), { translation: [0, -0.2, 0] }));

  const upperArm = shoulder.addChild(part('upperArm', 'cube', M.armMetal,
    compose(translate(0, 0, -D.upperArmLength / 2), scale(0.07, 0.07, D.upperArmLength / 2))));

  const elbow = upperArm.addChild(part('elbow', 'cube', M.armMetal,
    compose(translate(0, 0, -D.forearmLength / 2), scale(0.055, 0.055, D.forearmLength / 2)),
    { translation: [0, 0, -D.upperArmLength] }));
  elbow.addChild(part('elbowBearing', 'sphere', M.joint, scale(0.1, 0.1, 0.1)));

  const wrist = elbow.addChild(part('wrist', 'cylinder', M.joint,
    compose(translate(0, 0, -0.05), rotateX(HALF_PI), scale(0.075, 0.05, 0.075)),
    { translation: [0, 0, -D.forearmLength] }));

  const claw = wrist.addChild(part('claw', 'cube', M.claw,
    compose(translate(0, 0, -0.05), scale(0.14, 0.045, 0.05)),
    { translation: [0, 0, -D.wristToClaw] }));

  const makeFinger = (name, side) => {
    const finger = claw.addChild(part(name, 'cube', M.claw,
      compose(translate(0, 0, -D.fingerLength / 2), scale(0.022, 0.04, D.fingerLength / 2)),
      { translation: [side * D.fingerOffsetX, 0, D.fingerHingeZ] }));
    // small inward-pointing tip pad
    finger.addChild(part(`${name}Tip`, 'cube', M.armMetal,
      compose(translate(-side * 0.025, 0, -D.fingerLength + 0.02), scale(0.035, 0.035, 0.02))));
    return finger;
  };
  const fingerL = makeFinger('fingerL', -1);
  const fingerR = makeFinger('fingerR', +1);

  // Empty grab point; RoboticArm keeps it at the fingertip midpoint.
  const clawTip = claw.addChild(new Node('clawTip', {
    translation: [0, 0, D.fingerHingeZ - D.fingerLength]
  }));

  return {
    root, hull, propeller, lightMount,
    arm: { armBase, shoulder, upperArm, elbow, wrist, claw, fingerL, fingerR, clawTip }
  };
}
