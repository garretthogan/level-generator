import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
const WINDOW_SILL_HEIGHT = 0.8;
const WINDOW_TOP_HEIGHT = 2.0;
const LINTEL_THICKNESS = 0.2;

function normalizeEdge(x1, y1, x2, y2) {
  if (x1 < x2 || (x1 === x2 && y1 <= y2)) return { x1, y1, x2, y2 };
  return { x1: x2, y1: y2, x2: x1, y2: y1 };
}

function edgeKey(edge) {
  return `${edge.x1},${edge.y1}|${edge.x2},${edge.y2}`;
}

/**
 * Build floor grid from plan rooms and hallways (cells in grid coordinates).
 * Returns a 2D array grid[row][col] and width/height.
 */
function buildFloorGridFromPlan(plan) {
  const w = Math.max(1, Number(plan.meta?.width) ?? 36);
  const h = Math.max(1, Number(plan.meta?.height) ?? 24);
  const grid = Array.from({ length: h }, () => new Uint8Array(w));

  const setCell = (x, y) => {
    const col = Math.floor(Number(x));
    const row = Math.floor(Number(y));
    if (row >= 0 && row < h && col >= 0 && col < w) grid[row][col] = 1;
  };

  for (const room of plan.rooms ?? []) {
    const cells = room.cells ?? [];
    for (const cell of cells) {
      setCell(cell.x, cell.y);
    }
  }
  for (const hallway of plan.hallways ?? []) {
    const cells = hallway.cells ?? [];
    for (const cell of cells) {
      setCell(cell.x, cell.y);
    }
  }

  return { grid, width: w, height: h };
}

function buildFloorMeshFromGrid(grid, width, height, offsetX, offsetZ) {
  const tileGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  const tiles = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
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

/**
 * Build wall segment geometry. Walls are in grid coordinates (x1,y1)-(x2,y2).
 * Horizontal: y1===y2; Vertical: x1===x2.
 */
function buildWallSegmentMesh(wall, offsetX, offsetZ) {
  const { x1, y1, x2, y2 } = wall;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return null;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const cx = midX + offsetX;
  const cz = midY + offsetZ;
  const wy = WALL_HEIGHT / 2;

  if (Math.abs(dy) < 1e-6) {
    const geo = new THREE.BoxGeometry(len, WALL_HEIGHT, WALL_THICKNESS);
    geo.translate(cx, wy, cz);
    return geo;
  }
  const geo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, len);
  geo.translate(cx, wy, cz);
  return geo;
}

/**
 * Build a box in the wall plane for an opening (x1,y1)-(x2,y2). lengthY = vertical extent in 3D.
 */
function buildOpeningBox(x1, y1, x2, y2, lengthY, offsetX, offsetZ, centerY) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return null;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const cx = midX + offsetX;
  const cz = midY + offsetZ;
  let geo;
  if (Math.abs(dy) < 1e-6) {
    geo = new THREE.BoxGeometry(len, lengthY, WALL_THICKNESS);
  } else {
    geo = new THREE.BoxGeometry(WALL_THICKNESS, lengthY, len);
  }
  geo.translate(cx, centerY, cz);
  return geo;
}

/**
 * Build blocking geometry for windows (sill + header) and lintels for doors.
 */
function buildOpeningMeshesFromPlan(plan, offsetX, offsetZ) {
  const openings = plan.openings ?? [];
  const geos = [];

  for (const opening of openings) {
    const x1 = Number(opening.x1);
    const y1 = Number(opening.y1);
    const x2 = Number(opening.x2);
    const y2 = Number(opening.y2);
    const type = opening.type;

    if (type === 'window') {
      const sillGeo = buildOpeningBox(
        x1, y1, x2, y2,
        WINDOW_SILL_HEIGHT,
        offsetX, offsetZ,
        WINDOW_SILL_HEIGHT / 2
      );
      if (sillGeo) geos.push(sillGeo);
      const headerHeight = WALL_HEIGHT - WINDOW_TOP_HEIGHT;
      const headerGeo = buildOpeningBox(
        x1, y1, x2, y2,
        headerHeight,
        offsetX, offsetZ,
        WINDOW_TOP_HEIGHT + headerHeight / 2
      );
      if (headerGeo) geos.push(headerGeo);
    } else if (type === 'door') {
      const lintelGeo = buildOpeningBox(
        x1, y1, x2, y2,
        LINTEL_THICKNESS,
        offsetX, offsetZ,
        WALL_HEIGHT - LINTEL_THICKNESS / 2
      );
      if (lintelGeo) geos.push(lintelGeo);
    }
  }

  if (geos.length === 0) return null;
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return new THREE.Mesh(merged, WALL_MATERIAL);
}

