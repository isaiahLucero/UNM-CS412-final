# integration branch

This is the baseline code for our project. It has the submarine and the robotic arm working in plain WebGL2, using the same setup as our homework.

Please take a look at the code. We'll build the surface, camera viewpoint, animation, and objects on top of it.

## Run

```bash
git switch integration
python3 -m http.server 8000
```

Open http://localhost:8000/sandbox/ and click the canvas once.

The submarine's API is in `src/submarine/README.md`.
