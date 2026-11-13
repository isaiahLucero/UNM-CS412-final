const SKYBOX_VS = `#version 300 es
in vec3 aPosition;

uniform mat4 uProjection;
uniform mat4 uModelView;

out vec3 vTextCoord;

void main() {
  vTextCoord = aPosition;

  vec4 pos = uProjection * uModelView * vec4(aPosition, 1.0);
  gl_Position = pos.xyww;
}
`;

const SKYBOX_FS = `#version 300 es
precision mediump float;

in vec3 vTextCoord;
uniform samplerCube uSkyBox;

out vec4 fragColor;

void main(){
  fragColor = texture(uSkyBox, vTextCoord);
}
`;


const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModelView;
uniform mat4 uProjection;
uniform float t;

out vec3 vPosition;
out vec3 vNormal;

float random (vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  float summation = 0.0;
  float summationX = 0.0;
  float summationZ = 0.0;
  float amp = 0.01;
  float frequency = 2.0 / 1.0;
  float phase = 2.0 * frequency;
  int maxWaves = 12;

  for(int i = 0; i < maxWaves; i++){
    float angle = random(vec2(float(i), 1.0)) * 6.28318;
    vec2 dir = vec2(cos(angle), sin(angle));
    
    summation += amp * sin(dot(aPosition.xz, dir) * frequency + t * phase);
    summationX += frequency * dir.x * amp * cos(dot(aPosition.xz, dir) * frequency + t * phase);
    summationZ += frequency * dir.y * amp * cos(dot(aPosition.xz, dir) * frequency + t * phase);

    amp *= 0.5;
    frequency *= 1.8;
    phase *= 1.1;
  }

  vec3 finalPos = vec3(aPosition.x, aPosition.y + summation, aPosition.z);
  vec3 finalNrm = vec3(-summationX, 1.0, -summationZ);

  vec4 p = uModelView * vec4(finalPos, 1.0);
  vPosition = p.xyz;
  vNormal = mat3(uModelView) * finalNrm;
  gl_Position = uProjection * p;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 vPosition;
in vec3 vNormal;

uniform vec3 uLightPos;   // eye space
uniform vec3 uColor;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vPosition);
  vec3 L = normalize(uLightPos - vPosition);
  vec3 R = reflect(-L, N);

  vec3 Ka = 0.35 * uColor;
  float diff = max(dot(N, L), 0.0);
  vec3 diffuse = 0.35 * uColor * diff;
  vec3 waterColor = Ka + diffuse;

  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N,V), 0.0), 4.0);
  vec3 skyColor = vec3(0.45, 0.88, 0.98);
  vec3 surfaceColor = mix(waterColor, skyColor, fresnel * 0.85);

  float shininess = 180.0;
  float spec = pow(max(dot(V,R), 0.0), shininess);
  vec3 specular = vec3(1.4) * spec;

  fragColor = vec4(surfaceColor + specular, 1.0);
}
`;

// WebGL setup
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

// Fixed attribute slots, so the meshes stay valid when the shaders are recompiled
const ATTRIBUTES = { aPosition: 0, aNormal: 1 };

function createProgram(vsSource, fsSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
  for (const name in ATTRIBUTES) gl.bindAttribLocation(prog, ATTRIBUTES[name], name);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

const skyBoxProgram = createProgram(SKYBOX_VS, SKYBOX_FS);
const uSkyProj = gl.getUniformLocation(skyBoxProgram, "uProjection");
const uSkyModel = gl.getUniformLocation(skyBoxProgram, "uModelView");
const uSkyBoxLoc = gl.getUniformLocation(skyBoxProgram, "uSkyBox");

// Shader editors
const vertEditor = document.getElementById("vertEditor");
const fragEditor = document.getElementById("fragEditor");
const shaderError = document.getElementById("shaderError");
vertEditor.value = VERTEX_SHADER;
fragEditor.value = FRAGMENT_SHADER;

let program, uModelView, uProjection, uLightPos, uTime, uColor, lightAngle = 0;
let lightRotationMatrix;

function updateProgram() {
  try {
    const prog = createProgram(vertEditor.value, fragEditor.value);
    gl.deleteProgram(program);
    program = prog;
    gl.useProgram(program);
    uModelView = gl.getUniformLocation(program, "uModelView");
    uProjection = gl.getUniformLocation(program, "uProjection");
    uLightPos = gl.getUniformLocation(program, "uLightPos");
    uColor = gl.getUniformLocation(program, "uColor");
    uTime = gl.getUniformLocation(program, "t");
    shaderError.textContent = "";
  } catch (e) {
    shaderError.textContent = e.message.replace(/\0/g, "");  // some drivers end the log with \0
  }
}
updateProgram();
vertEditor.addEventListener("input", updateProgram);
fragEditor.addEventListener("input", updateProgram);

function bindAttribute(name, data) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(ATTRIBUTES[name], 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ATTRIBUTES[name]);
}

function createMesh({ positions, normals, indices }) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  bindAttribute("aPosition", positions);
  bindAttribute("aNormal", normals);

  // since draw elements count each vertex as its own unique data point, it won't handle flat
  // shading correctly
  if(indices){
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return{ vao, count: indices.length, useElements: true };
  }
  else{
    return { vao, count: positions.length / 3, useElements: false};
  }
}

const planeMesh = createMesh(createSegmentedPlane(10000, 60));
const cubeMesh = createMesh(createCube());

function loadCubeTextures() {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  const faceInfos = [
    {target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, url: 'tropical-beach-sunny-day.jpg' }, // east
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, url: 'tropical-beach-sunny-day.jpg' }, // west
    { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, url: 'sky-with-clouds.jpg' },          // sky
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, url: 'photo-stone-texture-pattern.jpg' }, // floor
    { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, url: 'tropical-beach-sunny-day.jpg' }, // south
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, url: 'tropical-beach-sunny-day.jpg' }, // north
  ]
  const SIZE = 512;
  let loadCount = 0;

  faceInfos.forEach(( { target, url } ) => {
    gl.texImage2D(target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 255, 255]));

    const image = new Image();
    image.onload = () => {
      const squareCanvas = document.createElement('canvas');
      squareCanvas.width = SIZE;
      squareCanvas.height = SIZE;
      const context = squareCanvas.getContext('2d');

      const minSide = Math.min(image.width, image.height);
      const startX = (image.width - minSide) / 2;
      const startY = (image.height - minSide) / 2; 

      context.drawImage(image, startX, startY, minSide, minSide, 0, 0, SIZE, SIZE);

      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
      gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, squareCanvas);

      loadCount++;
      if(loadCount == 6){
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      }
    };
    image.src = url;
  });
  return texture;
}
const skyBoxTextures = loadCubeTextures();

const BUMP_MAPPING = 0, NORMAL_MAPPING = 1;
const objects = [
  
];

gl.enable(gl.DEPTH_TEST);
gl.clearColor(0, 0, 0, 1);
const projection = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 1000);
let lightWorld = [0, 5, 0];

// nteractive controls
let dragRotX = 0, dragRotY = -0.5;      // mouse drag
let camX = -0.1, camY = -0.3, camZ = -2.1;      // arrow keys, w, s
let sliderAngle = 0;                    // degrees
let spinning = false, spinAngle = 0;    // Start/Stop button

let mouseDown = false, lastX, lastY;
canvas.addEventListener("mousedown", e => { mouseDown = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("mouseup", () => mouseDown = false);
window.addEventListener("mousemove", e => {
  if (!mouseDown) return;
  dragRotY += (e.clientX - lastX) * 0.01;
  dragRotX += (e.clientY - lastY) * 0.01;
  lastX = e.clientX; lastY = e.clientY;
});

document.addEventListener("keydown", e => {
  if (e.target === vertEditor || e.target === fragEditor) return;  // let the editors use the keys
  const step = 0.2;
  switch (e.key) {
    case "ArrowUp": camY -= step; break;
    case "ArrowDown": camY += step; break;
    case "ArrowLeft": camX += step; break;
    case "ArrowRight": camX -= step; break;
    case "w": camZ += step; break;
    case "s": camZ -= step; break;
    default: return;
  }
  e.preventDefault();  // keep the arrow keys from scrolling the page
});

const axisSelect = document.getElementById("axisSelect");
document.getElementById("spinButton").addEventListener("click", () => spinning = !spinning);


function createNode(mesh, color, shape) {
  return { mesh, color, shape, joint: null, jointIndex: 0, children: [] };
}

const base = createNode(planeMesh, [0.05, 0.25, 0.52], translate(-30, 0, -30));

function drawNode(node, frame) {
  gl.uniformMatrix4fv(uModelView, false, multiply(frame, node.shape));
  gl.uniform3fv(uColor, node.color);
  gl.bindVertexArray(node.mesh.vao);

  if(node.mesh.useElements){
    gl.drawElements(gl.TRIANGLES, node.mesh.count, gl.UNSIGNED_SHORT, 0);
  }
  else{
    gl.drawArrays(gl.TRIANGLES, 0, node.mesh.count);
  }
}

//Data structure
function drawTree(root, rootFrame) {
  const stack = [[root, rootFrame]];
  while (stack.length > 0) {
    const [node, parentFrame] = stack.pop();

    const frame = multiply(parentFrame, node.joint);
    drawNode(node, frame);
    for (const child of node.children) stack.push([child, frame]);
  }
}

// Render loop
let lastTime = 0;
function render(time) {
  const t = time / 1000;

  gl.uniform1f(uTime, t);

  if (spinning) spinAngle += t - lastTime;
  lastTime = t;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Camera moves with the keys; the light stays fixed in the world.
  const view = translate(camX, camY, camZ);
  gl.uniformMatrix4fv(uProjection, false, projection);

  // TODO: Allow User to change which light they are changing
  // TODO: Allow User to change in on different axis
  lightRotationMatrix = rotateX(lightAngle);
  let currentLightPos = transformPoint(lightRotationMatrix, lightWorld);

  gl.uniform3fv(uLightPos, transformPoint(view, currentLightPos));

  // Whole-model rotation
  const axisRotation = ROTATE[axisSelect.value](sliderAngle * Math.PI / 180 + spinAngle);
  const rotation = multiply(multiply(rotateY(dragRotY), rotateX(dragRotX)), axisRotation);

  base.joint = rotation;

  gl.depthFunc(gl.LEQUAL);
  gl.useProgram(skyBoxProgram);

  const skyViewRot = multiply(rotateY(dragRotY), rotateX(dragRotX));
  gl.uniformMatrix4fv(uSkyProj, false, projection);
  gl.uniformMatrix4fv(uSkyModel, false, skyViewRot);
  

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyBoxTextures);
  gl.uniform1i(uSkyBoxLoc, 0);

  gl.bindVertexArray(cubeMesh.vao);
  if(cubeMesh.useElements) {
    gl.drawElements(gl.TRIANGLES, cubeMesh.count, gl.UNSIGNED_SHORT, 0);
  } else {
    gl.drawArrays(gl.Triangles, 0, cubeMesh.count);
  }

  gl.depthFunc(gl.LESS);
  gl.useProgram(program);

  drawTree(base, view);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
