// spawner.js: keeps the ocean full of life around the player without running thousands of creatures.
// A fixed crowd of fish, schools and jellyfish lives near the player. Each one wanders its own patch
// of water (its "home"). When the player moves on and a creature ends up far behind, hidden in the fog,
// it's moved to a new home out in the fog around the player, so wherever you explore there's sea life.
// Also scatters coral and vents across the whole floor. Renderer-agnostic: drawing goes through seaLife.
//
//   const spawner = createSpawner(seaLife, { center: () => sub.getPosition(), floorY: 0 });
//   spawner.update(dt, { obstacles, others: [sub] });   // every frame

import { boxArea, insideObstacle, createFish, createSchool, createJelly } from './creatures.js';
import { SEA_MATERIALS as M } from './sea-life.js';

const FISH_LOOKS = [[M.blueFish, M.blueFin], [M.redFish, M.redFin], [M.tealFish, M.tealFin], [M.orangeFish, M.orangeFin]];

// Random number between lo and hi
const between = (lo, hi) => lo + Math.random() * (hi - lo);

// Distance between two points seen from above (ignores height), since "far away" is about x and z
const flatDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// A random spot on a ring around center, between minR and maxR away (seen from above), at height y.
// Angle around the circle × distance out, same circle math as the sphere: (cos a, sin a) × distance.
// bounds (optional) = [minX, maxX, minZ, maxZ] keeps it over the floor.
function spotAround(center, minR, maxR, y, bounds) {
  const a = Math.random() * 2 * Math.PI, d = between(minR, maxR);
  let x = center[0] + Math.cos(a) * d, z = center[2] + Math.sin(a) * d;
  if (bounds) {
    x = Math.min(bounds[1], Math.max(bounds[0], x));
    z = Math.min(bounds[3], Math.max(bounds[2], z));
  }
  return [x, y, z];
}

// Same as spotAround, but tries again (up to 20 times) if the spot lands in or next to an obstacle
function clearSpotAround(center, minR, maxR, y, bounds, obstacles) {
  let spot = spotAround(center, minR, maxR, y, bounds);
  for (let tries = 0; tries < 20 && insideObstacle(spot, obstacles, 1.5); tries++) spot = spotAround(center, minR, maxR, y, bounds);
  return spot;
}

// Keeps v between lo and hi
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A creature's home: a box of water homeSize wide and homeHeight tall around spot,
// cut off so it never goes below low or above high (the floor and the top of the water)
function homeAround(spot, homeSize, homeHeight, [low, high]) {
  const w = homeSize / 2, h = homeHeight / 2;
  return boxArea([spot[0] - w, Math.max(low, spot[1] - h), spot[2] - w],
                 [spot[0] + w, Math.min(high, spot[1] + h), spot[2] + w]);
}

