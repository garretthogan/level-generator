import { generateDungeon } from './bsp/generate.js';
import { DEFAULT_CONFIG } from './bsp/config.js';
import { createRenderer } from './renderer.js';
import * as previewCoordinator from './preview/coordinator.js';
import { DUNGEON_PARAM_SPEC, DUNGEON_SEED_INPUT_ID, buildParamsFromSpec, syncConfigFromDOM, bindParamInputs } from './shared/config-dom.js';
import { wirePanZoom } from './shared/canvas-pan-zoom.js';
import { showGeneratorSpinner, hideGeneratorSpinner, runAfterSpinnerVisible } from './shared/loading-spinner.js';

const State = Object.freeze({
  IDLE: 'idle',
  COMPLETE: 'complete',
});

export function initApp() {
  const canvas = document.getElementById('dungeon-canvas');
  const renderer = createRenderer(canvas);

  let state = State.IDLE;
  let steps = [];
  let stepIndex = -1;
  let config = { ...DEFAULT_CONFIG };

  const camera = { panX: 0, panY: 0, zoom: 1 };

  const ui = bindUI();
  syncConfigFromUI(ui);
  wireEvents(ui);
  wirePanZoom(canvas, camera, draw);
  handleResize();
  window.addEventListener('resize', handleResize);

  generateInstant();

  function advanceSeed() {
    config.seed = (config.seed + 1) | 0;
    ui.seedInput.value = config.seed;
  }

  function randomizeSeed() {
    config.seed = (Math.floor(Math.random() * 0x7fffffff) - 1) | 0;
    if (ui.seedInput) ui.seedInput.value = config.seed;
  }

  function generateInstant() {
    randomizeSeed();
    steps = generateDungeon(config);
    stepIndex = steps.length - 1;
    transition(State.COMPLETE);
  }

  function openPreview() {
    if (steps.length === 0) return;
    syncConfigFromUI(ui);
    previewCoordinator.openPreview({ type: 'dungeon', config, steps }).catch((err) => {
      console.error('Preview failed to start:', err);
    });
  }

  async function exportGlb() {
    if (steps.length === 0) return;
    syncConfigFromUI(ui);
    try {
      const { exportDungeonAsGLB } = await import('./export-glb.js');
      await exportDungeonAsGLB(config, steps);
      ui.status.textContent = 'Exported GLB';
      setTimeout(() => {
        if (state === State.COMPLETE) ui.status.textContent = 'Complete';
        else if (state === State.IDLE) ui.status.textContent = 'Ready';
        else ui.status.textContent = '';
      }, 2000);
    } catch (err) {
      console.error('Export GLB failed:', err);
      ui.status.textContent = 'Export failed';
    }
  }

  function transition(newState) {
    state = newState;
    draw();
    syncUI();
  }

  function draw() {
    renderer.render(steps, stepIndex, config.dungeonWidth, config.dungeonHeight, camera);
  }

  function handleResize() {
    renderer.resize();
    draw();
  }

  function syncUI() {
    const idle = state === State.IDLE;
    const complete = state === State.COMPLETE;

    ui.btnPreview.disabled = steps.length === 0;
    ui.btnExportGlb.disabled = steps.length === 0;
    updateStatusText(idle, complete);
  }

  function updateStatusText(idle, complete) {
    if (idle) {
      ui.status.textContent = 'Ready';
      return;
    }
    if (complete) {
      ui.status.textContent = `Complete \u2014 ${steps.length} steps`;
    }
  }

  function handleKeyDown(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    if (document.activeElement instanceof HTMLButtonElement) {
      document.activeElement.blur();
    }

    if (event.key === 'g') {
      generateInstant();
    }
  }

  function wireEvents(ui) {
    bindParamInputs(DUNGEON_PARAM_SPEC, ui.params, config);

    ui.seedInput.addEventListener('input', () => {
      config.seed = parseInt(ui.seedInput.value, 10) || 0;
    });

    ui.btnGenerate.addEventListener('click', () => {
      showGeneratorSpinner();
      runAfterSpinnerVisible(() => {
        try {
          generateInstant();
        } finally {
          hideGeneratorSpinner();
        }
      });
    });
    ui.btnPreview.addEventListener('click', openPreview);
    ui.btnExportGlb.addEventListener('click', exportGlb);
    const backBtn = document.getElementById('preview-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewCoordinator.closePreview();
      });
    }
    ui.controlsHeader.addEventListener('click', () => {
      if (new URLSearchParams(window.location.search).get('unreal-engine') === 'true') return;
      ui.controlsArea.classList.toggle('collapsed');
      const expanded = !ui.controlsArea.classList.contains('collapsed');
      ui.controlsHeader.setAttribute('aria-expanded', String(expanded));
    });

    document.querySelectorAll('.panel-header').forEach((header) => {
      header.addEventListener('click', () => {
        const panel = header.closest('.panel');
        panel.classList.toggle('collapsed');
        const expanded = !panel.classList.contains('collapsed');
        header.setAttribute('aria-expanded', String(expanded));
      });
    });

    document.addEventListener('keydown', handleKeyDown);

    window.addEventListener('gallery-load-dungeon', (e) => {
      const { config: cfg, steps: stps } = e.detail || {};
      if (!cfg || !stps?.length) return;
      Object.assign(config, cfg);
      steps.length = 0;
      steps.push(...stps);
      stepIndex = steps.length - 1;
      if (ui.seedInput) ui.seedInput.value = config.seed;
      transition(State.COMPLETE);
    });
  }

  function syncConfigFromUI(ui) {
    syncConfigFromDOM(DUNGEON_PARAM_SPEC, config, { seedInputId: DUNGEON_SEED_INPUT_ID });
  }
}

function bindUI() {
  const params = buildParamsFromSpec(DUNGEON_PARAM_SPEC);

  return {
    params,
    seedInput: document.getElementById(DUNGEON_SEED_INPUT_ID),
    status: document.getElementById('status'),
    btnGenerate: document.getElementById('btn-generate'),
    btnPreview: document.getElementById('btn-preview'),
    btnExportGlb: document.getElementById('btn-export-glb'),
    controlsArea: document.getElementById('controls-area'),
    controlsHeader: document.querySelector('.controls-area-header'),
  };
}
