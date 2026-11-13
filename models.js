function createCube() {
  const positions = new Float32Array([
    -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,   // front
     1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1,   // back
    -1,  1,  1,   1,  1,  1,   1,  1, -1,  -1,  1, -1,   // top
    -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,   // bottom
     1, -1,  1,   1, -1, -1,   1,  1, -1,   1,  1,  1,   // right
    -1, -1, -1,  -1, -1,  1,  -1,  1,  1,  -1,  1, -1    // left
  ]);
  const faceNormals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  const normals = new Float32Array(faceNormals.flatMap(n => [...n, ...n, ...n, ...n]));

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3,   // front
     4,  5,  6,   4,  6,  7,   // back
     8,  9, 10,   8, 10, 11,   // top
    12, 13, 14,  12, 14, 15,   // bottom
    16, 17, 18,  16, 18, 19,   // right
    20, 21, 22,  20, 22, 23    // left
  ]);
  return { positions, normals, indices };
}

function createCylinder(segments) {
  const pos = [], nrm = [], idx = [];

  // Side
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
    pos.push(x, -1, z, x, 1, z);
    nrm.push(x, 0, z, x, 0, z);
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }

  // Caps
  for (const y of [-1, 1]) {
    const center = pos.length / 3;
    pos.push(0, y, 0);
    nrm.push(0, y, 0);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pos.push(Math.cos(a), y, Math.sin(a));
      nrm.push(0, y, 0);
    }
    for (let i = 1; i <= segments; i++) {
      if (y > 0) idx.push(center, center + i + 1, center + i);
      else idx.push(center, center + i, center + i + 1);
    }
  }

  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint16Array(idx) };
}

function createSphere(r, vSteps, uSteps){
  const pos = [];
  const idx = [];
  const nrm = [];
  const finalPos = [];

  for(let i = 0; i <= vSteps; i++){
      const v = i * 2 * Math.PI / vSteps;
      const sinv = Math.sin(v);
      const cosv = Math.cos(v);
      for(let j = 0; j <= uSteps; j++){
          const u = j * Math.PI / uSteps;
          const sinu = Math.sin(u);
          const cosu = Math.cos(u); 
          const x = cosu * cosv;
          const y = cosv * sinu;
          const z = sinv;

          //rColor, gColor, bColor
          pos.push([r * x,r * y,r * z]);
      }
  }

  for(let i = 0; i < vSteps; i++){
      for(let j = 0; j < uSteps; j++){
          const k1 = (i * (uSteps + 1)) + j;
          const k2 = k1 + uSteps + 1;
          idx.push(k1, k2, k1 + 1);
          idx.push(k2, k2 + 1, k1 + 1);

          // get normal for two triangle in face
          const n1 = normalVector(pos[k1], pos[k2], pos[k1 + 1]);
          finalPos.push(...pos[k1], ...pos[k1 + 1], ...pos[k2]);
          nrm.push(n1,n1,n1);

          const n2 = normalVector(pos[k1 + 1], pos[k1], pos[k2 + 1]);
          finalPos.push(...pos[k1 + 1], ...pos[k2], ...pos[k2 + 1]);
          nrm.push(n2, n2, n2);
      }
  }

  return { positions: new Float32Array(finalPos), normals: new Float32Array(nrm.flat()), indices: null };
}

