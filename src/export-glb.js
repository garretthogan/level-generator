import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { generateDungeon } from './bsp/generate.js';
import { buildDungeonMeshes } from './preview/dungeon-mesh.js';
import { buildArenaMeshes } from './preview/arena-mesh.js';

/**
 * Builds a Three.js group containing only the dungeon geometry (floors and walls)
 * for export. Lights are omitted so the GLB is portable across engines.
 */
function buildDungeonGroupForExport(steps, config) {
  const { group } = buildDungeonMeshes(steps, config);
  const exportGroup = new THREE.Group();
  exportGroup.name = 'dungeon';
  for (const child of group.children) {
    if (child.isMesh) exportGroup.add(child.clone());
  }
  return exportGroup;
}

/**
 * Builds a Three.js group containing only the arena geometry (floors and walls)
 * for export. Lights are omitted so the GLB is portable across engines.
 */
function buildArenaGroupForExport(arenaResult) {
  const { group } = buildArenaMeshes(arenaResult);
  const exportGroup = new THREE.Group();
  exportGroup.name = 'arena';
  for (const child of group.children) {
    if (child.isMesh) exportGroup.add(child.clone());
  }
  return exportGroup;
}

/**
 * Exports the current dungeon as a binary GLB file and triggers a download.
 * Uses the same generation as the 3D preview (buildDungeonMeshes).
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
 * Uses the same build as the 3D preview (buildArenaMeshes).
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
