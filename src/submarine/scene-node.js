// Scene-graph node with local translation / rotation / scale.
//
//   local = T · Ry · Rx · Rz · S        (yaw, then pitch, then roll)
//   world = parentWorld · local
//
// Two matrices per node, following the CS412 hw5 hierarchy rule:
//   * the joint frame (TRS above) is inherited by every child;
//   * `shape` sizes/offsets only this node's own mesh and is NOT inherited,
//     so a long thin arm segment never shears the parts attached to it.
// Nodes without a mesh are pure frames (pivots, attachment points).

import { compose, identity, multiply, translate, scale, rotateX, rotateY, rotateZ, transformPoint }
  from '../math/transforms.js';

export class Node {
  constructor(name, {
    translation = [0, 0, 0],
    rotation = [0, 0, 0],      // Euler angles in radians [x=pitch, y=yaw, z=roll]
    scale: s = [1, 1, 1],
    mesh = null,               // mesh key: 'cube' | 'cylinder' | 'sphere' | 'cone' | 'torus' | null
    shape = identity(),        // mesh-only transform (not inherited)
    material = null
  } = {}) {
    this.name = name;
    this.translation = [...translation];
    this.rotation = [...rotation];
    this.scale = [...s];
    this.mesh = mesh;
    this.shape = shape;
    this.material = material;
    this.visible = true;
    this.parent = null;
    this.children = [];
    this.localMatrix = identity();
    this.worldMatrix = identity();
  }

  addChild(child) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) { this.children.splice(i, 1); child.parent = null; }
  }

  setTranslation(x, y, z) { this.translation[0] = x; this.translation[1] = y; this.translation[2] = z; return this; }
  setRotation(x, y, z) { this.rotation[0] = x; this.rotation[1] = y; this.rotation[2] = z; return this; }
  setScale(x, y, z) { this.scale[0] = x; this.scale[1] = y; this.scale[2] = z; return this; }

  updateLocalMatrix() {
    const [tx, ty, tz] = this.translation;
    const [rx, ry, rz] = this.rotation;
    const [sx, sy, sz] = this.scale;
    this.localMatrix = compose(translate(tx, ty, tz), rotateY(ry), rotateX(rx), rotateZ(rz), scale(sx, sy, sz));
    return this.localMatrix;
  }

  // Recompute this subtree's world matrices. Call once per frame on the root;
  // pass the parent's world matrix when the root is attached to a larger scene.
  updateWorldMatrix(parentWorld = null) {
    this.updateLocalMatrix();
    this.worldMatrix = parentWorld ? multiply(parentWorld, this.localMatrix) : this.localMatrix;
    for (const child of this.children) child.updateWorldMatrix(this.worldMatrix);
    return this.worldMatrix;
  }

  getWorldMatrix() { return this.worldMatrix; }

  getWorldPosition() { return transformPoint(this.worldMatrix, [0, 0, 0]); }

  // Matrix to draw this node's mesh with: world · shape.
  getMeshMatrix() { return multiply(this.worldMatrix, this.shape); }

  traverse(fn) {
    fn(this);
    for (const child of this.children) child.traverse(fn);
  }

  find(name) {
    if (this.name === name) return this;
    for (const child of this.children) {
      const hit = child.find(name);
      if (hit) return hit;
    }
    return null;
  }
}
