# 🌊 integration branch

This is the baseline code for our project. It has the submarine 🚢 and the robotic arm 🦾 working in plain WebGL2, using the same setup as our homework.

Please take a look at the code. We'll build the surface, camera viewpoint, animation, and objects on top of it.

## 📁 Code structure

```
src/
├── submarine/        # submarine + robotic arm (API: src/submarine/README.md)
├── math/             # homework matrix library (ES modules)
└── geometry/         # homework primitive shapes (cube, cylinder, sphere...)
sandbox/              # test scene: seafloor + follow camera (to be replaced)
assets/submarine/     # Blender model of the submarine
```

## 📦 ES modules

Unlike our homework, which loaded each file with a plain `<script>` tag, this code uses `import` / `export` (ES modules). With several people adding files, this keeps everyone's functions and variables from clashing in the global scope. To add your code, put `export` in front of the functions you want to share and `import` them where you need them. This is also why the page has to be opened through a local server.

## ▶️ Run

```bash
git switch integration
python3 -m http.server 8000
```

Open http://localhost:8000/sandbox/ and click the canvas once.

## 🛠️ Tools

Built with help from Claude Code. The 3D model was made in Blender with Blender MCP.
