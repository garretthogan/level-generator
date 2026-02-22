import { generateArena } from './arena/arena-generator.js';
import { DEFAULT_ARENA_OPTIONS } from './arena/arena-config.js';
import { createArenaRenderer } from './arena-renderer.js';
import * as previewCoordinator from './preview/coordinator.js';
import { ARENA_PARAM_SPEC, buildParamsFromSpec, syncConfigFromDOM, bindParamInputs } from './shared/config-dom.js';
import { wirePanZoom } from './shared/canvas-pan-zoom.js';
import { showGeneratorSpinner, hideGeneratorSpinner, runAfterSpinnerVisible } from './shared/loading-spinner.js';

let arenaInited = false;

function bindArenaUI() {
  const params = buildParamsFromSpec(ARENA_PARAM_SPEC);
  return {
    canvas: document.getElementById('arena-canvas'),
    status: document.getElementById('arena-status'),
    btnGenerate: document.getElementById('arena-btn-generate'),
    btnPreview: document.getElementById('arena-btn-preview'),
    btnExportGlb: document.getElementById('arena-btn-export-glb'),
    paramsPanel: document.getElementById('arena-params-panel'),
    paramsHeader: document.querySelector('#arena-params-panel .panel-header'),
    params,
  };
}

export function initArenaApp() {
  if (arenaInited) return;
  arenaInited = true;

  const ui = bindArenaUI();
  if (!ui.canvas || !ui.btnGenerate) return;

  const renderer = createArenaRenderer(ui.canvas);
  const camera = { panX: 0, panY: 0, zoom: 1 };
  const options = { ...DEFAULT_ARENA_OPTIONS };
  let lastResult = null;
  let generating = false;

  function draw() {
    renderer.render(lastResult, camera);
  }

  function handleResize() {
    renderer.resize();
    draw();
  }

  syncConfigFromDOM(ARENA_PARAM_SPEC, options);
  bindParamInputs(ARENA_PARAM_SPEC, ui.params, options);

  ui.btnGenerate.addEventListener('click', () => {
    if (generating) return;
    generating = true;
    ui.btnGenerate.disabled = true;
    if (ui.status) ui.status.textContent = 'Generating…';
    showGeneratorSpinner();

    runAfterSpinnerVisible(() => {
      syncConfigFromDOM(ARENA_PARAM_SPEC, options);
      try {
        lastResult = generateArena(options);
        if (ui.status) ui.status.textContent = 'Ready';
        if (ui.btnPreview) ui.btnPreview.disabled = false;
        if (ui.btnExportGlb) ui.btnExportGlb.disabled = false;
        draw();
      } catch (err) {
        if (ui.status) ui.status.textContent = 'Generation failed';
        console.error('Arena generate failed:', err);
      } finally {
        generating = false;
        ui.btnGenerate.disabled = false;
        hideGeneratorSpinner();
      }
    });
  });

  if (ui.paramsHeader && ui.paramsPanel) {
    ui.paramsHeader.addEventListener('click', () => {
      ui.paramsPanel.classList.toggle('collapsed');
      ui.paramsHeader.setAttribute('aria-expanded', String(!ui.paramsPanel.classList.contains('collapsed')));
    });
  }

  if (ui.btnPreview) {
    ui.btnPreview.addEventListener('click', () => {
      if (!lastResult) return;
      previewCoordinator.openPreview({ type: 'arena', arenaResult: lastResult }).catch((err) => {
        console.error('Arena preview failed to start:', err);
      });
    });
  }

  wirePanZoom(ui.canvas, camera, draw);
  handleResize();
  window.addEventListener('resize', handleResize);

  syncConfigFromDOM(ARENA_PARAM_SPEC, options);
  try {
    lastResult = generateArena(options);
    if (ui.status) ui.status.textContent = 'Ready';
    if (ui.btnPreview) ui.btnPreview.disabled = false;
    if (ui.btnExportGlb) ui.btnExportGlb.disabled = false;
    draw();
  } catch (err) {
    if (ui.status) ui.status.textContent = 'Generation failed';
    console.error('Arena initial generate failed:', err);
  }

  if (ui.btnExportGlb) {
    ui.btnExportGlb.addEventListener('click', async () => {
      if (!lastResult) return;
      const btn = ui.btnExportGlb;
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const { exportArenaAsGLB } = await import('./export-glb.js');
        await exportArenaAsGLB(lastResult);
        if (ui.status) ui.status.textContent = 'Exported GLB';
        setTimeout(() => {
          if (ui.status) ui.status.textContent = 'Ready';
        }, 2000);
      } catch (err) {
        console.error('Arena export GLB failed:', err);
        if (ui.status) ui.status.textContent = 'Export failed';
      } finally {
        btn.disabled = false;
      }
    });
  }

  window.addEventListener('gallery-load-arena', (e) => {
    const { arenaResult: result } = e.detail || {};
    if (!result) return;
    lastResult = result;
    if (ui.btnPreview) ui.btnPreview.disabled = false;
    if (ui.btnExportGlb) ui.btnExportGlb.disabled = false;
    if (ui.status) ui.status.textContent = 'Ready';
    draw();
  });
}
