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

  // Rocks (squashed spheres)
  for (const [x, z, s, r, m] of [
    [-8, -14, 2.2, 0.4, M.rock], [10, -22, 3.0, 1.2, M.rockDark], [-16, 6, 2.6, 2.0, M.rock],
    [14, 10, 1.6, 0.7, M.rockDark], [3, -40, 4.0, 0.1, M.rock]
  ]) put('sphere', m, translate(x, FLOOR_Y + s * 0.35, z), rotateY(r), scale(s, s * 0.6, s * 0.8));

  return items;
}