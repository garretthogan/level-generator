/**
 * Generates thumbnail images for gallery by rendering to an offscreen canvas.
 * Uses existing 2D renderers; canvas must be in a sized wrapper so getBoundingClientRect() works.
 */

import { generateDungeon } from '../bsp/generate.js';
import { generateArena } from '../arena/arena-generator.js';
import { createRenderer } from '../renderer.js';
import { createArenaRenderer } from '../arena-renderer.js';

const THUMB_WIDTH = 200;
const THUMB_HEIGHT = 150;

function createOffscreenCanvas(width, height) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:absolute;left:-9999px;width:${width}px;height:${height}px;overflow:hidden;`;
  document.body.appendChild(wrap);
  const canvas = document.createElement('canvas');
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  wrap.appendChild(canvas);
  const cleanup = () => wrap.remove();
  return { canvas, wrap, cleanup };
}

/**
 * @param {Object} config - Dungeon config (dungeonWidth, dungeonHeight, seed, etc.)
 * @returns {{ type: 'dungeon', config: Object, steps: Array, thumbnail: string }}
 */
export function generateDungeonThumbnail(config) {
  const steps = generateDungeon(config);
  const { canvas, cleanup } = createOffscreenCanvas(THUMB_WIDTH, THUMB_HEIGHT);
  const renderer = createRenderer(canvas);
  renderer.resize();
  renderer.render(
    steps,
    steps.length - 1,
    config.dungeonWidth,
    config.dungeonHeight,
    { panX: 0, panY: 0, zoom: 1 }
  );
  const thumbnail = canvas.toDataURL('image/png');
  cleanup();
  return { type: 'dungeon', config, steps, thumbnail };
}

/**
 * @param {Object} options - Arena options (cols, rows, density, etc.)
 * @returns {{ type: 'arena', arenaResult: Object, thumbnail: string }}
 */
export function generateArenaThumbnail(options) {
  const arenaResult = generateArena(options);
  const { canvas, cleanup } = createOffscreenCanvas(THUMB_WIDTH, THUMB_HEIGHT);
  const renderer = createArenaRenderer(canvas);
  renderer.resize();
  renderer.render(arenaResult, { panX: 0, panY: 0, zoom: 1 });
  const thumbnail = canvas.toDataURL('image/png');
  cleanup();
  return { type: 'arena', arenaResult, thumbnail };
}
