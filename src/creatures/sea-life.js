// sea-life.js: turns the creatures (from creatures.js) and the scenery (coral, vents) into drawable pieces.
// Renderer-agnostic, same contract as the submarine module: forEachDrawable hands out
// (meshKey, worldMatrix, material) and the scene's renderer draws them.
// Mesh keys are the shared primitives ('sphere', 'cone', 'cylinder', 'torus', sizes listed at the top of
// src/geometry/primitives.js) plus 'seaVent' from sea-shapes.js, which the scene registers with its renderer.
//
//   const seaLife = createSeaLife();
//   seaLife.addCoral(x, z, floorY);           // scenery: placed once, returns its keep-out zone
//   seaLife.addFish(fish);                    // creatures: drawn wherever fish.matrix says each frame
//   seaLife.forEachDrawable(t, (mesh, matrix, material) => renderer.drawMesh(mesh, matrix, material));

import { compose, translate, scale, rotateX, rotateY, rotateZ } from '../math/transforms.js';
import { cylinderObstacle, sway, bubbleAt } from './creatures.js';

// Materials in the same format the submarine uses: { color, diffuse, specular, shininess, emissive }.
// glow makes it light itself (emissive = color × glow), for the lava, bubbles and jellyfish.
const material = (color, specular = 0.2, shininess = 16, glow = 0) =>
  ({ color, diffuse: 0.85, specular, shininess, emissive: color.map(c => c * glow) });

export const SEA_MATERIALS = {
  blueFish:   material([0.25, 0.5, 0.75], 0.5, 40),
  blueFin:    material([0.2, 0.4, 0.65], 0.3, 24),
  redFish:    material([0.85, 0.4, 0.3], 0.5, 40),
  redFin:     material([0.75, 0.3, 0.2], 0.3, 24),
  tealFish:   material([0.2, 0.62, 0.55], 0.5, 40),
  tealFin:    material([0.15, 0.48, 0.42], 0.3, 24),
  orangeFish: material([0.95, 0.55, 0.2], 0.5, 40),
  yellowFish: material([0.95, 0.75, 0.2], 0.5, 40),
  orangeFin:  material([0.9, 0.5, 0.15], 0.3, 24),
  eye:        material([0.05, 0.05, 0.05], 0.8, 60),
  coralTube:  material([0.65, 0.48, 0.8]),
  coralRim:   material([0.78, 0.62, 0.9]),
  rock:       material([0.42, 0.36, 0.38], 0.1, 12),
  vent:       material([0.26, 0.24, 0.23], 0.1, 12),
  lava:       material([1.0, 0.45, 0.15], 0.0, 1, 0.9),
  bubble:     material([0.75, 0.9, 1.0], 0.6, 60, 0.35),
  jelly:      material([0.85, 0.55, 0.95], 0.4, 30, 0.45),
  tentacle:   material([0.8, 0.5, 0.9], 0.2, 16, 0.45)
};
const M = SEA_MATERIALS;

// [x, z, radius, halfHeight, leanZ, leanX] for each coral tube, measured from the cluster's center
const CORAL_TUBES = [
  [ 0.0,   0.0,  0.32, 0.95,  0.05, -0.05],
  [-0.45,  0.15, 0.26, 0.70,  0.30,  0.10],
  [ 0.45, -0.10, 0.28, 0.80, -0.28, -0.08],
  [-0.15,  0.45, 0.22, 0.50,  0.15,  0.35],
  [ 0.30,  0.40, 0.20, 0.42, -0.20,  0.30],
  [-0.30, -0.40, 0.24, 0.60,  0.12, -0.30]
];
const BUBBLE_COUNT = 14;

// The torus primitive is a fat ring (center circle 0.77, tube 0.32). Scaling it by (w × 1.05) sideways and
// squashing it to w × 0.45 tall turns it into a flat lip that sits just around a tube of radius w.
const lip = w => scale(1.05 * w, 0.45 * w, 1.05 * w);

