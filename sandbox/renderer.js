// Sandbox renderer — WebGL2, CS412 hw5/hw6 style. Test harness only: the real
// scene's lighting/camera belong to teammates. Phong with two point lights in
// eye space, inverse-transpose normals, hw5 material uniforms, plus a simple
// distance fog so the sandbox reads as "underwater".

import { createCube, createCylinder, createSphere, createCone, createTorus }
  from '../src/geometry/primitives.js';
import { multiply, perspective, transformPoint } from '../src/math/transforms.js';

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uModelView;
uniform mat4 uProjection;
out vec3 vPosition;
out vec3 vNormal;
void main() {
  vec4 p = uModelView * vec4(aPosition, 1.0);
  vPosition = p.xyz;
  // Inverse-transpose keeps normals correct under non-uniform part scaling.
  vNormal = transpose(inverse(mat3(uModelView))) * aNormal;
  gl_Position = uProjection * p;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vPosition;
in vec3 vNormal;
uniform vec3 uLightPosA;      // eye space (converted in JS)
uniform vec3 uLightPosB;
uniform vec3 uLightColorA;
uniform vec3 uLightColorB;
uniform vec3 uAmbient;
uniform vec3 uColor;
uniform float uDiffuse;
uniform float uSpecular;
uniform float uShininess;
uniform vec3 uEmissive;
uniform vec3 uFogColor;
uniform float uFogDensity;
out vec4 fragColor;

vec3 phongLight(vec3 N, vec3 V, vec3 lightPos, vec3 lightColor) {
  vec3 delta = lightPos - vPosition;
  float dist = length(delta);
  vec3 L = delta / dist;
  float ndotl = max(dot(N, L), 0.0);
  float spec = 0.0;
  if (ndotl > 0.0) {
    vec3 R = reflect(-L, N);
    spec = pow(max(dot(R, V), 0.0), max(1.0, uShininess));
  }
  float attenuation = 1.0 / (1.0 + 0.02 * dist + 0.002 * dist * dist);
  return attenuation * lightColor * (uColor * uDiffuse * ndotl + vec3(uSpecular * spec));
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;               // culling is off; light back faces sensibly
  vec3 V = normalize(-vPosition);
  vec3 lit = uAmbient * uColor + uEmissive;
  lit += phongLight(N, V, uLightPosA, uLightColorA);
  lit += phongLight(N, V, uLightPosB, uLightColorB);
  float fog = 1.0 - exp(-uFogDensity * length(vPosition));
  fragColor = vec4(mix(lit, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
}`;

export const FOG_COLOR = [0.02, 0.09, 0.14];

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL2 is unavailable. Use an up-to-date Chrome, Firefox or Safari.');

  const program = makeProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  gl.useProgram(program);
  const loc = {};
  for (const k of ['uModelView', 'uProjection', 'uLightPosA', 'uLightPosB', 'uLightColorA',
    'uLightColorB', 'uAmbient', 'uColor', 'uDiffuse', 'uSpecular', 'uShininess', 'uEmissive',
    'uFogColor', 'uFogDensity']) loc[k] = gl.getUniformLocation(program, k);

  const meshes = {
    cube: createMesh(gl, createCube()),
    cylinder: createMesh(gl, createCylinder(36, 1)),
    sphere: createMesh(gl, createSphere(32, 18)),
    cone: createMesh(gl, createCone(36, 8)),
    torus: createMesh(gl, createTorus(0.77, 0.32, 40, 16))
  };

  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(...FOG_COLOR, 1);

  let view = null;
  let projection = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    projection = perspective(Math.PI / 3.4, canvas.width / Math.max(1, canvas.height), 0.1, 400);
  }

  // lights: [{ position (world), color }, { ... }]
  function beginFrame(viewMatrix, lights, { fogDensity = 0.022, ambient = [0.16, 0.2, 0.24] } = {}) {
    resize();
    view = viewMatrix;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(loc.uProjection, false, projection);
    gl.uniform3fv(loc.uLightPosA, transformPoint(view, lights[0].position));
    gl.uniform3fv(loc.uLightPosB, transformPoint(view, lights[1].position));
    gl.uniform3fv(loc.uLightColorA, lights[0].color);
    gl.uniform3fv(loc.uLightColorB, lights[1].color);
    gl.uniform3fv(loc.uAmbient, ambient);
    gl.uniform3fv(loc.uFogColor, FOG_COLOR);
    gl.uniform1f(loc.uFogDensity, fogDensity);
  }

  function drawMesh(meshKey, world, mat) {
    const mesh = meshes[meshKey];
    if (!mesh) return;
    gl.uniformMatrix4fv(loc.uModelView, false, multiply(view, world));
    gl.uniform3fv(loc.uColor, mat.color);
    gl.uniform1f(loc.uDiffuse, mat.diffuse);
    gl.uniform1f(loc.uSpecular, mat.specular);
    gl.uniform1f(loc.uShininess, mat.shininess);
    gl.uniform3fv(loc.uEmissive, mat.emissive || [0, 0, 0]);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  // Registers an extra shape under a new key so drawMesh can draw it (e.g. the sea life's tapered vent).
  // data is the same format as the primitives: { positions, normals, tangents, texCoords, indices }.
  function addMesh(key, data) {
    meshes[key] = createMesh(gl, data);
  }

  return { gl, beginFrame, drawMesh, addMesh };
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(msg);
  }
  return shader;
}

function makeProgram(gl, vs, fs) {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v); gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// Same attribute slots as hw6: 0 position, 1 normal, 2 texCoord, 3 tangent.
const ATTR = [[0, 3, 'positions'], [1, 3, 'normals'], [2, 2, 'texCoords'], [3, 3, 'tangents']];
function createMesh(gl, data) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  for (const [slot, width, prop] of ATTR) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data[prop], gl.STATIC_DRAW);
    gl.enableVertexAttribArray(slot);
    gl.vertexAttribPointer(slot, width, gl.FLOAT, false, 0, 0);
  }
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: data.indices.length };
}