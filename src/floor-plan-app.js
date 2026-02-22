import { generateFloorPlan, DEFAULT_OPTIONS } from './floor-plan/floor-plan-engine.js';
import { createFloorPlanRenderer } from './floor-plan-renderer.js';
import * as previewCoordinator from './preview/coordinator.js';
import { wirePanZoom } from './shared/canvas-pan-zoom.js';
import { showGeneratorSpinner, hideGeneratorSpinner, runAfterSpinnerVisible } from './shared/loading-spinner.js';
import { showToast } from './shared/toast.js';

let floorPlanInited = false;

function readOptionsFromDOM() {
  const get = (id, def) => {
    const el = document.getElementById(id);
    if (!el) return def;
    const v = el.type === 'range' ? parseInt(el.value, 10) : parseInt(el.value, 10);
    return Number.isFinite(v) ? v : def;
  };
  return {
    width: get('floor-plan-param-width', DEFAULT_OPTIONS.width),
    height: get('floor-plan-param-height', DEFAULT_OPTIONS.height),
    hallwayCount: get('floor-plan-param-hallway-count', DEFAULT_OPTIONS.hallwayCount),
    doorCount: get('floor-plan-param-door-count', DEFAULT_OPTIONS.doorCount),
    minCorridorWidthCells: get('floor-plan-param-min-corridor', DEFAULT_OPTIONS.minCorridorWidthCells),
    maxCorridorWidthCells: get('floor-plan-param-max-corridor', DEFAULT_OPTIONS.maxCorridorWidthCells),
    maxLightCount: get('floor-plan-param-max-lights', DEFAULT_OPTIONS.maxLightCount),
    seed: get('floor-plan-param-seed', DEFAULT_OPTIONS.seed),
  };
}

function bindRangeReadouts() {
  const pairs = [
    ['floor-plan-param-width', 'floor-plan-val-width'],
    ['floor-plan-param-height', 'floor-plan-val-height'],
    ['floor-plan-param-hallway-count', 'floor-plan-val-hallway-count'],
    ['floor-plan-param-door-count', 'floor-plan-val-door-count'],
    ['floor-plan-param-min-corridor', 'floor-plan-val-min-corridor'],
    ['floor-plan-param-max-corridor', 'floor-plan-val-max-corridor'],
    ['floor-plan-param-max-lights', 'floor-plan-val-max-lights'],
  ];
  for (const [inputId, displayId] of pairs) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    if (input && display) {
      input.addEventListener('input', () => { display.textContent = input.value; });
    }
  }
}

function randomSeed() {
  const words = new Uint32Array(2);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(words);
  } else {
    words[0] = Math.floor(Math.random() * 0xffffffff);
    words[1] = Math.floor(Math.random() * 0xffffffff);
  }
  const mixed = (words[0] ^ words[1] ^ (Date.now() >>> 0)) >>> 0;
  return Math.max(1, Math.min(4294967295, mixed));
}

export function initFloorPlanApp() {
  if (floorPlanInited) return;
  floorPlanInited = true;

  const canvas = document.getElementById('floor-plan-canvas');
  const status = document.getElementById('floor-plan-status');
  const btnGenerate = document.getElementById('floor-plan-btn-generate');
  const btnPreview = document.getElementById('floor-plan-btn-preview');
  const btnExportGlb = document.getElementById('floor-plan-btn-export-glb');
  const paramsPanel = document.getElementById('floor-plan-params-panel');
  const paramsHeader = document.querySelector('#floor-plan-params-panel .panel-header');
  if (!canvas || !btnGenerate) return;

  const renderer = createFloorPlanRenderer(canvas);
  const camera = { panX: 0, panY: 0, zoom: 1 };
  let lastPlan = null;
  let generating = false;

  function draw() {
    renderer.render(lastPlan, camera);
  }

  function handleResize() {
    renderer.resize();
    draw();
  }

  bindRangeReadouts();

  btnGenerate.addEventListener('click', () => {
    if (generating) return;
    generating = true;
    btnGenerate.disabled = true;
    if (status) status.textContent = 'Generating…';
    showGeneratorSpinner();

    runAfterSpinnerVisible(() => {
      const seedInput = document.getElementById('floor-plan-param-seed');
      if (seedInput) seedInput.value = String(randomSeed());

      const options = readOptionsFromDOM();
      try {
        lastPlan = generateFloorPlan(options);
        if (status) status.textContent = 'Ready';
        if (btnPreview) btnPreview.disabled = false;
        if (btnExportGlb) btnExportGlb.disabled = false;
        draw();
      } catch (err) {
        const msg = 'Failed to generate a new floor plan, please adjust parameters and try again.';
        if (status) status.textContent = msg;
        showToast(msg);
        console.error('Floor plan generate failed:', err);
      } finally {
        generating = false;
        btnGenerate.disabled = false;
        hideGeneratorSpinner();
      }
    });
  });

  if (paramsHeader && paramsPanel) {
    paramsHeader.addEventListener('click', () => {
      paramsPanel.classList.toggle('collapsed');
      paramsHeader.setAttribute('aria-expanded', String(!paramsPanel.classList.contains('collapsed')));
    });
  }

  if (btnPreview) {
    btnPreview.addEventListener('click', () => {
      if (!lastPlan) return;
      previewCoordinator.openPreview({ type: 'floor-plan', plan: lastPlan }).catch((err) => {
        console.error('Floor plan preview failed to start:', err);
      });
    });
  }

  wirePanZoom(canvas, camera, draw);
  handleResize();
  window.addEventListener('resize', handleResize);
  requestAnimationFrame(() => {
    handleResize();
  });

  const options = readOptionsFromDOM();
  const doorCountsToTry = [options.doorCount, 3, 2, 1].filter(
    (c, i, arr) => arr.indexOf(c) === i && c >= 0
  );
  let initialError = null;
  let usedDoorCount = options.doorCount;
  for (const doorCount of doorCountsToTry) {
    try {
      lastPlan = generateFloorPlan({ ...options, doorCount });
      usedDoorCount = doorCount;
      if (status) status.textContent = 'Ready';
      if (btnPreview) btnPreview.disabled = false;
      if (btnExportGlb) btnExportGlb.disabled = false;
      draw();
      initialError = null;
      break;
    } catch (err) {
      initialError = err;
      if (status) status.textContent = 'Generating…';
    }
  }
  if (usedDoorCount !== options.doorCount) {
    const doorInput = document.getElementById('floor-plan-param-door-count');
    const doorDisplay = document.getElementById('floor-plan-val-door-count');
    if (doorInput) doorInput.value = String(usedDoorCount);
    if (doorDisplay) doorDisplay.textContent = String(usedDoorCount);
  }
  if (initialError) {
    const msg = 'Failed to generate a new floor plan, try adjusting parameters before trying again.';
    if (status) status.textContent = msg;
    showToast(msg);
    console.error('Floor plan initial generate failed:', initialError);
  }

  if (btnExportGlb) {
    btnExportGlb.addEventListener('click', async () => {
      if (!lastPlan) return;
      const btn = btnExportGlb;
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const { exportFloorPlanAsGLB } = await import('./export-glb.js');
        await exportFloorPlanAsGLB(lastPlan);
        if (status) status.textContent = 'Exported GLB';
        setTimeout(() => {
          if (status) status.textContent = 'Ready';
        }, 2000);
      } catch (err) {
        console.error('Floor plan export GLB failed:', err);
        if (status) status.textContent = 'Export failed';
      } finally {
        btn.disabled = false;
      }
    });
  }
}
