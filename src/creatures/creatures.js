// creatures.js: how the sea creatures move. No drawing and no scene-specific numbers in here.
// The scene creates creatures with its own areas, passes in what to avoid every frame,
// and reads back each creature's matrix (where it is + which way it faces) to draw it.
// Renderer-agnostic like the submarine module: no WebGL calls, only math from transforms.js.
//
// Every creature works the same way:
//   const fish = createFish({ start, size, speed, area });
//   fish.update(dt, { obstacles, others });   // every frame, dt = seconds since the last frame
//   fish.matrix                                // use this to place the creature's parts

import { compose, translate, rotateX, rotateY, rotateZ } from '../math/transforms.js';


// ---------- Areas and obstacles (the scene builds these and hands them to the creatures) ----------

// Keeps v between lo and hi
function clampTo(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// An area a creature can roam: a box from its min corner to its max corner, e.g.
// boxArea([-4, 0, -4], [4, 3, 2]) = x from -4 to 4, y from 0 to 3, z from -4 to 2.
// Creatures only use randomPoint() and clamp(), so the game can make other shapes later
// (a sphere around the player, the whole space under the water, ...) as long as they have those two.
export function boxArea(min, max) {
  return {
    randomPoint: () => min.map((lo, k) => lo + Math.random() * (max[k] - lo)),
    clamp: p => p.map((v, k) => clampTo(v, min[k], max[k]))
  };
}

// A keep-out zone shaped like a standing cylinder (coral, rocks, a shipwreck):
// x, z = its center seen from above, r = how wide, top = how high it reaches
export function cylinderObstacle(x, z, r, top) {
  return { x, z, r, top };
}

// True if point p is inside (or within pad of) any of the obstacles
export function insideObstacle([x, y, z], obstacles, pad = 0) {
  return obstacles.some(o => y < o.top + pad && Math.hypot(x - o.x, z - o.z) < o.r + pad);
}

// Random spot in the area that isn't in or next to an obstacle.
// Gives up after 50 tries so a badly set up area can't freeze the page.
export function pickTarget(area, obstacles, pad) {
  let p = area.randomPoint();
  for (let tries = 0; tries < 50 && insideObstacle(p, obstacles, pad); tries++) p = area.randomPoint();
  return p;
}


// ---------- Fish: wander to random spots, swerve around things, never flip upside down ----------
// A fish only ever turns 3 ways: yaw (left/right, any amount), pitch (nose up/down, capped)
// and roll (a small lean into turns, capped). Roll never gets near 180°, so it can't go upside down.
// The fish's head is along +x in its own model.
//   size  = how big it is (also sets how much room it gives other things)
//   speed = units per second
//   turn  = fastest turn in radians per second (1.2 is about 70° a second)
//   maxPitch = steepest nose up/down (0.45 is about 25°), bank = most it leans into a turn (0.25 is about 15°)
export function createFish({ start, area, size = 1, speed = 1, turn = 1.2, maxPitch = 0.45, bank = 0.25 }) {
  const fish = { pos: [...start], area, size, speed, turn, maxPitch, bank,
                 yaw: 0, pitch: 0, roll: 0, target: null, timer: 0, wag: 0, matrix: translate(...start) };
  fish.update = (dt, world) => updateFish(fish, dt, world);
  return fish;
}

// How much room a fish gives obstacles, based on its size (a bigger fish keeps further away)
function fishMargin(f) {
  return 0.6 + 0.6 * f.size;
}

// If another creature is too close, aim straight away from it.
// "Too close" = 1.2 × both their sizes added, e.g. two fish of size 0.75 and 0.6: 1.2 × 1.35 = 1.6 units.
// away / d is the direction from the other creature to this one, shrunk to length 1.
// timer > 1 so it doesn't keep re-aiming every single frame while they're still close.
function avoidOthers(f, others) {
  for (const o of others) {
    if (o === f) continue;
    const away = [f.pos[0] - o.pos[0], f.pos[1] - o.pos[1], f.pos[2] - o.pos[2]];
    const d = Math.hypot(...away);
    const reach = 1.2 * (f.size + (o.size ?? 1));
    if (d < reach && d > 0 && f.timer > 1) {
      f.target = f.area.clamp(f.pos.map((v, k) => v + away[k] / d * (reach + 1)));
      f.timer = 0;
    }
  }
}

// If the fish is about to swim into an obstacle, aim outward from it and up over its top.
// (ax, az) / d = the direction from the obstacle's center out to the fish, seen from above.
function avoidObstacles(f, obstacles) {
  const m = fishMargin(f);
  for (const o of obstacles) {
    const ax = f.pos[0] - o.x, az = f.pos[2] - o.z, d = Math.hypot(ax, az);
    if (d < o.r + m && f.pos[1] < o.top + m && d > 0 && f.timer > 0.5) {
      f.target = f.area.clamp([o.x + ax / d * (o.r + m + 1.5), o.top + m + 0.4, o.z + az / d * (o.r + m + 1.5)]);
      f.timer = 0;
    }
  }
}

// Moves a fish a little toward its target.
// world.obstacles = keep-out zones, world.others = creatures to swerve around (anything with pos and size)
function updateFish(f, dt, { obstacles = [], others = [] } = {}) {
  const m = fishMargin(f);
  f.timer += dt;
  avoidOthers(f, others);
  avoidObstacles(f, obstacles);
  if (!f.target || insideObstacle(f.target, obstacles, m)) f.target = pickTarget(f.area, obstacles, m);

  const [x, y, z] = f.pos;
  const dx = f.target[0] - x, dy = f.target[1] - y, dz = f.target[2] - z;

  // Close enough, or taking too long? Pick a new spot to swim to.
  if (Math.hypot(dx, dy, dz) < 0.5 || f.timer > 10) {
    f.target = pickTarget(f.area, obstacles, m);
    f.timer = 0;
  }

  // Yaw: the head points along +x, and rotateY(yaw) turns +x into (cos yaw, 0, -sin yaw),
  // so the yaw that faces the target is atan2(-dz, dx).
  // e.g. target straight ahead in +x: atan2(0, 1) = 0°. Target off in -z: atan2(1, 0) = 90°.
  let yawError = Math.atan2(-dz, dx) - f.yaw;
  yawError = Math.atan2(Math.sin(yawError), Math.cos(yawError));  // wrap to -180°..180° so it turns the short way
  const yawRate = clampTo(2 * yawError, -f.turn, f.turn);         // turn harder the further off it is, up to turn
  f.yaw += yawRate * dt;

  // Pitch: aim the nose at the target's height (rise over run), but never steeper than maxPitch.
  // Ease toward it (close 2× the gap per second) instead of snapping.
  const wantPitch = clampTo(Math.atan2(dy, Math.hypot(dx, dz)), -f.maxPitch, f.maxPitch);
  f.pitch += (wantPitch - f.pitch) * Math.min(1, 2 * dt);

  // Roll: lean into the turn. Full-speed turn = full bank, going straight = no lean.
  // Minus sign: turning toward -z means tipping the top toward -z.
  const wantRoll = -f.bank * yawRate / f.turn;
  f.roll += (wantRoll - f.roll) * Math.min(1, 3 * dt);

  // Slow down when the target is behind it: cos(yawError) is 1 facing it, 0 sideways, -1 behind.
  // Slower means a tighter turn, so it can't get stuck circling around the target.
  const speed = f.speed * Math.max(0.3, Math.cos(yawError));

  // Step forward the way it's facing. Same direction as rotateY's +x, tipped up by the pitch:
  // horizontal (cos yaw, -sin yaw) shrunk by cos(pitch), vertical sin(pitch).
  const flat = Math.cos(f.pitch) * speed * dt;
  f.pos = [x + Math.cos(f.yaw) * flat, y + Math.sin(f.pitch) * speed * dt, z - Math.sin(f.yaw) * flat];

  f.wag += dt * (4 + 6 * speed);  // tail beats faster when it swims faster
  // Lean first, then nose up/down, then turn, then move into place (rightmost is applied first)
  f.matrix = compose(translate(...f.pos), rotateY(f.yaw), rotateZ(f.pitch), rotateX(f.roll));
}


// ---------- School: a leader fish wanders, the others follow its path a moment behind ----------
// Follower spots: delay = seconds behind the leader, offset = where it sits next to the leader's path
// in the leader's own directions (x = forward, y = up, z = side), measured in leader sizes so it scales.
export const SCHOOL_SLOTS = [
  { delay: 0.3,  offset: [-0.35,  0.55,  1.1] },
  { delay: 0.35, offset: [-0.35, -0.35, -1.1] },
  { delay: 0.65, offset: [-0.7,   0.2,   0.2] },
  { delay: 0.9,  offset: [-0.7,  -0.55,  1.25] }
];

// Same options as createFish (they go to the leader). school.members = every fish to draw.
export function createSchool({ slots = SCHOOL_SLOTS, ...fishOptions }) {
  const leader = createFish(fishOptions);
  const followers = slots.map((s, i) => ({
    delay: s.delay, offset: s.offset.map(v => v * leader.size), size: leader.size * 0.9,
    phase: i * 1.7, wag: i, matrix: leader.matrix
  }));
  const school = { leader, followers, members: [leader, ...followers], history: [], time: 0 };
  school.update = (dt, world) => updateSchool(school, dt, world);
  return school;
}

// Where the leader was at a given time: the newest saved frame at or before then
function leaderAt(school, time) {
  const h = school.history;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].time <= time) return h[i].matrix;
  return h[0].matrix;
}