function createTorus(R, r, uSteps, vSteps){
  const pos = [];
  const nrm = [];
  const idx = [];

  for(let i = 0; i <= uSteps; i++){
    const u = i * 2 * Math.PI / uSteps;
    const sinu = Math.sin(u);
    const cosu = Math.cos(u);
    for(let j = 0; j <= vSteps; j++){
      const v = j * 2 * Math.PI / vSteps;
      const sinv = Math.sin(v);
      const cosv = Math.cos(v);
      const x = (R + r * cosv) * cosu;
      const y = (R + r * cosv) * sinu;
      const z = r * sinv;

      pos.push([x, y, z]);
    }
  }

  for(let i = 0; i < uSteps; i++){
    for(let j = 0; j < vSteps; j++){
        const k1 = (i * (vSteps + 1)) + j;
        const k2 = (i + 1) * (vSteps + 1) + j;
        idx.push(k1, k1 + 1, k2);
        idx.push(k1 + 1, k2 + 1, k2);
    }
  }

  /*
    Step 1: Calculate the adjacent vertices for each vertex at each index
    Step 2: Add each face normal and save it for ones already calculated
    Step 3: Average each face normal touching the vertex 
  */
  const adjIdx = [];
  // calculate each adjacent vertices
  for(let i = 0; i <= uSteps; i++){
    for(let j = 0; j <= vSteps; j++){
      const rowN = i;
      const colN = (j == 0) ? vSteps : j - 1;

      const rowW = (i == 0) ? uSteps : i - 1;
      const colW = j;

      const rowS = i;
      const colS = (j == vSteps) ? 0 : j + 1; 

      const rowE = (i == uSteps) ? 0 : i + 1;
      const colE = j;

      // Wraps as well
      const numCols = vSteps + 1;
      const idxN = rowN * numCols + colN;
      const idxW = rowW * numCols + colW;
      const idxE = rowE * numCols + colE;
      const idxS = rowS * numCols + colS;
      
      adjIdx.push([idxN, idxW, idxS, idxE]);
    }
  }

  // Compute average for every face normal vertex touches
  for(let i = 0; i < pos.length; i++){
    const neighbN = adjIdx[i][0];
    const neighbW = adjIdx[i][1];
    const neighbS = adjIdx[i][2];
    const neighbE = adjIdx[i][3];
    
    // IMPORTANT: NEED TO BE PRODUCED COUNTER CLOCKWISE TO CENTER
    // so normals don't point inward
    let n1 = normalVector(pos[i], pos[neighbW], pos[neighbN]);
    let n2 = normalVector(pos[i], pos[neighbN], pos[neighbE]);
    let n3 = normalVector(pos[i], pos[neighbE], pos[neighbS]);
    let n4 = normalVector(pos[i], pos[neighbS], pos[neighbW]);

    nrm.push(computeNormal(n1, n2, n3, n4));
  }
  
  return { positions: new Float32Array(pos.flat()), normals: new Float32Array(nrm.flat()), indices: new Uint16Array(idx)};
}

// the length will be the same for all sides
// Segments to be sqared rooted and upper floor
function createSegmentedPlane(segments, length){
  const pos = [];
  const nrm = [];
  const idx = [];
  const sideSeg = Math.ceil(Math.sqrt(segments));
  const segmentLength = length / sideSeg;

  for(i = 0; i <= sideSeg; i++){
    const x = i * segmentLength;
    for(j = 0; j <= sideSeg; j++){
      // y is constantly zero
      const z = j * segmentLength;
      pos.push(x, 0, z);
      nrm.push(0, 1, 0);
    }
  }

  for(let i = 0; i < sideSeg; i++){
    for(let j = 0; j < sideSeg; j++){
      const topLeft = i * (sideSeg + 1) + j;
      const bottomLeft = (i + 1) * (sideSeg + 1) + j;
      const topRight = topLeft + 1;
      const bottomRight = bottomLeft + 1;
      idx.push(topLeft, bottomLeft, topRight);
      idx.push(bottomLeft, bottomRight, topRight);
    }
  }

  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint16Array(idx)};
}

function computeNormal(n1, n2, n3, n4){
  const x = n1[0] + n2[0] + n3[0] +  n4[0];
  const y = n1[1] + n2[1] + n3[1] +  n4[1];
  const z = n1[2] + n2[2] + n3[2] +  n4[2];

  let mtg = Math.sqrt(x * x + y * y + z * z);
  
  if(mtg == 0) return;
  return [x / mtg, y / mtg, z / mtg];
}
