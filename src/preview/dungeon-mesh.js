import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

function getExitsFromSteps(steps) {
  const step = steps.find((s) => s.exits && s.exits.length > 0);
  return step ? step.exits : [];
}

export function buildDungeonMeshes(steps, config) {
  const { dungeonWidth, dungeonHeight } = config;
  const exits = getExitsFromSteps(steps);
  const grid = buildFloorGrid(steps, dungeonWidth, dungeonHeight, exits);
  const rooms = extractRooms(steps);
  const spawnRoom = rooms[0];

  const offsetX = -dungeonWidth / 2;
  const offsetZ = -dungeonHeight / 2;

  const group = new THREE.Group();

  const floorMesh = buildFloorMesh(grid, dungeonWidth, dungeonHeight, offsetX, offsetZ);
  if (floorMesh) {
    group.add(floorMesh);
  } else {
    const fallbackGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
    fallbackGeo.translate(offsetX + 0.5, -FLOOR_THICKNESS / 2, offsetZ + 0.5);
    group.add(new THREE.Mesh(fallbackGeo, FLOOR_MATERIAL));
  }

  const wallMesh = buildWallMesh(grid, dungeonWidth, dungeonHeight, offsetX, offsetZ, exits);
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

function buildFloorGrid(steps, width, height, exits = []) {
  const grid = Array.from({ length: height }, () => new Uint8Array(width));

  for (const step of steps) {
    if (step.room) fillRect(grid, step.room, width, height);
    if (step.segments) {
      for (const seg of step.segments) fillRect(grid, seg, width, height);
    }
  }

  for (const ex of exits) {
    if (ex.side === 'n') fillRect(grid, { x: ex.x, y: 0, width: ex.span, height: 1 }, width, height);
    else if (ex.side === 's') fillRect(grid, { x: ex.x, y: height - 1, width: ex.span, height: 1 }, width, height);
    else if (ex.side === 'w') fillRect(grid, { x: 0, y: ex.z, width: 1, height: ex.span }, width, height);
    else if (ex.side === 'e') fillRect(grid, { x: width - 1, y: ex.z, width: 1, height: ex.span }, width, height);
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

function buildFloorMesh(grid, w, h, offsetX, offsetZ) {
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

  const merged = mergeGeometries(tiles);
  for (const t of tiles) t.dispose();
  return new THREE.Mesh(merged, FLOOR_MATERIAL);
}

function buildWallMesh(grid, w, h, offsetX, offsetZ, exits = []) {
  const walls = [];

  const wallNS = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
  const wallEW = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, 1);

  const inExitN = (x) => exits.some((ex) => ex.side === 'n' && x >= ex.x && x < ex.x + ex.span);
  const inExitS = (x) => exits.some((ex) => ex.side === 's' && x >= ex.x && x < ex.x + ex.span);
  const inExitW = (z) => exits.some((ex) => ex.side === 'w' && z >= ex.z && z < ex.z + ex.span);
  const inExitE = (z) => exits.some((ex) => ex.side === 'e' && z >= ex.z && z < ex.z + ex.span);

  const skipNorthWall = (x, y) => (y === 0 && inExitN(x)) || (y > 0 && inExitN(x) && !grid[y - 1][x]);
  const skipSouthWall = (x, y) => (y === h - 1 && inExitS(x)) || (y < h - 1 && inExitS(x) && !grid[y + 1][x]);
  const skipWestWall = (x, y) => (x === 0 && inExitW(y)) || (x > 0 && inExitW(y) && !grid[y][x - 1]);
  const skipEastWall = (x, y) => (x === w - 1 && inExitE(y)) || (x < w - 1 && inExitE(y) && !grid[y][x + 1]);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y][x]) continue;

      const cx = x + 0.5 + offsetX;
      const cz = y + 0.5 + offsetZ;
      const wy = WALL_HEIGHT / 2;

      if (y === 0 || !grid[y - 1][x]) {
        if (!skipNorthWall(x, y)) {
          const g = wallNS.clone();
          g.translate(cx, wy, cz - 0.5 + WALL_THICKNESS / 2);
          walls.push(g);
        }
      }
      if (y === h - 1 || !grid[y + 1][x]) {
        if (!skipSouthWall(x, y)) {
          const g = wallNS.clone();
          g.translate(cx, wy, cz + 0.5 - WALL_THICKNESS / 2);
          walls.push(g);
        }
      }
      if (x === 0 || !grid[y][x - 1]) {
        if (!skipWestWall(x, y)) {
          const g = wallEW.clone();
          g.translate(cx - 0.5 + WALL_THICKNESS / 2, wy, cz);
          walls.push(g);
        }
      }
      if (x === w - 1 || !grid[y][x + 1]) {
        if (!skipEastWall(x, y)) {
          const g = wallEW.clone();
          g.translate(cx + 0.5 - WALL_THICKNESS / 2, wy, cz);
          walls.push(g);
        }
      }
    }
  }

  wallNS.dispose();
  wallEW.dispose();
  if (walls.length === 0) return null;

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
