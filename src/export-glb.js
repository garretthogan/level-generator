import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { generateDungeon } from './bsp/generate.js';
import { buildDungeonMeshesForExport } from './preview/dungeon-mesh.js';
import { buildArenaMeshesForExport } from './preview/arena-mesh.js';
import { buildFloorPlanMeshesForExport } from './preview/floor-plan-mesh.js';

/**
 * Set world-space UVs on a mesh so tiling textures work correctly in external editors.
 * @param {THREE.Mesh} mesh
 */
function setWorldSpaceUVs(mesh) {
  const geo = mesh.geometry;
  if (!geo?.attributes?.position) return;
  const pos = geo.attributes.position;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    uvs[i * 2] = pos.getX(i);
    uvs[i * 2 + 1] = pos.getZ(i);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (geo.attributes.uv2) geo.deleteAttribute('uv2');
}

/**
 * Builds a Three.js group with one mesh per floor tile and per wall segment
 * so each piece can be edited individually in another editor.
 */
function buildDungeonGroupForExport(steps, config) {
  const { group } = buildDungeonMeshesForExport(steps, config);
  const exportGroup = new THREE.Group();
  exportGroup.name = 'dungeon';
  for (const child of group.children) {
    if (!child.isMesh) continue;
    const clone = child.clone();
    clone.material = child.material.clone();
    clone.material.name = child.name.startsWith('Floor') ? 'Floor' : 'Wall';
    setWorldSpaceUVs(clone);
    exportGroup.add(clone);
  }
  return exportGroup;
}

/**
 * Builds a Three.js group with one mesh per floor tile and per wall segment
 * so each piece can be edited individually in another editor.
 */
function buildArenaGroupForExport(arenaResult) {
  const { group } = buildArenaMeshesForExport(arenaResult);
  const exportGroup = new THREE.Group();
  exportGroup.name = 'arena';
  for (const child of group.children) {
    if (!child.isMesh) continue;
    const clone = child.clone();
    clone.material = child.material.clone();
    clone.material.name = child.name.startsWith('Floor') ? 'Floor' : 'Wall';
    setWorldSpaceUVs(clone);
    exportGroup.add(clone);
  }
  return exportGroup;
}

function buildFloorPlanGroupForExport(plan) {
  const { group } = buildFloorPlanMeshesForExport(plan);
  const exportGroup = new THREE.Group();
  exportGroup.name = 'floor-plan';
  for (const child of group.children) {
    if (!child.isMesh) continue;
    const clone = child.clone();
    clone.material = child.material.clone();
    clone.material.name = child.name.startsWith('Floor') ? 'Floor' : 'Wall';
    setWorldSpaceUVs(clone);
    exportGroup.add(clone);
  }
  return exportGroup;
}

/**
 * Exports the current dungeon as a binary GLB file and triggers a download.
 * Each floor tile and each wall segment is a separate mesh (Floor_0_0, Floor_0_1, Wall_0, Wall_1, …)
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
 * Each floor tile and each wall segment is a separate mesh (Floor_0_0, Wall_0, …)
 * so you can select and edit individual pieces in Unreal, Blender, etc. Materials are named Floor / Wall.
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
