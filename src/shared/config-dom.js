/**
 * Single source of truth for reading generator config from the DOM and binding param inputs.
 * Used by dungeon app, arena app, and gallery so param ids and parsing live in one place.
 */

import { DEFAULT_CONFIG } from '../bsp/config.js';
import { DEFAULT_ARENA_OPTIONS } from '../arena/arena-config.js';

/**
 * @typedef {{ inputId: string, displayId: string | null, key: string, default: number, parse: 'int' | 'float', scale?: number, formatDisplay?: (v: number) => string }} ParamSpecEntry
 */

/** @type {ParamSpecEntry[]} */
export const DUNGEON_PARAM_SPEC = Object.freeze([
  { inputId: 'param-width', displayId: 'val-width', key: 'dungeonWidth', default: DEFAULT_CONFIG.dungeonWidth, parse: 'int' },
  { inputId: 'param-height', displayId: 'val-height', key: 'dungeonHeight', default: DEFAULT_CONFIG.dungeonHeight, parse: 'int' },
  { inputId: 'param-depth', displayId: 'val-depth', key: 'maxDepth', default: DEFAULT_CONFIG.maxDepth, parse: 'int' },
  { inputId: 'param-min-partition', displayId: 'val-min-partition', key: 'minPartitionSize', default: DEFAULT_CONFIG.minPartitionSize, parse: 'int' },
  { inputId: 'param-room-padding', displayId: 'val-room-padding', key: 'roomPadding', default: DEFAULT_CONFIG.roomPadding, parse: 'int' },
  { inputId: 'param-min-room', displayId: 'val-min-room', key: 'minRoomSize', default: DEFAULT_CONFIG.minRoomSize, parse: 'int' },
  { inputId: 'param-corridor', displayId: 'val-corridor', key: 'corridorWidth', default: DEFAULT_CONFIG.corridorWidth, parse: 'int' },
  { inputId: 'param-exit-width', displayId: 'val-exit-width', key: 'exitWidth', default: DEFAULT_CONFIG.exitWidth, parse: 'int' },
]);

/** Seed is read separately; its input id for dungeon. */
export const DUNGEON_SEED_INPUT_ID = 'param-seed';

/** @type {ParamSpecEntry[]} */
export const ARENA_PARAM_SPEC = Object.freeze([
  { inputId: 'arena-param-cols', displayId: 'arena-val-cols', key: 'cols', default: DEFAULT_ARENA_OPTIONS.cols, parse: 'int' },
  { inputId: 'arena-param-rows', displayId: 'arena-val-rows', key: 'rows', default: DEFAULT_ARENA_OPTIONS.rows, parse: 'int' },
  { inputId: 'arena-param-density', displayId: 'arena-val-density', key: 'density', default: DEFAULT_ARENA_OPTIONS.density, parse: 'int', scale: 0.01, formatDisplay: (v) => v.toFixed(2) },
  { inputId: 'arena-param-building-count', displayId: 'arena-val-building-count', key: 'buildingCount', default: DEFAULT_ARENA_OPTIONS.buildingCount, parse: 'int' },
  { inputId: 'arena-param-building-min', displayId: 'arena-val-building-min', key: 'buildingMinSize', default: DEFAULT_ARENA_OPTIONS.buildingMinSize, parse: 'int' },
  { inputId: 'arena-param-building-max', displayId: 'arena-val-building-max', key: 'buildingMaxSize', default: DEFAULT_ARENA_OPTIONS.buildingMaxSize, parse: 'int' },
  { inputId: 'arena-param-smoothing', displayId: 'arena-val-smoothing', key: 'smoothingPasses', default: DEFAULT_ARENA_OPTIONS.smoothingPasses, parse: 'int' },
  { inputId: 'arena-param-corridor-width', displayId: 'arena-val-corridor-width', key: 'corridorWidth', default: DEFAULT_ARENA_OPTIONS.corridorWidth, parse: 'int' },
  { inputId: 'arena-param-exit-width', displayId: 'arena-val-exit-width', key: 'exitWidth', default: DEFAULT_ARENA_OPTIONS.exitWidth, parse: 'int' },
  { inputId: 'arena-param-candidates', displayId: 'arena-val-candidates', key: 'candidates', default: DEFAULT_ARENA_OPTIONS.candidates, parse: 'int' },
]);

/**
 * Read one param from DOM.
 * @param {ParamSpecEntry} entry
 * @returns {number}
 */
function readParam(entry) {
  const el = document.getElementById(entry.inputId);
  let v = el ? (entry.parse === 'float' ? parseFloat(el.value, 10) : parseInt(el.value, 10)) : NaN;
  if (!Number.isFinite(v)) return entry.default;
  if (entry.scale != null) v *= entry.scale;
  return v;
}

/**
 * Build config object from DOM using the given spec.
 * @param {ParamSpecEntry[]} spec
 * @param {{ seedInputId?: string }} [extra] - If seedInputId is set, also read seed and set config.seed (for dungeon).
 * @returns {Record<string, number>}
 */
export function readConfigFromDOM(spec, extra = {}) {
  const result = {};
  for (const entry of spec) {
    result[entry.key] = readParam(entry);
  }
  if (extra.seedInputId) {
    const el = document.getElementById(extra.seedInputId);
    const seed = el ? parseInt(el.value, 10) : 0;
    result.seed = Number.isFinite(seed) ? seed : DEFAULT_CONFIG.seed;
  }
  return result;
}

/**
 * Sync an existing config object from DOM (mutates config).
 * @param {ParamSpecEntry[]} spec
 * @param {Record<string, number>} config
 * @param {{ seedInputId?: string }} [extra]
 */
export function syncConfigFromDOM(spec, config, extra = {}) {
  const read = readConfigFromDOM(spec, extra);
  for (const key of Object.keys(read)) {
    config[key] = read[key];
  }
}

/**
 * Build params object { [key]: { input, display } } for use with existing UI code.
 * @param {ParamSpecEntry[]} spec
 * @returns {Record<string, { input: HTMLInputElement | null, display: HTMLElement | null }>}
 */
export function buildParamsFromSpec(spec) {
  const params = {};
  for (const entry of spec) {
    params[entry.key] = {
      input: document.getElementById(entry.inputId),
      display: entry.displayId ? document.getElementById(entry.displayId) : null,
    };
  }
  return params;
}

/**
 * Bind input listeners so that when user changes a param, config is updated and display is updated.
 * @param {ParamSpecEntry[]} spec
 * @param {Record<string, { input: HTMLInputElement | null, display: HTMLElement | null }>} params - from buildParamsFromSpec
 * @param {Record<string, number>} config
 */
export function bindParamInputs(spec, params, config) {
  for (const entry of spec) {
    const { input, display } = params[entry.key] || {};
    if (!input) continue;
    const update = () => {
      const v = readParam(entry);
      config[entry.key] = v;
      if (display) display.textContent = entry.formatDisplay ? entry.formatDisplay(v) : String(entry.parse === 'int' ? Math.round(v) : v);
    };
    input.addEventListener('input', update);
    update();
  }
}
