import { generateDungeon, StepPhase } from './bsp/generate.js';
import { DEFAULT_CONFIG } from './bsp/config.js';
import { createRenderer } from './renderer.js';
import * as previewCoordinator from './preview/coordinator.js';
import { DUNGEON_PARAM_SPEC, DUNGEON_SEED_INPUT_ID, buildParamsFromSpec, syncConfigFromDOM, bindParamInputs } from './shared/config-dom.js';
import { wirePanZoom } from './shared/canvas-pan-zoom.js';
import { showGeneratorSpinner, hideGeneratorSpinner, runAfterSpinnerVisible } from './shared/loading-spinner.js';

const State = Object.freeze({
  IDLE: 'idle',
  STEPPING: 'stepping',
  PLAYING: 'playing',
  COMPLETE: 'complete',
});

const SPEED_MS = { 1: 500, 2: 200, 3: 80, 4: 20 };

const PHASE_LABELS = {
  [StepPhase.PARTITION]: 'Partitioning',
  [StepPhase.ROOMS]: 'Placing Rooms',
  [StepPhase.CORRIDORS]: 'Connecting',
};

export function initApp() {
  const canvas = document.getElementById('dungeon-canvas');
  const renderer = createRenderer(canvas);

  let state = State.IDLE;
  let steps = [];
  let stepIndex = -1;
  let playTimer = null;
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
    stopPlay();
    randomizeSeed();
    steps = generateDungeon(config);
    stepIndex = steps.length - 1;
    transition(State.COMPLETE);
  }

  function startDebug() {
    stopPlay();
    advanceSeed();
    steps = generateDungeon(config);
    stepIndex = 0;
    transition(State.STEPPING);
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

  function advanceStep() {
    if (stepIndex >= steps.length - 1) {
      stopPlay();
      transition(State.COMPLETE);
      return;
    }
    stepIndex++;
    draw();
    syncUI();
    if (stepIndex >= steps.length - 1) {
      stopPlay();
      transition(State.COMPLETE);
    }
  }

  function startPlay() {
    transition(State.PLAYING);
    restartPlayTimer();
  }

  function pausePlay() {
    stopPlay();
    transition(State.STEPPING);
  }

  function restartPlayTimer() {
    stopPlay();
    const speed = SPEED_MS[parseInt(ui.speedInput.value, 10)] || 200;
    playTimer = setInterval(advanceStep, speed);
  }

  function stopPlay() {
    if (playTimer !== null) {
      clearInterval(playTimer);
      playTimer = null;
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
    const stepping = state === State.STEPPING;
    const playing = state === State.PLAYING;
    const complete = state === State.COMPLETE;
    const debugging = stepping || playing;

    if (ui.debugPanel) {
      ui.debugPanel.classList.toggle('collapsed', !debugging);
      const debugExpanded = debugging;
      const debugHeader = ui.debugPanel.querySelector('.panel-header');
      if (debugHeader) debugHeader.setAttribute('aria-expanded', String(debugExpanded));
    }
    ui.btnStep.disabled = !stepping || stepIndex >= steps.length - 1;
    ui.btnPlay.classList.toggle('hidden', playing);
    ui.btnPause.classList.toggle('hidden', !playing);
    ui.btnPlay.disabled = !stepping;
    ui.btnPreview.disabled = steps.length === 0;
    ui.btnExportGlb.disabled = steps.length === 0;

    toggleParamInputs(debugging);

    updateStatusText(idle, complete);
    updateStepInfoText();
  }

  function toggleParamInputs(disabled) {
    for (const { input } of Object.values(ui.params)) {
      input.disabled = disabled;
    }
    ui.seedInput.disabled = disabled;
  }

  function updateStatusText(idle, complete) {
    if (idle) {
      ui.status.textContent = 'Ready';
      return;
    }
    if (complete) {
      ui.status.textContent = `Complete \u2014 ${steps.length} steps`;
      return;
    }
    if (stepIndex >= 0 && stepIndex < steps.length) {
      const phase = PHASE_LABELS[steps[stepIndex].phase] || '';
      ui.status.textContent = `${phase} \u2014 Step ${stepIndex + 1} / ${steps.length}`;
    }
  }

  function updateStepInfoText() {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      ui.stepInfo.textContent = `Step ${stepIndex + 1} / ${steps.length} \u2014 ${steps[stepIndex].label}`;
    } else {
      ui.stepInfo.textContent = '';
    }
  }

  function handleKeyDown(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    if (document.activeElement instanceof HTMLButtonElement) {
      document.activeElement.blur();
    }

    switch (event.key) {
      case ' ':
        event.preventDefault();
        if (state === State.STEPPING) advanceStep();
        else if (state === State.PLAYING) pausePlay();
        else startDebug();
        break;
      case 'g':
        generateInstant();
        break;
      case 'p':
        if (state === State.STEPPING) startPlay();
        else if (state === State.PLAYING) pausePlay();
        break;
    }
  }

  function wireEvents(ui) {
    bindParamInputs(DUNGEON_PARAM_SPEC, ui.params, config);

    ui.seedInput.addEventListener('input', () => {
      config.seed = parseInt(ui.seedInput.value, 10) || 0;
    });

    ui.speedInput.addEventListener('input', () => {
      ui.speedDisplay.textContent = `${ui.speedInput.value}x`;
      if (state === State.PLAYING) restartPlayTimer();
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
    ui.btnDebug.addEventListener('click', startDebug);
    ui.btnPreview.addEventListener('click', openPreview);
    ui.btnExportGlb.addEventListener('click', exportGlb);
    const backBtn = document.getElementById('preview-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewCoordinator.closePreview();
      });
    }
    ui.btnStep.addEventListener('click', advanceStep);
    ui.btnPlay.addEventListener('click', startPlay);
    ui.btnPause.addEventListener('click', pausePlay);

    ui.controlsHeader.addEventListener('click', () => {
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
    speedInput: document.getElementById('param-speed'),
    speedDisplay: document.getElementById('val-speed'),
    status: document.getElementById('status'),
    stepInfo: document.getElementById('step-info'),
    debugControls: document.getElementById('debug-controls'),
    debugPanel: document.getElementById('debug-panel'),
    btnGenerate: document.getElementById('btn-generate'),
    btnDebug: document.getElementById('btn-debug'),
    btnPreview: document.getElementById('btn-preview'),
    btnExportGlb: document.getElementById('btn-export-glb'),
    btnStep: document.getElementById('btn-step'),
    btnPlay: document.getElementById('btn-play'),
    btnPause: document.getElementById('btn-pause'),
    controlsArea: document.getElementById('controls-area'),
    controlsHeader: document.querySelector('.controls-area-header'),
  };
}