// Makes the crowd and registers every creature with seaLife so it gets drawn. Settings:
//   center()          where the player is right now, e.g. () => sub.getPosition()
//   floorY, ceilingY  the seafloor and the top of the water; nothing spawns outside them
//   fishMinAbove      fish stay at least this high above the floor (jellyMinAbove for jellyfish)
//   counts            how many fish, schools and jellyfish to keep alive
//   verticalRange     new creatures appear up to this far above or below the player
//   startRing         first spawn: between these distances from the player (seen from above)
//   respawnRing       later spawns: out in the fog, between these distances
//   despawnDistance   a creature this far away (seen from above) gets moved to a new home...
//   verticalDespawn   ...and so does one this far above or below the player
//   homeSize, homeHeight  how wide and tall each creature's patch of water is
//   bounds            optional [minX, maxX, minZ, maxZ] of the floor, so nothing spawns past its edge
//   obstacles         keep-out zones, so nothing starts inside the coral, vents or props
export function createSpawner(seaLife, {
  center, floorY = 0, ceilingY = floorY + 40,
  fishMinAbove = 1.2, jellyMinAbove = 4,
  fishCount = 25, schoolCount = 4, jellyCount = 8,
  verticalRange = 10,
  startRing = [12, 55], respawnRing = [45, 65], despawnDistance = 80, verticalDespawn = 15,
  homeSize = 16, homeHeight = 10, bounds = null, obstacles = []
}) {
  const fishY = [floorY + fishMinAbove, ceilingY];    // lowest and highest a fish can be
  const jellyY = [floorY + jellyMinAbove, ceilingY];

  // A height near the player's: up to verticalRange above or below, kept inside the water.
  // e.g. player at 30 m, verticalRange 10: somewhere from 20 to 40 m.
  const heightNear = (playerY, [low, high]) => clamp(playerY + between(-verticalRange, verticalRange), low, high);

  // Too far away to matter: far off to the side, or far above or below the player
  const tooFar = (pos, c) => flatDistance(pos, c) > despawnDistance || Math.abs(pos[1] - c[1]) > verticalDespawn;

  const c = center();

  // ---------- make the crowd ----------
  const fishes = [];
  for (let i = 0; i < fishCount; i++) {
    const spot = clearSpotAround(c, startRing[0], startRing[1], heightNear(c[1], fishY), bounds, obstacles);
    // Sizes 0.4 to 0.65 (about 1.2 to 2 m long) and speeds 1 to 1.6 m/s so they don't all look the same
    const fish = createFish({ start: spot, size: between(0.4, 0.65), speed: between(1.0, 1.6),
                              area: homeAround(spot, homeSize, homeHeight, fishY) });
    const [body, fin] = FISH_LOOKS[i % FISH_LOOKS.length];
    seaLife.addFish(fish, body, fin);
    fishes.push(fish);
  }

  const schools = [];
  for (let i = 0; i < schoolCount; i++) {
    const spot = clearSpotAround(c, startRing[0], startRing[1], heightNear(c[1], fishY), bounds, obstacles);
    const school = createSchool({ start: spot, size: between(0.18, 0.25), speed: between(1.7, 2.1),
                                  area: homeAround(spot, homeSize * 1.5, homeHeight, fishY) });
    for (const f of school.members) seaLife.addFish(f, M.yellowFish, M.orangeFin);
    schools.push(school);
  }

  const jellies = [];
  for (let i = 0; i < jellyCount; i++) {
    const spot = clearSpotAround(c, startRing[0], startRing[1], heightNear(c[1], jellyY), bounds, obstacles);
    const jelly = createJelly({ start: spot, size: between(0.7, 1.1), area: homeAround(spot, homeSize, homeHeight, jellyY) });
    seaLife.addJelly(jelly);
    jellies.push(jelly);
  }

  // ---------- recycling ----------
  // Moves a creature to a fresh home out in the fog around the player, at a height near the player's,
  // and clears its old target so it starts wandering its new patch. It's out of sight before and after.
  // If the player is off the edge of the map, the nearest spot over the floor can still be too far away;
  // then the creature just stays where it is instead of being moved again every frame.
  // Returns true if it moved.
  function respawn(creature, band, size, obstacles) {
    const c = center();
    const spot = clearSpotAround(c, respawnRing[0], respawnRing[1], heightNear(c[1], band), bounds, obstacles);
    if (flatDistance(spot, c) > despawnDistance) return false;
    creature.pos = spot;
    creature.area = homeAround(spot, size, homeHeight, band);
    creature.target = creature.area.randomPoint();
    return true;
  }

  const leaders = schools.map(s => s.leader);
  return {
    fishes, schools, jellies,

    // Every frame: recycle anything that's too far away (sideways, above or below), then move everyone.
    // obstacles = keep-out zones; others = extra things to swerve around (anything with pos and size, like the sub)
    update(dt, { obstacles = [], others = [] } = {}) {
      const c = center();
      for (const f of fishes) if (tooFar(f.pos, c)) respawn(f, fishY, homeSize, obstacles);
      for (const s of schools) {
        // forget the old path so the followers jump to the new spot with their leader
        if (tooFar(s.leader.pos, c) && respawn(s.leader, fishY, homeSize * 1.5, obstacles)) s.history.length = 0;
      }
      for (const j of jellies) if (tooFar(j.pos, c)) respawn(j, jellyY, homeSize, obstacles);

      for (const j of jellies) j.update(dt);
      const crowd = [...fishes, ...leaders, ...jellies, ...others];
      for (const f of fishes) f.update(dt, { obstacles, others: crowd });
      for (const s of schools) s.update(dt, { obstacles, others: crowd });
    }
  };
}

// Small random number generator that gives the same "random" numbers every time for the same seed,
// so the scattered coral and vents land in the same places on every load (mulberry32).
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scatters coral clusters and vents across the floor. bounds = [minX, maxX, minZ, maxZ].
// keepClear = zones nothing should land in (other props, the player's start), as { x, z, r }.
// Each piece stays at least spacing metres from the others. Their keep-out zones end up in seaLife.obstacles.
export function scatterScenery(seaLife, { corals = 40, vents = 10, bounds, floorY = 0, keepClear = [], spacing = 7, seed = 412 }) {
  const rand = seededRandom(seed);
  const placed = [...keepClear];
  const free = (x, z, r) => placed.every(p => Math.hypot(x - p.x, z - p.z) > r + p.r + spacing / 2);

  const place = (count, add, radius) => {
    for (let i = 0, tries = 0; i < count && tries < count * 50; tries++) {
      const x = bounds[0] + rand() * (bounds[1] - bounds[0]);
      const z = bounds[2] + rand() * (bounds[3] - bounds[2]);
      const size = 0.8 + rand() * 0.6;   // 0.8 to 1.4 times normal size
      if (!free(x, z, radius * size)) continue;
      add(x, z, floorY, size);
      placed.push({ x, z, r: radius * size });
      i++;
    }
  };
  place(vents, seaLife.addVent, 1.1);
  place(corals, seaLife.addCoral, 1.2);
}