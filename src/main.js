import './design-system.css';
import './style.css';
import { initApp } from './app.js';
import { initArenaApp } from './arena-app.js';
import { initFloorPlanApp } from './floor-plan-app.js';
import { initGalleryApp } from './gallery/gallery-app.js';
import { showGeneratorSpinner, hideGeneratorSpinner, runAfterSpinnerVisible } from './shared/loading-spinner.js';

initApp();

const viewport = document.getElementById('viewport');
const viewGallery = document.getElementById('view-gallery');
const dungeonViewport = document.getElementById('dungeon-viewport');
const arenaViewport = document.getElementById('arena-viewport');
const floorPlanViewport = document.getElementById('floor-plan-viewport');
const tabDungeon = document.getElementById('tab-dungeon');
const tabArena = document.getElementById('tab-arena');
const tabFloorPlan = document.getElementById('tab-floor-plan');
const tabGallery = document.getElementById('tab-gallery');
const tabpanelDungeon = document.getElementById('tabpanel-dungeon');
const tabpanelArena = document.getElementById('tabpanel-arena');
const tabpanelFloorPlan = document.getElementById('tabpanel-floor-plan');
const tabpanelGallery = document.getElementById('tabpanel-gallery');
const statusDungeon = document.getElementById('status');
const statusArena = document.getElementById('arena-status');
const statusFloorPlan = document.getElementById('floor-plan-status');
const actionsDungeon = document.querySelector('.dungeon-actions');
const actionsArena = document.querySelector('.arena-actions');
const actionsFloorPlan = document.querySelector('.floor-plan-actions');
const actionsGallery = document.querySelector('.gallery-actions');
const dungeonParamsContainer = document.querySelector('#tabpanel-dungeon .controls-panels');
const arenaParamsContainer = document.getElementById('tabpanel-arena');
const galleryParamsContainer = document.getElementById('gallery-generator-params');
const paramsPanel = document.getElementById('params-panel');
const arenaParamsPanel = document.getElementById('arena-params-panel');

function moveGeneratorPanelsToGallery() {
  if (!galleryParamsContainer || !paramsPanel || !arenaParamsPanel) return;
  const isDungeon = document.getElementById('gallery-type-dungeon')?.checked ?? true;
  galleryParamsContainer.appendChild(paramsPanel);
  galleryParamsContainer.appendChild(arenaParamsPanel);
  paramsPanel.classList.toggle('hidden', !isDungeon);
  arenaParamsPanel.classList.toggle('hidden', isDungeon);
}

function moveGeneratorPanelsBack() {
  if (dungeonParamsContainer && paramsPanel) {
    dungeonParamsContainer.appendChild(paramsPanel);
    paramsPanel.classList.remove('hidden');
  }
  if (arenaParamsContainer && arenaParamsPanel) {
    arenaParamsContainer.appendChild(arenaParamsPanel);
    arenaParamsPanel.classList.remove('hidden');
  }
}