function updateSchool(s, dt, world) {
  s.time += dt;
  s.leader.update(dt, world);
  s.history.push({ time: s.time, matrix: s.leader.matrix });
  while (s.history[0].time < s.time - 2) s.history.shift();  // only keep the last 2 seconds

  for (const f of s.followers) {
    // Copy where the leader was `delay` seconds ago, then slide over to this fish's spot next to it.
    // The small sin wobble keeps the school from looking frozen in formation.
    const wobble = 0.18 * s.leader.size * Math.sin(s.time * 1.5 + f.phase);
    f.matrix = compose(leaderAt(s, s.time - f.delay), translate(f.offset[0], f.offset[1] + wobble, f.offset[2]));
    f.wag += dt * (4 + 6 * s.leader.speed);
  }
}


// ---------- Jellyfish: glides around in slow curves, pushed forward by each pulse of its bell ----------
// Steers like the fish (a heading that turns toward its target), but slower and with momentum:
// each pulse adds speed and the water's drag takes it away, so it surges and glides.
//   thrust = how hard each pulse pushes, drag = how fast the water slows it down,
//   turn = fastest turn in radians per second (0.7 is about 40° a second), size = how much room others give it
export function createJelly({ start, area, thrust = 1.3, drag = 1.0, turn = 0.7, size = 1 }) {
  const jelly = { pos: [...start], heading: 0, speed: 0, area, thrust, drag, turn, size,
                  target: area.randomPoint(), pulse: 0, leanX: 0, leanZ: 0, time: 0, matrix: translate(...start) };
  jelly.update = dt => updateJelly(jelly, dt);
  return jelly;
}

