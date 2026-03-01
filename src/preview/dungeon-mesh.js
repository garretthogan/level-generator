import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getRandomFloorMaterial, getRandomWallMaterial } from './dark-textures.js';

// Ref: https://threejs.org/docs/#api/en/materials/MeshStandardMaterial
const FLOOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4a4a5e,
  roughness: 0.85,
  metalness: 0,
});

const WALL_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x5a5a7a,
  roughness: 0.7,
  metalness: 0.05,
});

const FLOOR_THICKNESS = 0.2;
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.15;

/**
 * @param {object} steps - Dungeon generation steps
 * @param {object} config - { dungeonWidth, dungeonHeight }
 * @param {THREE.Texture[]} [darkTextures] - If provided, random Dark folder textures applied per floor tile and wall segment.
 */
export function buildDungeonMeshes(steps, config, darkTextures = null) {
  const { dungeonWidth, dungeonHeight } = config;
  const grid = buildFloorGrid(steps, dungeonWidth, dungeonHeight);
  const rooms = extractRooms(steps);
  const spawnRoom = rooms[0];

  const offsetX = -dungeonWidth / 2;
  const offsetZ = -dungeonHeight / 2;

  const group = new THREE.Group();

  const floorMesh = buildFloorMesh(grid, dungeonWidth, dungeonHeight, offsetX, offsetZ, darkTextures);
  if (floorMesh) {
    group.add(floorMesh);
  } else if (!darkTextures?.length) {
    const fallbackGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
    fallbackGeo.translate(offsetX + 0.5, -FLOOR_THICKNESS / 2, offsetZ + 0.5);
    group.add(new THREE.Mesh(fallbackGeo, FLOOR_MATERIAL));
  }

  let exits = [];
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].exits) {
      exits = steps[i].exits;
      break;
    }
  }
  const wallMesh = buildWallMesh(grid, dungeonWidth, dungeonHeight, offsetX, offsetZ, darkTextures, exits);
  if (wallMesh) group.add(wallMesh);

  const lights = buildRoomLights(rooms, offsetX, offsetZ);
  for (const light of lights) group.add(light);

  const spawnPoint = spawnRoom
    ? new THREE.Vector3(
        spawnRoom.x + spawnRoom.width / 2 + offsetX,
        1.6,
        spawnRoom.y + spawnRoom.height / 2 + offsetZ,
      )
    : new THREE.Vector3(0, 1.6, 0);

  return { group, grid, spawnPoint, offsetX, offsetZ };
}

function buildFloorGrid(steps, width, height) {
  const grid = Array.from({ length: height }, () => new Uint8Array(width));

  for (const step of steps) {
    if (step.room) fillRect(grid, step.room, width, height);
    if (step.segments) {
      for (const seg of step.segments) fillRect(grid, seg, width, height);
    }
  }

  return grid;
}

function fillRect(grid, rect, gridW, gridH) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(gridW, rect.x + rect.width);
  const y1 = Math.min(gridH, rect.y + rect.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      grid[y][x] = 1;
    }
  }
}

function extractRooms(steps) {
  return steps.filter((s) => s.room).map((s) => s.room);
}

function buildFloorMesh(grid, w, h, offsetX, offsetZ, darkTextures = null) {
  const tileGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  const tiles = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y][x]) continue;
      const clone = tileGeo.clone();
      clone.translate(x + 0.5 + offsetX, -FLOOR_THICKNESS / 2, y + 0.5 + offsetZ);
      tiles.push(clone);
    }
  }

  tileGeo.dispose();
  if (tiles.length === 0) return null;

  if (darkTextures?.length) {
    const group = new THREE.Group();
    for (const geo of tiles) {
      const mat = getRandomFloorMaterial(darkTextures, { repeatX: 1, repeatY: 1 });
      group.add(new THREE.Mesh(geo, mat));
    }
    return group;
  }

  const merged = mergeGeometries(tiles);
  for (const t of tiles) t.dispose();
  return new THREE.Mesh(merged, FLOOR_MATERIAL);
}

function buildWallMesh(grid, w, h, offsetX, offsetZ, darkTextures = null, exits = null) {
  const walls = [];

  const wallNS = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
  const wallEW = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, 1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y][x]) continue;

      const cx = x + 0.5 + offsetX;
      const cz = y + 0.5 + offsetZ;
      const wy = WALL_HEIGHT / 2;

      if ((y === 0 || !grid[y - 1][x]) && !isWallOnExit(x, y, 'n', w, h, exits)) {
        const g = wallNS.clone();
        g.translate(cx, wy, cz - 0.5 + WALL_THICKNESS / 2);
        walls.push(g);
      }
      if ((y === h - 1 || !grid[y + 1][x]) && !isWallOnExit(x, y, 's', w, h, exits)) {
        const g = wallNS.clone();
        g.translate(cx, wy, cz + 0.5 - WALL_THICKNESS / 2);
        walls.push(g);
      }
      if ((x === 0 || !grid[y][x - 1]) && !isWallOnExit(x, y, 'w', w, h, exits)) {
        const g = wallEW.clone();
        g.translate(cx - 0.5 + WALL_THICKNESS / 2, wy, cz);
        walls.push(g);
      }
      if ((x === w - 1 || !grid[y][x + 1]) && !isWallOnExit(x, y, 'e', w, h, exits)) {
        const g = wallEW.clone();
        g.translate(cx + 0.5 - WALL_THICKNESS / 2, wy, cz);
        walls.push(g);
      }
    }
  }

  wallNS.dispose();
  wallEW.dispose();
  if (walls.length === 0) return null;

  if (darkTextures?.length) {
    const group = new THREE.Group();
    for (const geo of walls) {
      const mat = getRandomWallMaterial(darkTextures, { repeatX: 1, repeatY: WALL_HEIGHT });
      group.add(new THREE.Mesh(geo, mat));
    }
    return group;
  }

  const merged = mergeGeometries(walls);
  for (const w of walls) w.dispose();
  return new THREE.Mesh(merged, WALL_MATERIAL);
}