function setGeneratorTab(tab) {
  const isDungeon = tab === 'dungeon';
  const isArena = tab === 'arena';
  const isFloorPlan = tab === 'floor-plan';
  viewport?.classList.remove('hidden');
  viewGallery?.classList.add('hidden');
  viewGallery?.setAttribute('aria-hidden', 'true');
  moveGeneratorPanelsBack();
  dungeonViewport?.classList.toggle('hidden', !isDungeon);
  arenaViewport?.classList.toggle('hidden', !isArena);
  floorPlanViewport?.classList.toggle('hidden', !isFloorPlan);
  tabDungeon?.setAttribute('aria-selected', String(isDungeon));
  tabArena?.setAttribute('aria-selected', String(isArena));
  tabFloorPlan?.setAttribute('aria-selected', String(isFloorPlan));
  tabGallery?.setAttribute('aria-selected', 'false');
  tabpanelDungeon?.classList.toggle('hidden', !isDungeon);
  tabpanelDungeon?.setAttribute('aria-hidden', String(!isDungeon));
  tabpanelArena?.classList.toggle('hidden', !isArena);
  tabpanelArena?.setAttribute('aria-hidden', String(isArena));
  tabpanelFloorPlan?.classList.toggle('hidden', !isFloorPlan);
  tabpanelFloorPlan?.setAttribute('aria-hidden', String(!isFloorPlan));
  tabpanelGallery?.classList.add('hidden');
  tabpanelGallery?.setAttribute('aria-hidden', 'true');
  statusDungeon?.classList.toggle('hidden', !isDungeon);
  statusArena?.classList.toggle('hidden', !isArena);
  statusFloorPlan?.classList.toggle('hidden', !isFloorPlan);
  actionsDungeon?.classList.toggle('hidden', !isDungeon);
  actionsArena?.classList.toggle('hidden', !isArena);
  actionsFloorPlan?.classList.toggle('hidden', !isFloorPlan);
  actionsGallery?.classList.add('hidden');
  if (isArena) initArenaApp();
  if (isFloorPlan) {
    showGeneratorSpinner();
    runAfterSpinnerVisible(() => {
      initFloorPlanApp();
      hideGeneratorSpinner();
      document.getElementById('floor-plan-btn-generate')?.focus();
    });
  } else if (isDungeon) {
    document.getElementById('btn-generate')?.focus();
  } else if (isArena) {
    document.getElementById('arena-btn-generate')?.focus();
  }
}

function showGalleryView() {
  viewport?.classList.add('hidden');
  viewGallery?.classList.remove('hidden');
  viewGallery?.setAttribute('aria-hidden', 'false');
  tabDungeon?.setAttribute('aria-selected', 'false');
  tabArena?.setAttribute('aria-selected', 'false');
  tabFloorPlan?.setAttribute('aria-selected', 'false');
  tabGallery?.setAttribute('aria-selected', 'true');
  tabpanelDungeon?.classList.add('hidden');
  tabpanelDungeon?.setAttribute('aria-hidden', 'true');
  tabpanelArena?.classList.add('hidden');
  tabpanelArena?.setAttribute('aria-hidden', 'true');
  tabpanelFloorPlan?.classList.add('hidden');
  tabpanelFloorPlan?.setAttribute('aria-hidden', 'true');
  tabpanelGallery?.classList.remove('hidden');
  tabpanelGallery?.setAttribute('aria-hidden', 'false');
  statusDungeon?.classList.add('hidden');
  statusArena?.classList.add('hidden');
  statusFloorPlan?.classList.add('hidden');
  actionsDungeon?.classList.add('hidden');
  actionsArena?.classList.add('hidden');
  actionsFloorPlan?.classList.add('hidden');
  actionsGallery?.classList.remove('hidden');
  initArenaApp();
  moveGeneratorPanelsToGallery();
  initGalleryApp();
  document.getElementById('gallery-btn-generate')?.focus();
}

export { setGeneratorTab, showGalleryView };

tabDungeon?.addEventListener('click', () => setGeneratorTab('dungeon'));
tabArena?.addEventListener('click', () => setGeneratorTab('arena'));
tabFloorPlan?.addEventListener('click', () => setGeneratorTab('floor-plan'));
tabGallery?.addEventListener('click', showGalleryView);

window.addEventListener('gallery-back-to-generator', () => setGeneratorTab('dungeon'));

window.addEventListener('gallery-open-2d', (e) => {
  const d = e.detail || {};
  const type = d.type === 'arena' ? 'arena' : 'dungeon';
  setGeneratorTab(type);
  requestAnimationFrame(() => {
    if (type === 'dungeon') {
      window.dispatchEvent(new CustomEvent('gallery-load-dungeon', { detail: { config: d.config, steps: d.steps } }));
    } else {
      window.dispatchEvent(new CustomEvent('gallery-load-arena', { detail: { arenaResult: d.arenaResult } }));
    }
  });
});