// How lined up spot p is with the jelly's heading, seen from above: 1 = dead ahead, 0 = to the side, -1 = behind.
// The heading points along (cos heading, -sin heading) like the fish's yaw, so this is
// dot(that, direction to p) = the cosine of the angle between them.
function jellyAheadness(j, p) {
  const dx = p[0] - j.pos[0], dz = p[2] - j.pos[2], len = Math.hypot(dx, dz);
  if (len < 1e-6) return 1;
  return (dx * Math.cos(j.heading) - dz * Math.sin(j.heading)) / len;
}

// New spot roughly ahead of the jelly (within about 70°, cos 70° ≈ 0.3) so it keeps curving forward
// instead of doubling back. Gives up after 20 tries and takes the last one.
function pickJellyTarget(j) {
  let p = j.area.randomPoint();
  for (let tries = 0; tries < 20 && jellyAheadness(j, p) < 0.3; tries++) p = j.area.randomPoint();
  return p;
}

function updateJelly(j, dt) {
  j.time += dt;
  // pulse swings -1..1. Above 0 the bell is squeezing (narrower and taller), and that's when it pushes.
  j.pulse = Math.sin(j.time * 3);

  const [x, y, z] = j.pos;
  const dx = j.target[0] - x, dy = j.target[1] - y, dz = j.target[2] - z;
  const flatDist = Math.hypot(dx, dz);
  // Close to the spot, or drifted past it so it's now behind? Pick a new spot ahead instead of turning back.
  if (flatDist < 1.0 || (flatDist < 2.5 && jellyAheadness(j, j.target) < 0)) j.target = pickJellyTarget(j);

  // Turn toward the target, same math as the fish's yaw but capped at turn (slow), so it always curves.
  let err = Math.atan2(-dz, dx) - j.heading;
  err = Math.atan2(Math.sin(err), Math.cos(err));  // wrap to -180°..180° so it turns the short way
  j.heading += clampTo(1.5 * err, -j.turn, j.turn) * dt;

  // Speed: each squeeze adds to it, and drag takes a little away every moment.
  // e^(-drag * dt) is just under 1 (0.984 at 60 fps), so it keeps 98.4% of its speed each frame and glides between pulses.
  // Average speed: max(0, sin) averages 1/π ≈ 0.32, so about thrust × 0.32 / drag = 1.3 × 0.32 / 1 ≈ 0.4 units a second.
  j.speed = (j.speed + j.thrust * Math.max(0, j.pulse) * dt) * Math.exp(-j.drag * dt);

  // Move forward along the heading. Up and down it just eases toward the target's height (closing 30% of the gap
  // per second) and sinks a little (0.02 a second). area.clamp keeps it inside its area.
  j.pos = j.area.clamp([x + Math.cos(j.heading) * j.speed * dt,
                        y + (0.3 * dy - 0.02) * dt,
                        z - Math.sin(j.heading) * j.speed * dt]);

  // Lean the bell's top toward its heading: none when still, up to 0.35 radians (about 20°) at 0.4 units a second.
  // Heading direction is (cos, -sin) in x and z. Tipping toward +z is rotateX(+), toward +x is rotateZ(-).
  // Eased (closing 2× the gap per second) so it doesn't snap.
  const lean = 0.35 * Math.min(1, j.speed / 0.4);
  j.leanX += (lean * -Math.sin(j.heading) - j.leanX) * Math.min(1, 2 * dt);
  j.leanZ += (-lean * Math.cos(j.heading) - j.leanZ) * Math.min(1, 2 * dt);
  j.matrix = compose(translate(...j.pos), rotateX(j.leanX), rotateZ(j.leanZ));
}