function buildRoomLights(rooms, offsetX, offsetZ) {
  return rooms.map((room) => {
    const light = new THREE.PointLight(0xaaccff, 5, 35, 1.5);
    light.position.set(
      room.x + room.width / 2 + offsetX,
      2.5,
      room.y + room.height / 2 + offsetZ,
    );
    return light;
  });
}

/**
 * Returns true if a wall segment at (x, y) on the given side should be skipped because it lies on an exit.
 * @param {number} x - Cell x (column)
 * @param {number} y - Cell y (row)
 * @param {'n'|'s'|'e'|'w'} side
 * @param {number} width
 * @param {number} height
 * @param {{ side: string, x?: number, z?: number, span: number }[]} exits
 */
function isWallOnExit(x, y, side, width, height, exits) {
  if (!exits?.length) return false;
  for (const ex of exits) {
    if (ex.side !== side) continue;
    const start = side === 'n' || side === 's' ? ex.x : ex.z;
    const span = ex.span ?? 1;
    if (side === 'n' && y === 0 && x >= start && x < start + span) return true;
    if (side === 's' && y === height - 1 && x >= start && x < start + span) return true;
    if (side === 'w' && x === 0 && y >= start && y < start + span) return true;
    if (side === 'e' && x === width - 1 && y >= start && y < start + span) return true;
  }
  return false;
}

/**
 * Build dungeon geometry as separate meshes (one per floor tile, one per wall segment)
 * for GLB export so each piece can be edited individually in another editor.
 * If any step has step.exits, wall segments at those positions are omitted so exits stay open.
 * Returns only the group with mesh children; no lights.
 */
export function buildDungeonMeshesForExport(steps, config) {
  const { dungeonWidth, dungeonHeight } = config;
  const grid = buildFloorGrid(steps, dungeonWidth, dungeonHeight);
  const offsetX = -dungeonWidth / 2;
  const offsetZ = -dungeonHeight / 2;

  let exits = [];
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].exits) {
      exits = steps[i].exits;
      break;
    }
  }

  const group = new THREE.Group();
  group.name = 'dungeon';

  const tileGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  for (let y = 0; y < dungeonHeight; y++) {
    for (let x = 0; x < dungeonWidth; x++) {
      if (!grid[y][x]) continue;
      const geo = tileGeo.clone();
      geo.translate(x + 0.5 + offsetX, -FLOOR_THICKNESS / 2, y + 0.5 + offsetZ);
      const mesh = new THREE.Mesh(geo, FLOOR_MATERIAL);
      mesh.name = `Floor_${y}_${x}`;
      group.add(mesh);
    }
  }
  tileGeo.dispose();

  const wallNS = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
  const wallEW = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, 1);
  let wallIndex = 0;
  for (let y = 0; y < dungeonHeight; y++) {
    for (let x = 0; x < dungeonWidth; x++) {
      if (!grid[y][x]) continue;

      const cx = x + 0.5 + offsetX;
      const cz = y + 0.5 + offsetZ;
      const wy = WALL_HEIGHT / 2;

      if ((y === 0 || !grid[y - 1][x]) && !isWallOnExit(x, y, 'n', dungeonWidth, dungeonHeight, exits)) {
        const g = wallNS.clone();
        g.translate(cx, wy, cz - 0.5 + WALL_THICKNESS / 2);
        const m = new THREE.Mesh(g, WALL_MATERIAL);
        m.name = `Wall_${wallIndex++}`;
        group.add(m);
      }
      if ((y === dungeonHeight - 1 || !grid[y + 1][x]) && !isWallOnExit(x, y, 's', dungeonWidth, dungeonHeight, exits)) {
        const g = wallNS.clone();
        g.translate(cx, wy, cz + 0.5 - WALL_THICKNESS / 2);
        const m = new THREE.Mesh(g, WALL_MATERIAL);
        m.name = `Wall_${wallIndex++}`;
        group.add(m);
      }
      if ((x === 0 || !grid[y][x - 1]) && !isWallOnExit(x, y, 'w', dungeonWidth, dungeonHeight, exits)) {
        const g = wallEW.clone();
        g.translate(cx - 0.5 + WALL_THICKNESS / 2, wy, cz);
        const m = new THREE.Mesh(g, WALL_MATERIAL);
        m.name = `Wall_${wallIndex++}`;
        group.add(m);
      }
      if ((x === dungeonWidth - 1 || !grid[y][x + 1]) && !isWallOnExit(x, y, 'e', dungeonWidth, dungeonHeight, exits)) {
        const g = wallEW.clone();
        g.translate(cx + 0.5 - WALL_THICKNESS / 2, wy, cz);
        const m = new THREE.Mesh(g, WALL_MATERIAL);
        m.name = `Wall_${wallIndex++}`;
        group.add(m);
      }
    }
  }
  wallNS.dispose();
  wallEW.dispose();

  return { group };
}
