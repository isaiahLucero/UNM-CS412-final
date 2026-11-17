// Sandbox props: a flat seafloor with grid lines plus a few reference objects
// for judging speed, turning and depth. Placeholders only — the real ocean
// scene, fish and coral belong to teammates.

import { compose, translate, scale, rotateY, rotateZ } from '../src/math/transforms.js';

export const FLOOR_Y = 0;

const mat = (color, diffuse = 0.85, specular = 0.15, shininess = 16, emissive = [0, 0, 0]) =>
  ({ color, diffuse, specular, shininess, emissive });

const M = {
  sand: mat([0.55, 0.50, 0.38], 0.9, 0.05, 8),
  grid: mat([0.38, 0.35, 0.27], 0.9, 0.02, 8),
  rock: mat([0.36, 0.34, 0.33], 0.9, 0.10, 12),
  rockDark: mat([0.24, 0.25, 0.27], 0.9, 0.10, 12),
  pillar: mat([0.30, 0.45, 0.50], 0.85, 0.30, 30),
  coral: mat([0.90, 0.38, 0.35], 0.85, 0.20, 20),
  coral2: mat([0.85, 0.55, 0.85], 0.85, 0.20, 20),
  crate: mat([0.55, 0.38, 0.20], 0.85, 0.15, 16),
  buoy: mat([0.95, 0.35, 0.10], 0.8, 0.6, 50, [0.12, 0.03, 0.0])
};

// Returns [{ mesh, matrix, material }]; static, so built once.
export function buildTestScene() {
  const items = [];
  const put = (mesh, material, ...m) => items.push({ mesh, material, matrix: compose(...m) });

  // Seafloor: one big slab (top face at FLOOR_Y) + grid lines every 5 m.
  const SIZE = 120, STEP = 5;
  put('cube', M.sand, translate(0, FLOOR_Y - 0.5, 0), scale(SIZE, 0.5, SIZE));
  for (let x = -SIZE; x <= SIZE; x += STEP) {
    put('cube', M.grid, translate(x, FLOOR_Y + 0.005, 0), scale(0.04, 0.005, SIZE));
    put('cube', M.grid, translate(0, FLOOR_Y + 0.005, x), scale(SIZE, 0.005, 0.04));
  }

  // SeaTop : 
  put('plane', M.grid, translate(0, 42, 0), scale(SIZE, 0.5, SIZE));
  for(let x = -SIZE; x <= SIZE; x += STEP) {
    put('cube', M.grid, translate(x, 42 + 0.0005, 0), scale(0.04, 0.005, SIZE));
    put('cube', M.grid, translate(0, 42 + 0.005, x), scale(SIZE, 0.005, 0.04));
  }

  // Rocks (squashed spheres)
  for (const [x, z, s, r, m] of [
    [-8, -14, 2.2, 0.4, M.rock], [10, -22, 3.0, 1.2, M.rockDark], [-16, 6, 2.6, 2.0, M.rock],
    [14, 10, 1.6, 0.7, M.rockDark], [3, -40, 4.0, 0.1, M.rock]
  ]) put('sphere', m, translate(x, FLOOR_Y + s * 0.35, z), rotateY(r), scale(s, s * 0.6, s * 0.8));

  // Pillars at different heights (good depth/turn references)
  for (const [x, z, h] of [[-5, -28, 6], [6, -6, 3.5], [-20, -20, 9], [22, -30, 5]])
    put('cylinder', M.pillar, translate(x, FLOOR_Y + h / 2, z), scale(0.6, h / 2, 0.6));

  // "Coral" cones
  for (const [x, z, h, m] of [[-3, -10, 1.6, M.coral], [-2.2, -10.8, 1.1, M.coral2], [8, -15, 2.0, M.coral], [-12, -4, 1.4, M.coral2]])
    put('cone', m, translate(x, FLOOR_Y + h / 2, z), scale(0.35, h / 2, 0.35));

  // A crate on the floor (future grab target) and a floating buoy at mid-depth.
  put('cube', M.crate, translate(2, FLOOR_Y + 0.35, -12), rotateY(0.5), scale(0.35, 0.35, 0.35));
  put('sphere', M.buoy, translate(-6, 7, -18), scale(0.6, 0.6, 0.6));
  put('cylinder', M.rockDark, translate(-6, 3.3, -18), rotateZ(0.02), scale(0.03, 3.3, 0.03));

  return items;
}
