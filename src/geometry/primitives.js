// Primitive mesh generators — ES-module port of CS412 hw6/models.js.
// Pure data (no GL): each returns { positions, normals, tangents, texCoords,
// indices: Uint16Array }. Canonical sizes, used when choosing `shape` scales:
//   cube      [-1,1]^3              (scale = half-extents)
//   cylinder  radius 1, y in [-1,1] (axis = +Y)
//   sphere    radius 1
//   cone      base radius 1 at y=-1, apex at y=+1
//   torus     major 0.77, tube 0.32, in the XZ plane
//   plane     lies on XZ plane, length for each side = 60
function packMesh(pos, nrm, tan, uv, idx) {
  return {
    positions: new Float32Array(pos), normals: new Float32Array(nrm),
    tangents: new Float32Array(tan), texCoords: new Float32Array(uv),
    indices: new Uint16Array(idx)
  };
}

export function createCube() {
  // 24 vertices (four per face) avoid seams across planar UV faces.
  const faces = [
    { n:[0,0,1],  t:[1,0,0],  corners:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]] },
    { n:[0,0,-1], t:[-1,0,0], corners:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]] },
    { n:[0,1,0],  t:[1,0,0],  corners:[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]] },
    { n:[0,-1,0], t:[1,0,0],  corners:[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]] },
    { n:[1,0,0],  t:[0,0,-1], corners:[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]] },
    { n:[-1,0,0], t:[0,0,1],  corners:[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]] }
  ];
  const p=[], n=[], t=[], u=[], ind=[];
  for (let f=0; f<faces.length; f++) {
    const face=faces[f];
    for (let j=0; j<4; j++) {
      p.push(...face.corners[j]); n.push(...face.n); t.push(...face.t);
      u.push((j===1||j===2)?1:0, j>=2?1:0);
    }
    const b=4*f; ind.push(b,b+1,b+2,b,b+2,b+3);
  }
  return packMesh(p,n,t,u,ind);
}

export function createCylinder(segments=64, repeats=2) {
  const p=[],n=[],t=[],u=[],ind=[];
  for(let i=0;i<=segments;i++) {
    const a=2*Math.PI*i/segments, s=Math.sin(a), c=Math.cos(a);
    for(const y of [-1,1]) {
      p.push(s,y,c); n.push(s,0,c); t.push(c,0,-s);
      u.push(i/segments*repeats,(y+1)/2);
    }
  }
  for(let i=0;i<segments;i++) {
    const a=2*i; ind.push(a,a+2,a+3, a,a+3,a+1);
  }
  for(const y of [1,-1]) {
    const base=p.length/3;
    p.push(0,y,0); n.push(0,y,0); t.push(1,0,0); u.push(.5,.5);
    for(let i=0;i<=segments;i++) {
      const a=2*Math.PI*i/segments, s=Math.sin(a), c=Math.cos(a);
      p.push(s,y,c); n.push(0,y,0); t.push(1,0,0);
      u.push(.5+.5*s,.5-.5*y*c);
    }
    for(let i=0;i<segments;i++) {
      const a=base+i+1,b=a+1;
      if(y>0)ind.push(base,a,b); else ind.push(base,b,a);
    }
  }
  return packMesh(p,n,t,u,ind);
}

export function createSphere(slices=72, stacks=44) {
  const p=[],n=[],t=[],u=[],ind=[];
  for(let j=0;j<=stacks;j++) {
    const phi=Math.PI*j/stacks, sp=Math.sin(phi),cp=Math.cos(phi);
    for(let i=0;i<=slices;i++) {
      const th=2*Math.PI*i/slices,ct=Math.cos(th),st=Math.sin(th);
      const x=sp*ct,y=cp,z=sp*st;
      p.push(x,y,z); n.push(x,y,z); t.push(-st,0,ct);
      u.push(i/slices*1.7,j/stacks); // +V follows increasing polar angle (B = N cross T)
    }
  }
  const w=slices+1;
  for(let j=0;j<stacks;j++)for(let i=0;i<slices;i++) {
    const a=j*w+i,b=a+w;
    // Derivatives with v going from north to south have inward cross(dU,dV).
    // Use reversed order for outward winding.
    ind.push(a,a+1,b,a+1,b+1,b);
  }
  return packMesh(p,n,t,u,ind);
}