// ---------- Things rooted in place ----------

// Sway for anything anchored at its base (coral tubes, seaweed): two small angles in radians,
// one for side to side (use with rotateZ) and one for front to back (use with rotateX).
// seed gives each piece its own timing so a cluster doesn't move in lockstep.
// amount 0.06 is about 3° each way.
export function sway(t, seed, amount = 0.06) {
  return [amount * Math.sin(1.3 * t + seed), amount * Math.sin(1.1 * t + 2 * seed)];
}

// Where bubble number i (of count) is at time t, rising from source = [x, y, z]. Returns { pos, radius }.
// life goes 0 -> 1 as the bubble rises, then wraps back to 0 (% 1 keeps only the part after the decimal).
// + i / count staggers the start times so they don't all leave at once.
// e.g. speed 0.6, rise 4, t = 10: 10 * 0.6 / 4 = 1.5, % 1 = 0.5, so halfway up
export function bubbleAt(t, i, count, source, rise = 4) {
  const speed = 0.6 + 0.4 * ((i * 7) % 5) / 5;  // each bubble gets its own speed, 0.6 to 0.92 units a second
  const life = (t * speed / rise + i / count) % 1;
  const wobble = 0.15 * life;                   // drifts side to side more the higher it gets
  return {
    pos: [source[0] + wobble * Math.sin(4 * t + i * 2.1),
          source[1] + life * rise,
          source[2] + wobble * Math.cos(3.3 * t + i * 1.3)],
    radius: 0.04 + 0.05 * life                  // grows as it rises (less water pressure higher up)
  };
}