// Makes an empty collection of sea life. Add scenery and creatures to it, then draw it every frame.
export function createSeaLife() {
  const parts = [];      // { mesh, material, model }: model is a matrix, or a function of time t for moving parts
  const obstacles = [];  // keep-out zones from addCoral / addVent, to hand to the fish
  const add = (mesh, mat, model) => parts.push({ mesh, material: mat, model });

  return {
    obstacles,

    // Fish parts (body, tail, dorsal fin, eyes) built on fish.matrix, so the whole fish follows it.
    // The fish's head points along +x in its own frame. fish.wag swings the tail, fish.size scales it.
    addFish(fish, body = M.blueFish, fin = M.blueFin) {
      const base = () => compose(fish.matrix, scale(fish.size, fish.size, fish.size));
      add('sphere', body, () => compose(base(), scale(1.2, 0.6, 0.45)));
      // Tail: cone flattened into a fin, tip at the body, wagging side to side around that tip
      add('cone', fin, () => compose(base(), translate(-1.0, 0, 0), rotateY(0.35 * Math.sin(fish.wag)),
                                     translate(-0.4, 0, 0), rotateZ(-Math.PI / 2), scale(0.55, 0.4, 0.06)));
      // Dorsal fin: flattened cone sticking out of the back, tilted toward the tail
      add('cone', fin, () => compose(base(), translate(-0.1, 0.7, 0), rotateZ(0.35), scale(0.4, 0.3, 0.04)));
      add('sphere', M.eye, () => compose(base(), translate(0.95, 0.12, 0.27), scale(0.07, 0.07, 0.07)));
      add('sphere', M.eye, () => compose(base(), translate(0.95, 0.12, -0.27), scale(0.07, 0.07, 0.07)));
    },

    // Jellyfish parts built on jelly.matrix: a bell that pulses with jelly.pulse and 8 swaying tentacles.
    // The bell is a squashed sphere (the shared primitives have no dome), raised a little so its
    // lower half tucks behind the tentacles. jelly.size scales the whole jellyfish.
    addJelly(jelly) {
      const base = () => compose(jelly.matrix, scale(jelly.size, jelly.size, jelly.size));
      add('sphere', M.jelly, () => {
        const p = jelly.pulse;  // squeeze in while stretching up, like it's swimming
        return compose(base(), translate(0, 0.1, 0), scale(0.7 * (1 - 0.06 * p), 0.45 * (1 + 0.1 * p), 0.7 * (1 - 0.06 * p)));
      });
      for (let k = 0; k < 8; k++) {
        const angle = k * Math.PI / 4;
        add('cone', M.tentacle, t => compose(
          base(), rotateY(angle), translate(0.5, 0, 0),             // spaced around the inside of the bell's rim
          rotateZ(0.2 * Math.sin(t * 2 + k) - 0.15 * jelly.pulse),  // sway, and pull in when the bell squeezes
          translate(0, -0.45, 0), rotateX(Math.PI),                 // flip so the tip hangs down, top at the pivot
          scale(0.035, 0.45, 0.035)));
      }
    },

    // A coral cluster sitting on the floor at (x, floorY, z): rock mound + swaying tubes with lips.
    // size scales the whole cluster (1 = about 2 m tall). Returns its keep-out zone and also keeps it in obstacles.
    addCoral(x, z, floorY, size = 1) {
      const base = compose(translate(x, floorY, z), scale(size, size, size));
      add('sphere', M.rock, compose(base, scale(0.9, 0.25, 0.75)));
      CORAL_TUBES.forEach(([tx, tz, w, h, leanZ, leanX], i) => {
        // sway (creatures.js) adds a small wobble to each tube's resting lean, pivoting at its base
        // so it stays planted in the mound. The seed (i + x) gives each tube, and each cluster, its own timing.
        const footing = t => {
          const [swayZ, swayX] = sway(t, i + x);
          return compose(base, translate(tx, 0, tz), rotateZ(leanZ + swayZ), rotateX(leanX + swayX));
        };
        add('cylinder', M.coralTube, t => compose(footing(t), translate(0, h, 0), scale(w, h, w)));
        add('torus', M.coralRim, t => compose(footing(t), translate(0, 2 * h, 0), lip(w)));
      });
      // Keep-out zone: 1.2 out from the center covers the mound and leaning tubes,
      // and the tallest tube reaches 2.1 above the floor. Both grow with size.
      const zone = cylinderObstacle(x, z, 1.2 * size, floorY + 2.1 * size);
      obstacles.push(zone);
      return zone;
    },

    // A vent sitting on the floor at (x, floorY, z): rock mound, two tapered chimneys with glowing lips, rising bubbles.
    // The chimneys use 'seaVent' (sea-shapes.js): radius 1 at the bottom, 0.45 at the top, before scaling.
    // size scales the whole vent (1 = about 2.5 m tall). Returns its keep-out zone and also keeps it in obstacles.
    addVent(x, z, floorY, size = 1) {
      const base = compose(translate(x, floorY, z), scale(size, size, size));
      add('sphere', M.rock, compose(base, scale(0.95, 0.3, 0.8)));
      // Main chimney: 0.55 wide at the bottom, so 0.55 × 0.45 ≈ 0.25 at the top, where the lip goes
      add('seaVent', M.vent, compose(base, translate(0, 1.2, 0), scale(0.55, 1.2, 0.55)));
      add('torus', M.lava, compose(base, translate(0, 2.4, 0), lip(0.25)));
      // Side chimney: 0.3 wide at the bottom, 0.3 × 0.45 ≈ 0.135 at the top, leaning out a little
      const side = compose(base, translate(0.55, 0, 0.25), rotateZ(-0.2));
      add('seaVent', M.vent, compose(side, translate(0, 0.55, 0), scale(0.3, 0.55, 0.3)));
      add('torus', M.lava, compose(side, translate(0, 1.1, 0), lip(0.135)));

      // Bubbles out of the main chimney: its lip is 2.4 above the floor (times size), and they rise
      // 4 units (times size) before starting over. bubbleAt (creatures.js) says where each one is.
      const top = [x, floorY + 2.4 * size, z];
      for (let i = 0; i < BUBBLE_COUNT; i++) {
        add('sphere', M.bubble, t => {
          const { pos, radius } = bubbleAt(t, i, BUBBLE_COUNT, top, 4 * size);
          const r = radius * size;
          return compose(translate(...pos), scale(r, r, r));
        });
      }
      // Keep-out zone: centered a little toward the side chimney, 1.1 out covers both chimneys,
      // and the main lip reaches 2.5 above the floor. All grow with size.
      const zone = cylinderObstacle(x + 0.2 * size, z + 0.1 * size, 1.1 * size, floorY + 2.5 * size);
      obstacles.push(zone);
      return zone;
    },

    // Hands every piece to draw(meshKey, worldMatrix, material), same as sub.forEachDrawable.
    // t = seconds since the page started, for the swaying and bubbles.
    forEachDrawable(t, draw) {
      for (const p of parts) draw(p.mesh, typeof p.model === 'function' ? p.model(t) : p.model, p.material);
    }
  };
}