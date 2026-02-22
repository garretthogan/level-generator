import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { generateDungeon } from './bsp/generate.js';
import { buildDungeonMeshes } from './preview/dungeon-mesh.js';
import { buildArenaMeshes } from './preview/arena-mesh.js';

/**
 * Clean geometry for export: weld duplicate vertices (fixes z-fighting and shading in
 * Unreal/other engines) and set world-space UVs so tiling textures work correctly.
 * @param {THREE.Mesh} mesh
 */
function prepareMeshForExport(mesh) {
  const geo = mesh.geometry;
  if (!geo?.attributes?.position) return;
  const cleaned = mergeVertices(geo, 1e-6);
  if (cleaned !== geo) {
    geo.dispose();
    mesh.geometry = cleaned;
  }
  const pos = mesh.geometry.attributes.position;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uvs[i * 2] = x;
    uvs[i * 2 + 1] = z;
  }
  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (mesh.geometry.attributes.uv2) mesh.geometry.deleteAttribute('uv2');
}

/**
 * Builds a Three.js group containing only the dungeon geometry (floors and walls)
 * for export. Geometry is cleaned (merged vertices, world-space UVs) for Unreal/other engines.
 */
function buildDungeonGroupForExport(steps, config) {
  const { group } = buildDungeonMeshes(steps, config);
  const exportGroup = new THREE.Group();
  exportGroup.name = 'dungeon';
  let idx = 0;
  for (const child of group.children) {
    if (!child.isMesh) continue;
    const clone = child.clone();
    clone.material = child.material.clone();
    clone.material.name = idx === 0 ? 'Floor' : 'Wall';
    clone.name = idx === 0 ? 'Floor' : 'Walls';
    prepareMeshForExport(clone);
    exportGroup.add(clone);
    idx++;
  }
  return exportGroup;
}

/**
 * Builds a Three.js group containing only the arena geometry (floors and walls)
 * for export. Geometry is cleaned (merged vertices, world-space UVs) for Unreal/other engines.
 */
function buildArenaGroupForExport(arenaResult) {
  const { group } = buildArenaMeshes(arenaResult);
  const exportGroup = new THREE.Group();
  exportGroup.name = 'arena';
  let idx = 0;
  for (const child of group.children) {
    if (!child.isMesh) continue;
    const clone = child.clone();
    clone.material = child.material.clone();
    clone.material.name = idx === 0 ? 'Floor' : 'Wall';
    clone.name = idx === 0 ? 'Floor' : 'Walls';
    prepareMeshForExport(clone);
    exportGroup.add(clone);
    idx++;
  }
  return exportGroup;
}

/**
 * Exports the current dungeon as a binary GLB file and triggers a download.
 * Uses the same generation as the 3D preview (buildDungeonMeshes).
 * Export is prepared for Unreal: merged vertices (no z-fighting), world-space UVs (tiling textures),
 * and named materials (Floor, Wall). In Unreal: 1 unit = 1 meter; use Import scale 100 if your project uses cm.
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
 * Uses the same build as the 3D preview (buildArenaMeshes). Export is prepared for Unreal
 * (merged vertices, world-space UVs, named materials). In Unreal: 1 unit = 1 meter; use scale 100 if using cm.
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