function buildWallMeshesFromPlan(plan, offsetX, offsetZ) {
  const walls = plan.walls ?? [];
  const openingKeys = new Set();
  for (const opening of plan.openings ?? []) {
    const edge = normalizeEdge(
      opening.x1, opening.y1,
      opening.x2, opening.y2
    );
    openingKeys.add(edgeKey(edge));
  }

  const geos = [];
  for (const wall of walls) {
    const key = edgeKey(normalizeEdge(wall.x1, wall.y1, wall.x2, wall.y2));
    if (openingKeys.has(key)) continue;
    const geo = buildWallSegmentMesh(wall, offsetX, offsetZ);
    if (geo) geos.push(geo);
  }

  if (geos.length === 0) return null;
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return new THREE.Mesh(merged, WALL_MATERIAL);
}

/** Extra padding so wall collision blocks before the player touches the visual wall (reduces clipping). */
const WALL_COLLISION_PADDING = 0.25;

/**
 * Build 2D wall segments in world coords (x, z) for collision.
 * Solid walls are thickened by WALL_COLLISION_PADDING so the player can't clip through.
 * Only window openings add blocking edges (sill/header); doors are left open so the player can walk through.
 * @returns {{ x1: number, z1: number, x2: number, z2: number }[]}
 */
function buildWallSegmentsForCollision(plan, offsetX, offsetZ) {
  const segments = [];

  function pushThickSegment(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    const nx = (-dz / len) * WALL_COLLISION_PADDING;
    const nz = (dx / len) * WALL_COLLISION_PADDING;
    const ax = x1 + nx;
    const az = z1 + nz;
    const bx = x2 + nx;
    const bz = z2 + nz;
    const cx = x2 - nx;
    const cz = z2 - nz;
    const dx0 = x1 - nx;
    const dz0 = z1 - nz;
    segments.push({ x1: ax, z1: az, x2: bx, z2: bz });
    segments.push({ x1: bx, z1: bz, x2: cx, z2: cz });
    segments.push({ x1: cx, z1: cz, x2: dx0, z2: dz0 });
    segments.push({ x1: dx0, z1: dz0, x2: ax, z2: az });
  }

  for (const wall of plan.walls ?? []) {
    const x1 = wall.x1 + offsetX;
    const z1 = wall.y1 + offsetZ;
    const x2 = wall.x2 + offsetX;
    const z2 = wall.y2 + offsetZ;
    pushThickSegment(x1, z1, x2, z2);
  }

  function pushRectEdges(cx, cz, halfLenX, halfLenZ) {
    const x0 = cx - halfLenX;
    const x1 = cx + halfLenX;
    const z0 = cz - halfLenZ;
    const z1 = cz + halfLenZ;
    segments.push({ x1: x0, z1: z0, x2: x1, z2: z0 });
    segments.push({ x1: x1, z1: z0, x2: x1, z2: z1 });
    segments.push({ x1: x1, z1: z1, x2: x0, z2: z1 });
    segments.push({ x1: x0, z1: z1, x2: x0, z2: z0 });
  }

  for (const opening of plan.openings ?? []) {
    if (opening.type === 'door') continue;
    const x1 = Number(opening.x1);
    const y1 = Number(opening.y1);
    const x2 = Number(opening.x2);
    const y2 = Number(opening.y2);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    const midX = (x1 + x2) / 2 + offsetX;
    const midZ = (y1 + y2) / 2 + offsetZ;
    const halfLen = len / 2;
    const halfThick = WALL_THICKNESS / 2;
    if (Math.abs(dy) < 1e-6) {
      pushRectEdges(midX, midZ, halfLen, halfThick);
    } else {
      pushRectEdges(midX, midZ, halfThick, halfLen);
    }
  }

  return segments;
}

