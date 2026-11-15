# Submarine module — integration contract

Standalone submarine + hierarchical robotic arm for the CS412 deep-sea project.
It is **renderer-agnostic**: no WebGL calls, no DOM access except the optional
`KeyboardControls`. It imports only `../math/transforms.js` (and nothing from `sandbox/`).

## ⚠ Coordinate convention (read this before exporting models)

| | |
|---|---|
| Up | **+Y** |
| Forward (nose) | **−Z** |
| Right (starboard) | **+X** |
| Units | metres (hull ≈ 4.7 m long) |
| Origin | hull centre |
| Heading | radians about +Y; `0` = facing −Z, positive = turned left (CCW seen from above) |
| Matrices | column-major `Float32Array(16)`, `multiply(a, b) = a·b` (CS412 hw library) |

**Exporting from Blender to match:** the glTF exporter's default **+Y Up** maps
Blender +Z → +Y and Blender +Y → **−Z**. So model the sub with its **nose pointing
along Blender +Y**. That is *not* Blender's "Front" view, which looks at the −Y side.
For OBJ, use *Forward: −Z, Up: Y*. Check: after export, the nose vertices should
have the most negative Z.

## Public API

```js
import { Submarine, KeyboardControls } from './src/submarine/index.js';

const sub = new Submarine({ position: [0, 4, 0], heading: 0, bounds: { minY: 1.9 } });
const controls = new KeyboardControls();          // optional; any input source works

// every frame
sub.update(dt, controls.getInput(), parentMatrix /* optional */);

sub.getWorldMatrix();            // root world matrix
sub.getPosition();               // [x, y, z] world
sub.getForward();                // unit world vector (root's −Z)
sub.getLightMountWorldMatrix();  // origin = lens, local −Z = beam direction, local +Y = beam up
sub.getVelocity(); sub.getSpeed();

sub.forEachDrawable((meshKey, worldMatrix, material, node) => { /* draw */ });

sub.root                         // Node — attach to your scene graph if you have one
sub.arm.clawTip                  // empty Node at the fingertip midpoint (grab point)
sub.arm.getClawTipPosition();    // [x, y, z] world
sub.arm.getClawTipWorldMatrix();
sub.arm.getJointAngles();        // { yaw, pitch, elbow, roll, claw } in degrees
sub.arm.reset();                 // ease back to the stowed pose
```

The spotlight (owned by the lighting teammate) can be derived from the light mount:
```js
const m = sub.getLightMountWorldMatrix();
const lightPos = transformPoint(m, [0, 0, 0]);
const lightDir = normalize(transformDirection(m, [0, 0, -1]));
```

### Input shape
`update()` takes a plain object, so gamepad, AI or replay input can drive it too:
```js
{ throttle, turn, vertical,                    // each in [-1, 1]; turn + = left, vertical + = up
  arm: { yaw, pitch, elbow, roll, claw },      // each in [-1, 1]; see the joint table for signs
  resetArm }                                   // true for one frame
```

### Drawing
`forEachDrawable` gives a mesh **key** (`'cube' | 'cylinder' | 'sphere' | 'cone'`),
the final world matrix (already including the part's `shape`) and a material
`{ color, diffuse, specular, shininess, emissive }`. Map the key to your own VAO.
Canonical primitive sizes are documented at the top of `src/geometry/primitives.js`.
When real models arrive in `assets/submarine/`, swap the keys to point at them.

## Hierarchy

```
submarine (root: position + heading)
└─ hull                         (+ nose, viewport, tail, tower, fins: fixed decoration)
   ├─ propeller                 spins about local Z, speed follows throttle
   ├─ lightMount                lens origin, beam along local −Z, tilted ~11° down
   └─ armBase
      └─ shoulder    YAW   rotation.y
         └─ upperArm PITCH rotation.x
            └─ elbow PITCH rotation.x   (carries the forearm)
               └─ wrist ROLL rotation.z (about the forearm axis)
                  └─ claw
                     ├─ fingerL / fingerR   spread, rotation.y (mirrored)
                     └─ clawTip             empty, kept at the fingertip midpoint
```

`Node` (`scene-node.js`): `local = T · Ry · Rx · Rz · S`, `world = parentWorld · local`.
Each node also has a `shape` matrix that sizes **only its own mesh** and is not
inherited (the CS412 hw5 rule), so long arm segments never shear their children.
Local TRS `scale` *is* inherited, as in any scene graph.

## Arm joints (`robotic-arm.js` → `ARM_JOINT_DEFS`)

| Joint | Keys | Axis | Limits | Rest (stowed) | + direction |
|---|---|---|---|---|---|
| yaw   | J / L | Y | −120° … 120° | 0°   | left |
| pitch | I / K | X | −15° … 100°  | −8°  | down (K) |
| elbow | U / O | X | 0° … 140°    | 135° | fold (U) |
| roll  | N / M | Z | −180° … 180° | 0°   | counter-clockwise (N) |
| claw  | , / . | Y | 0° … 35°     | 8°   | open (,) |

Held keys move a **target** at `rate` deg/s, clamped to the limits. The visible angle
follows with exponential smoothing (`smoothing = 10 /s`), so motion eases in and out.
`R` stows the arm.

## Movement (`submarine.js` → `SUBMARINE_DEFAULTS`)

| Keys | Effect |
|---|---|
| W / S | thrust along the heading (propeller follows throttle, coasts down, reverses) |
| A / D | yaw acceleration with angular damping |
| Space / Shift | vertical thrust |

Damping is exponential and split relative to the hull: `forwardDamping` (0.8/s),
`lateralDamping` (4.0/s, so the sub doesn't slide sideways after a turn), `verticalDamping`
(1.2/s) and `angularDamping` (2.6/s). Top speed ≈ `thrustAccel / forwardDamping` ≈ 4 m/s.
All values can be overridden in the constructor. `bounds.minY / maxY` clamp the root's height.

Key bindings live in `DEFAULT_KEYMAP`. Pass `new KeyboardControls({ keymap })` to remap them.
Keys are matched by `KeyboardEvent.code`. Ctrl/Cmd/Alt combos are left to the browser.
