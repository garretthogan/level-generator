import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { generateDungeon } from './bsp/generate.js';
import { buildDungeonMeshesForExport } from './preview/dungeon-mesh.js';
import { buildArenaMeshesForExport } from './preview/arena-mesh.js';
import { buildFloorPlanMeshesForExport } from './preview/floor-plan-mesh.js';

/**
 * Choose two world axes for UV from face normal (the two axes spanning the face).
 * Returns [uAxis, vAxis] where each is 'x'|'y'|'z'.
 */
function uvAxesFromNormal(nx, ny, nz) {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (ax >= ay && ax >= az) return ['y', 'z']; // face in YZ
  if (ay >= az) return ['x', 'z']; // face in XZ
  return ['x', 'y']; // face in XY
}

/**
 * Set world-space UVs per face so tiling textures work correctly on both floors and walls.
 * Floors get U=X, V=Z; walls get U and V from the two axes spanning the face (e.g. X and Y).
 * Vertices are duplicated so each face gets correct UVs (required for boxes).
 * @param {THREE.Mesh} mesh
 */
function setWorldSpaceUVs(mesh) {
  const geo = mesh.geometry;
  if (!geo?.attributes?.position) return;
  const pos = geo.attributes.position;
  const index = geo.index;
  const scale = 1;

  const positions = [];
  const uvs = [];
  const getPos = (i) => ({
    x: pos.getX(i),
    y: pos.getY(i),
    z: pos.getZ(i),
  });

  function addTriangle(i0, i1, i2) {
    const p0 = getPos(i0);
    const p1 = getPos(i1);
    const p2 = getPos(i2);
    const nx = (p1.y - p0.y) * (p2.z - p0.z) - (p1.z - p0.z) * (p2.y - p0.y);
    const ny = (p1.z - p0.z) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.z - p0.z);
    const nz = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const [uAxis, vAxis] = uvAxesFromNormal(nx / len, ny / len, nz / len);
    const getU = (p) => (uAxis === 'x' ? p.x : uAxis === 'y' ? p.y : p.z) * scale;
    const getV = (p) => (vAxis === 'x' ? p.x : vAxis === 'y' ? p.y : p.z) * scale;
    for (const p of [p0, p1, p2]) {
      positions.push(p.x, p.y, p.z);
      uvs.push(getU(p), getV(p));
    }
  }

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      addTriangle(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      addTriangle(i, i + 1, i + 2);
    }
  }

  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  newGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  newGeo.computeVertexNormals();
  if (geo.attributes.uv2) newGeo.deleteAttribute('uv2');
  mesh.geometry.dispose();
  mesh.geometry = newGeo;
}

/**
 * Builds an export group with floor and wall sibling groups; each mesh is
 * cloned, given world-space UVs, and placed under the appropriate child group.
 * @param {THREE.Group} group - Source group with mesh children named Floor_* / Wall_*
 * @param {string} rootName - Name for the root export group (e.g. 'dungeon', 'arena')
 * @returns {THREE.Group}
 */
function buildExportGroupWithFloorAndWallGroups(group, rootName) {
  const exportGroup = new THREE.Group();
  exportGroup.name = rootName;
  const floorGroup = new THREE.Group();
  floorGroup.name = 'floor';
  const wallGroup = new THREE.Group();
  wallGroup.name = 'wall';

  for (const child of group.children) {
    if (!child.isMesh) continue;
    const clone = child.clone();
    clone.material = child.material.clone();
    const isFloor = child.name.startsWith('Floor');
    clone.material.name = isFloor ? 'Floor' : 'Wall';
    setWorldSpaceUVs(clone);
    if (isFloor) floorGroup.add(clone);
    else wallGroup.add(clone);
  }

  exportGroup.add(floorGroup);
  exportGroup.add(wallGroup);
  return exportGroup;
}

/**
 * Builds a Three.js group with one mesh per floor tile and per wall segment
 * so each piece can be edited individually in another editor.
 * Structure: dungeon → floor (meshes), wall (meshes).
 */
function buildDungeonGroupForExport(steps, config) {
  const { group } = buildDungeonMeshesForExport(steps, config);
  return buildExportGroupWithFloorAndWallGroups(group, 'dungeon');
}

/**
 * Builds a Three.js group with one mesh per floor tile and per wall segment
 * so each piece can be edited individually in another editor.
 * Structure: arena → floor (meshes), wall (meshes).
 */
function buildArenaGroupForExport(arenaResult) {
  const { group } = buildArenaMeshesForExport(arenaResult);
  return buildExportGroupWithFloorAndWallGroups(group, 'arena');
}

/**
 * Builds a Three.js group for floor plan export.
 * Structure: floor-plan → floor (meshes), wall (meshes).
 */
function buildFloorPlanGroupForExport(plan) {
  const { group } = buildFloorPlanMeshesForExport(plan);
  return buildExportGroupWithFloorAndWallGroups(group, 'floor-plan');
}

/**
 * Exports the current dungeon as a binary GLB file and triggers a download.
 * Structure: dungeon → floor (floor meshes), wall (wall meshes). Each tile/segment is a separate mesh
 * so you can select and edit individual pieces in Unreal, Blender, etc. Materials are named Floor / Wall.
 *
 * @param {Object} config - Dungeon config (dungeonWidth, seed, etc.)
 * @param {Array} steps - Generated steps from generateDungeon(config); if omitted, generates from config
 */
export async function exportDungeonAsGLB(config, steps = null) {
  const dungeonSteps = steps !== null && steps.length > 0 ? steps : generateDungeon(config);
  const group = buildDungeonGroupForExport(dungeonSteps, config);

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(group, { binary: true });

  const blob = new Blob([result], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dungeon-${config.seed ?? 'export'}.glb`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports the current arena as a binary GLB file and triggers a download.
 * Structure: arena → floor (floor meshes), wall (wall meshes). Materials are named Floor / Wall.
 *
 * @param {Object} arenaResult - Result from generateArena(options) (grids, spawns, flags, etc.)
 */
export async function exportArenaAsGLB(arenaResult) {
  const group = buildArenaGroupForExport(arenaResult);

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(group, { binary: true });

  const blob = new Blob([result], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arena-export.glb`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports the current floor plan as a binary GLB file and triggers a download.
 *
 * @param {Object} plan - Floor plan from generateFloorPlan()
 */
export async function exportFloorPlanAsGLB(plan) {
  const group = buildFloorPlanGroupForExport(plan);

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(group, { binary: true });

  const blob = new Blob([result], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `floor-plan-${plan.meta?.seed ?? 'export'}.glb`;
  a.click();
  URL.revokeObjectURL(url);
}