function buildFloorPlanLights(plan, offsetX, offsetZ) {
  const spawns = plan.lightSpawns ?? [];
  return spawns.map((item) => {
    const light = new THREE.PointLight(0xaaccff, 5, 35, 1.5);
    light.position.set(
      Number(item.x) + offsetX,
      2.5,
      Number(item.y) + offsetZ,
    );
    return light;
  });
}

/**
 * Build floor plan meshes for 3D preview. Returns merged floor + walls, lights, grid, spawn point.
 */
export function buildFloorPlanMeshes(plan) {
  const { grid, width, height } = buildFloorGridFromPlan(plan);
  const offsetX = -width / 2;
  const offsetZ = -height / 2;

  const group = new THREE.Group();

  const floorMesh = buildFloorMeshFromGrid(grid, width, height, offsetX, offsetZ);
  if (floorMesh) group.add(floorMesh);
  else {
    const fallbackGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
    fallbackGeo.translate(offsetX + 0.5, -FLOOR_THICKNESS / 2, offsetZ + 0.5);
    group.add(new THREE.Mesh(fallbackGeo, FLOOR_MATERIAL));
  }

  const wallMesh = buildWallMeshesFromPlan(plan, offsetX, offsetZ);
  if (wallMesh) group.add(wallMesh);

  const openingMesh = buildOpeningMeshesFromPlan(plan, offsetX, offsetZ);
  if (openingMesh) group.add(openingMesh);

  const lights = buildFloorPlanLights(plan, offsetX, offsetZ);
  for (const light of lights) group.add(light);

  const rooms = plan.rooms ?? [];
  const spawnRoom = rooms[0];
  const spawnPoint = spawnRoom
    ? new THREE.Vector3(
        spawnRoom.labelX + offsetX,
        1.6,
        spawnRoom.labelY + offsetZ,
      )
    : new THREE.Vector3(offsetX + width / 2, 1.6, offsetZ + height / 2);

  const wallSegments = buildWallSegmentsForCollision(plan, offsetX, offsetZ);
  return { group, grid, spawnPoint, offsetX, offsetZ, wallSegments };
}

/**
 * Build floor plan geometry as separate meshes for GLB export (one per floor tile, one per wall segment).
 */
export function buildFloorPlanMeshesForExport(plan) {
  const { grid, width, height } = buildFloorGridFromPlan(plan);
  const offsetX = -width / 2;
  const offsetZ = -height / 2;

  const group = new THREE.Group();
  group.name = 'floor-plan';

  const tileGeo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!grid[y][x]) continue;
      const geo = tileGeo.clone();
      geo.translate(x + 0.5 + offsetX, -FLOOR_THICKNESS / 2, y + 0.5 + offsetZ);
      const mesh = new THREE.Mesh(geo, FLOOR_MATERIAL);
      mesh.name = `Floor_${y}_${x}`;
      group.add(mesh);
    }
  }
  tileGeo.dispose();

  const openingKeys = new Set();
  for (const opening of plan.openings ?? []) {
    const edge = normalizeEdge(
      opening.x1, opening.y1,
      opening.x2, opening.y2
    );
    openingKeys.add(edgeKey(edge));
  }

  let wallIndex = 0;
  for (const wall of plan.walls ?? []) {
    const key = edgeKey(normalizeEdge(wall.x1, wall.y1, wall.x2, wall.y2));
    if (openingKeys.has(key)) continue;
    const geo = buildWallSegmentMesh(wall, offsetX, offsetZ);
    if (geo) {
      const mesh = new THREE.Mesh(geo, WALL_MATERIAL);
      mesh.name = `Wall_${wallIndex++}`;
      group.add(mesh);
    }
  }

  const openingMesh = buildOpeningMeshesFromPlan(plan, offsetX, offsetZ);
  if (openingMesh) {
    openingMesh.name = 'Openings';
    group.add(openingMesh);
  }

  return { group };
}
