import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getRandomFloorMaterial, getRandomWallMaterial } from './dark-textures.js';

// Same materials as dungeon-mesh for consistent look
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
 * Build 3D meshes from arena generator result.
 * Arena grid is column-major: grid[x][z], 0 = open (floor), 1 = wall.
 * Returns group, walkable grid for player (rows x cols, 1 = walkable), spawn point, offsets.
 * @param {object} arenaResult - { grids, spawns, flags, collisionPoints, covers }
 * @param {THREE.Texture[]} [darkTextures] - If provided, random Dark folder textures applied per floor tile and wall segment.
 */
export function buildArenaMeshes(arenaResult, darkTextures = null) {
  if (!arenaResult?.grids?.length) {
    const fallback = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
    fallback.add(new THREE.Mesh(geo, FLOOR_MATERIAL));
    const grid = [new Uint8Array(1)];
    grid[0][0] = 1;
    return {
      group: fallback,
      grid,
      spawnPoint: new THREE.Vector3(0, 1.6, 0),
      offsetX: -0.5,
      offsetZ: -0.5,
    };
  }

  const grid = arenaResult.grids[0];
  const cols = grid.length;
  const row0 = grid[0];
  const rows = row0 != null && row0.length != null ? row0.length : 0;
  if (cols === 0 || rows === 0) {
    const fallback = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
    fallback.add(new THREE.Mesh(geo, FLOOR_MATERIAL));
    const emptyGrid = [new Uint8Array(1)];
    emptyGrid[0][0] = 1;
    return {
      group: fallback,
      grid: emptyGrid,
      spawnPoint: new THREE.Vector3(0, 1.6, 0),
      offsetX: -0.5,
      offsetZ: -0.5,
    };
  }
  const offsetX = -cols / 2;
  const offsetZ = -rows / 2;

  // Player expects floorGrid[z][x], 1 = walkable (open cell)
  const floorGrid = Array.from({ length: rows }, () => new Uint8Array(cols));
  for (let x = 0; x < cols; x++) {
    for (let z = 0; z < rows; z++) {
      floorGrid[z][x] = grid[x][z] === 0 ? 1 : 0;
    }
  }

  const group = new THREE.Group();

  const floorMesh = buildArenaFloorMesh(grid, cols, rows, offsetX, offsetZ, darkTextures);
  if (floorMesh) group.add(floorMesh);

  const wallMesh = buildArenaWallMesh(grid, cols, rows, offsetX, offsetZ, darkTextures);
  if (wallMesh) group.add(wallMesh);

  const lights = buildArenaLights(grid, cols, rows, offsetX, offsetZ);
  for (const light of lights) group.add(light);

  const spawn = arenaResult.spawns?.[0];
  const spawnPoint = spawn
    ? new THREE.Vector3(spawn.x + 0.5 + offsetX, 1.6, spawn.z + 0.5 + offsetZ)
    : new THREE.Vector3(offsetX + 0.5, 1.6, offsetZ + 0.5);

  return { group, grid: floorGrid, spawnPoint, offsetX, offsetZ };
}