export function createTorus(major=0.77, tube=0.32, segments=78, sides=28) {
  const p=[],n=[],t=[],u=[],ind=[];
  for(let i=0;i<=segments;i++) {
    const a=2*Math.PI*i/segments, ca=Math.cos(a),sa=Math.sin(a);
    for(let j=0;j<=sides;j++) {
      const b=2*Math.PI*j/sides,cb=Math.cos(b),sb=Math.sin(b);
      const r=major+tube*cb;
      p.push(r*ca,tube*sb,r*sa);
      n.push(cb*ca,sb,cb*sa); t.push(-sa,0,ca);
      u.push(i/segments*3,1-j/sides);
    }
  }
  const w=sides+1;
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++) {
    const a=i*w+j,b=a+w;
    ind.push(a,a+1,b,a+1,b+1,b);
  }
  return packMesh(p,n,t,u,ind);
}

export function createCone(segments=72, levels=32) {
  const p=[],n=[],t=[],u=[],ind=[];
  for(let j=0;j<=levels;j++) {
    const h=j/levels,r=Math.max(.003,1-h);
    for(let i=0;i<=segments;i++) {
      const a=2*Math.PI*i/segments, s=Math.sin(a),c=Math.cos(a);
      p.push(r*c,-1+2*h,r*s);
      // Surface tangent and normals for cone with radius 1 and height 2
      const k=1/Math.sqrt(1.25);
      n.push(c*k,.5*k,s*k); t.push(-s,0,c);
      u.push(i/segments*2,h);
    }
  }
  const w=segments+1;
  for(let j=0;j<levels;j++)for(let i=0;i<segments;i++) {
    const a=j*w+i,b=a+w;
    // dHeight x dTheta points outward on the cone
    ind.push(a,b,a+1,a+1,b,b+1);
  }
  const center=p.length/3;
  p.push(0,-1,0);n.push(0,-1,0);t.push(1,0,0);u.push(.5,.5);
  for(let i=0;i<=segments;i++) {
    const a=2*Math.PI*i/segments;
    p.push(Math.cos(a),-1,Math.sin(a));n.push(0,-1,0);
    t.push(1,0,0);u.push(.5+.5*Math.cos(a),.5+.5*Math.sin(a));
  }
  for(let i=0;i<segments;i++) ind.push(center,center+i+1,center+i+2);
  return packMesh(p,n,t,u,ind);
}

export function createPlane(segments=10000, length=64){
  const p=[],n=[],t=[],u=[],ind=[];
  const sideSeg = Math.ceil(Math.sqrt(segments)); // Segment length for each side
  const segmentLength = length / sideSeg;

  for(i = 0; i <= sideSeg; i++){
    const x = i * segmentLength;
    for(j = 0; j <= sideSeg; j++){
      const z = j * segmentLength;
      p.push(x, 0, z); // y is constantly zero
      n.push(0, 1, 0);  t.push(0,0,0); u.push(0,0,0);
    }
  }

  for(let i = 0; i < sideSeg; i++){
    for(let j = 0; j < sideSeg; j++){
      const topLeft = i * (sideSeg + 1) + j;
      const bottomLeft = (i + 1) * (sideSeg + 1) + j;
      const topRight = topLeft + 1;
      const bottomRight = bottomLeft + 1;
      ind.push(topLeft, bottomLeft, topRight);
      ind.push(bottomLeft, bottomRight, topRight);
    }
  }

  return packMesh(p,n,t,u,ind);
}
