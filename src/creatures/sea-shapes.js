// sea-shapes.js: shapes the sea life needs that the shared primitives don't have. Data only (no GL),
// same format as src/geometry/primitives.js: { positions, normals, tangents, texCoords, indices }.
// The scene registers them with its renderer once: for each [key, data] of SEA_MESHES, renderer.addMesh(key, data).

// Converts the plain arrays into the typed arrays the GPU needs.
function packMesh(positions, normals, tangents, texCoords, indices) {
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    texCoords: new Float32Array(texCoords),
    indices: new Uint16Array(indices)
  };
}


// Cone: a top ring and a bottom ring joined by triangles (open, no caps).
// topRadius 0 = pointed (fish tail, tentacles), smaller = vent, bigger = coral tube, equal = cylinder.
export function createSeaCone(uSteps = 64, bottomRadius = 1, topRadius = 0.5, uRepeat = 3) {
  const positions = [], normals = [], tangents = [], texCoords = [], indices = [];
  const ringHeights = [1, -1];            // top ring, bottom ring
  const ringRadii = [topRadius, bottomRadius];
  const lean = (bottomRadius - topRadius) / 2;  // how far the side moves in per 1 unit up

  for (let ring = 0; ring < 2; ring++) {
    const y = ringHeights[ring];
    const ringRadius = ringRadii[ring];

    for (let j = 0; j <= uSteps; j++) {
      const u = j * 2 * Math.PI / uSteps;
      const x = ringRadius * Math.sin(u);
      const z = ringRadius * Math.cos(u);
      positions.push(x, y, z);

      // Normal: point out like a cylinder, tip up by the lean, then make it length 1
      const nx = Math.sin(u), ny = lean, nz = Math.cos(u);
      const length = Math.hypot(nx, ny, nz);
      normals.push(nx / length, ny / length, nz / length);

      tangents.push(Math.cos(u), 0, -Math.sin(u));
      texCoords.push(j / uSteps * uRepeat, 1 - ring);  // top ring = 1, bottom ring = 0
    }
  }

  const cols = uSteps + 1;
  for (let j = 0; j < uSteps; j++) {
    const k1 = j;                         // point on the top ring
    const k2 = k1 + cols;                 // point right below it on the bottom ring
    indices.push(k1, k2, k1 + 1);
    indices.push(k2, k2 + 1, k1 + 1);
  }
  return packMesh(positions, normals, tangents, texCoords, indices);
}

// Keys are what sea-life.js asks the renderer to draw.
export const SEA_MESHES = {
  seaVent: createSeaCone(48, 1, 0.45, 2)   // vent chimney: open, radius 1 at the bottom, 0.45 at the top
};