function buildArenaFloorMesh(grid, cols, rows, offsetX, offsetZ, darkTextures = null) {
  const tileGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  const tiles = [];

  for (let x = 0; x < cols; x++) {
    for (let z = 0; z < rows; z++) {
      if (grid[x][z] !== 0) continue;
      const clone = tileGeo.clone();
      clone.translate(x + 0.5 + offsetX, -FLOOR_THICKNESS / 2, z + 0.5 + offsetZ);
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

function buildArenaWallMesh(grid, cols, rows, offsetX, offsetZ, darkTextures = null) {
  const walls = [];
  const wallNS = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
  const wallEW = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, 1);

  for (let x = 0; x < cols; x++) {
    for (let z = 0; z < rows; z++) {
      if (grid[x][z] !== 0) continue;

      const cx = x + 0.5 + offsetX;
      const cz = z + 0.5 + offsetZ;
      const wy = WALL_HEIGHT / 2;

      if (z === 0 || grid[x][z - 1] === 1) {
        const g = wallNS.clone();
        g.translate(cx, wy, cz - 0.5 + WALL_THICKNESS / 2);
        walls.push(g);
      }
      if (z === rows - 1 || grid[x][z + 1] === 1) {
        const g = wallNS.clone();
        g.translate(cx, wy, cz + 0.5 - WALL_THICKNESS / 2);
        walls.push(g);
      }
      if (x === 0 || grid[x - 1][z] === 1) {
        const g = wallEW.clone();
        g.translate(cx - 0.5 + WALL_THICKNESS / 2, wy, cz);
        walls.push(g);
      }
      if (x === cols - 1 || grid[x + 1][z] === 1) {
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

function buildArenaLights(grid, cols, rows, offsetX, offsetZ) {
  const lights = [];
  const stride = Math.max(2, Math.floor(Math.min(cols, rows) / 4));
  for (let x = Math.floor(stride / 2); x < cols; x += stride) {
    const col = grid[x];
    if (!col || col.length <= 0) continue;
    for (let z = Math.floor(stride / 2); z < rows && z < col.length; z += stride) {
      if (col[z] !== 0) continue;
      const light = new THREE.PointLight(0xaaccff, 5, 35, 1.5);
      light.position.set(x + 0.5 + offsetX, 2.5, z + 0.5 + offsetZ);
      lights.push(light);
    }
  }
  if (lights.length === 0) {
    const light = new THREE.PointLight(0xaaccff, 5, 35, 1.5);
    light.position.set(offsetX + cols / 2, 2.5, offsetZ + rows / 2);
    lights.push(light);
  }
  return lights;
}

/**
 * Build arena geometry as separate meshes (one per floor tile, one per wall segment)
 * for GLB export so each piece can be edited individually in another editor.
 * Returns only the group with mesh children; no lights.
 */
export function buildArenaMeshesForExport(arenaResult) {
  if (!arenaResult?.grids?.length) {
    const group = new THREE.Group();
    group.name = 'arena';
    const geo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
    group.add(new THREE.Mesh(geo, FLOOR_MATERIAL));
    return { group };
  }

  const grid = arenaResult.grids[0];
  const cols = grid.length;
  const rows = grid[0]?.length ?? 0;
  if (cols === 0 || rows === 0) {
    const group = new THREE.Group();
    group.name = 'arena';
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1), FLOOR_MATERIAL));
    return { group };
  }

  const offsetX = -cols / 2;
  const offsetZ = -rows / 2;
  const group = new THREE.Group();
  group.name = 'arena';

  const tileGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  for (let x = 0; x < cols; x++) {
    for (let z = 0; z < rows; z++) {
      if (grid[x][z] !== 0) continue;
      const geo = tileGeo.clone();
      geo.translate(x + 0.5 + offsetX, -FLOOR_THICKNESS / 2, z + 0.5 + offsetZ);
      const mesh = new THREE.Mesh(geo, FLOOR_MATERIAL);
      mesh.name = `Floor_${x}_${z}`;
      group.add(mesh);
    }
  }
  tileGeo.dispose();

  const wallNS = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
  const wallEW = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, 1);
  let wallIndex = 0;
  for (let x = 0; x < cols; x++) {
    for (let z = 0; z < rows; z++) {
      if (grid[x][z] !== 0) continue;

      const cx = x + 0.5 + offsetX;
      const cz = z + 0.5 + offsetZ;
      const wy = WALL_HEIGHT / 2;

      if (z === 0 || grid[x][z - 1] === 1) {
        const g = wallNS.clone();
        g.translate(cx, wy, cz - 0.5 + WALL_THICKNESS / 2);
        const m = new THREE.Mesh(g, WALL_MATERIAL);
        m.name = `Wall_${wallIndex++}`;
        group.add(m);
      }
      if (z === rows - 1 || grid[x][z + 1] === 1) {
        const g = wallNS.clone();
        g.translate(cx, wy, cz + 0.5 - WALL_THICKNESS / 2);
        const m = new THREE.Mesh(g, WALL_MATERIAL);
        m.name = `Wall_${wallIndex++}`;
        group.add(m);
      }
      if (x === 0 || grid[x - 1][z] === 1) {
        const g = wallEW.clone();
        g.translate(cx - 0.5 + WALL_THICKNESS / 2, wy, cz);
        const m = new THREE.Mesh(g, WALL_MATERIAL);
        m.name = `Wall_${wallIndex++}`;
        group.add(m);
      }
      if (x === cols - 1 || grid[x + 1][z] === 1) {
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
