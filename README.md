# 🌊 integration branch

This is the baseline code for our project. It has the submarine 🚢 and the robotic arm 🦾 working in plain WebGL2, using the same setup as our homework.

Please take a look at the code. We'll build the ocean scene, camera, and objects on top of it.

## 📁 Code structure

```
src/
├── submarine/        # submarine + robotic arm (API: src/submarine/README.md)
├── math/             # homework matrix library (ES modules)
└── geometry/         # homework primitive shapes (cube, cylinder, sphere...)
sandbox/              # current test scene: renderer, seafloor, follow camera
assets/submarine/     # Blender model of the submarine
```

## 📦 ES modules

Unlike our homework, this code uses `import` / `export` instead of plain `<script>` tags, so everyone's files don't clash in the global scope. That's also why it needs a local server.

## ▶️ Run

```bash
python3 -m http.server 8000
```

Open http://localhost:8000/sandbox/ and click the canvas once.

## 🧩 Adding your part

- **Objects:** `sandbox/test-objects.js` shows how objects are made and drawn.
- **Moving things** (tentacles, fish): the `Node` class in `src/submarine/scene-node.js` handles parent-child movement.
- **Camera / lighting:** use `sub.getPosition()`, `sub.getForward()`, and `sub.getLightMountWorldMatrix()`.

Please don't edit `assets/submarine/`, since model files can't be merged.
