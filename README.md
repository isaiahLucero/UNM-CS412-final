# Deep-Sea Submarine — submarine & robotic arm module

CS412 team project, my part: the player submarine and its hierarchical robotic arm,
built as a standalone module for teammates to integrate into the main scene.
Plain WebGL2 + ES modules, no build step, no external libraries.

## Run locally

ES modules don't load from `file://`, and the sandbox imports `../src/...`, so serve
the **project root**:

```bash
cd Deepsea
python3 -m http.server 8000
```

Open <http://localhost:8000/sandbox/>. If port 8000 is busy, use another (`python3 -m http.server 8765`).

On GitHub Pages it works unchanged at `https://<user>.github.io/<repo>/sandbox/`
(all paths are relative).

## Controls (sandbox)

| Submarine (left hand) | | Arm (right hand) | |
|---|---|---|---|
| W / S | thrust forward / back | J / L | shoulder yaw |
| A / D | turn left / right | I / K | upper arm up / down |
| Space / Shift | ascend / descend | U / O | elbow fold / extend |
| | | N / M | wrist roll |
| | | , / . | claw open / close |
| | | R | stow arm |

Camera (sandbox only): drag to orbit, wheel to zoom, double-click to reset.
`window.sub` is exposed in the console for poking at the API.

## Layout

```
src/
  math/transforms.js      CS412 matrix library (ES-module port) + lookAt/invert/vec3 helpers
  geometry/primitives.js  CS412 primitive generators (cube, cylinder, sphere, cone, torus), data only
  submarine/              ← the deliverable; see src/submarine/README.md for the API
sandbox/                  test harness only: renderer, follow camera, seafloor, props, HUD
assets/submarine/         models (empty for now)
ref/                      clone of the CS412 homework repo, git-ignored
```

## Status
- Done: scene graph, placeholder hierarchy, sub movement, arm joints with limits and
  smoothing, public API, `clawTip` grab point.
- Next: grabbing (it will use `sub.arm.clawTip`), then real models in `assets/submarine/`.
