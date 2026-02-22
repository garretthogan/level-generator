/**
 * Gallery view: generate up to 20 dungeons or arenas, show thumbnails, open 2D view on click.
 */

import { generateDungeonThumbnail } from './thumbnail.js';
import { generateArenaThumbnail } from './thumbnail.js';
import { DUNGEON_PARAM_SPEC, DUNGEON_SEED_INPUT_ID, ARENA_PARAM_SPEC, readConfigFromDOM } from '../shared/config-dom.js';
import { showGeneratorSpinner, hideGeneratorSpinner, runAfterSpinnerVisible } from '../shared/loading-spinner.js';

const MAX_ITEMS = 20;

let galleryInited = false;

function getDungeonConfigFromDOM() {
  return readConfigFromDOM(DUNGEON_PARAM_SPEC, { seedInputId: DUNGEON_SEED_INPUT_ID });
}

function getArenaOptionsFromDOM() {
  return readConfigFromDOM(ARENA_PARAM_SPEC);
}

function bindGalleryUI() {
  return {
    typeDungeon: document.getElementById('gallery-type-dungeon'),
    typeArena: document.getElementById('gallery-type-arena'),
    countInput: document.getElementById('gallery-count'),
    btnGenerate: document.getElementById('gallery-btn-generate'),
    status: document.getElementById('gallery-status'),
    grid: document.getElementById('gallery-grid'),
    backLink: document.getElementById('gallery-back-to-generator'),
  };
}

function syncGalleryGeneratorPanelVisibility() {
  const isDungeon = document.getElementById('gallery-type-dungeon')?.checked ?? true;
  const paramsPanel = document.getElementById('params-panel');
  const arenaParamsPanel = document.getElementById('arena-params-panel');
  if (paramsPanel) paramsPanel.classList.toggle('hidden', !isDungeon);
  if (arenaParamsPanel) arenaParamsPanel.classList.toggle('hidden', isDungeon);
}

function renderGrid(items, gridEl) {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  items.forEach((item, index) => {
    const label = item.type === 'dungeon' ? `Dungeon ${index + 1}` : `Arena ${index + 1}`;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card';
    card.setAttribute('aria-label', `Open 2D view: ${label}`);
    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.alt = label;
    img.width = 200;
    img.height = 150;
    const caption = document.createElement('span');
    caption.className = 'gallery-card-label';
    caption.textContent = label;
    card.appendChild(img);
    card.appendChild(caption);
    card.addEventListener('click', () => {
      const detail =
        item.type === 'dungeon'
          ? { type: 'dungeon', config: item.config, steps: item.steps }
          : { type: 'arena', arenaResult: item.arenaResult };
      window.dispatchEvent(new CustomEvent('gallery-open-2d', { detail }));
    });
    gridEl.appendChild(card);
  });
}

export function initGalleryApp() {
  if (galleryInited) return;
  galleryInited = true;

  const ui = bindGalleryUI();
  if (!ui.grid || !ui.btnGenerate) return;

  let items = [];

  function getGalleryType() {
    return ui.typeArena?.checked ? 'arena' : 'dungeon';
  }

  function getCount() {
    const n = parseInt(ui.countInput?.value, 10);
    return Math.min(MAX_ITEMS, Math.max(1, isNaN(n) ? 5 : n));
  }

  ui.btnGenerate.addEventListener('click', () => {
    const type = getGalleryType();
    const count = getCount();
    ui.btnGenerate.disabled = true;
    if (ui.status) ui.status.textContent = 'Generating…';
    showGeneratorSpinner();
    items = [];

    runAfterSpinnerVisible(async () => {
      try {
        const baseSeed = (Math.random() * 0xffffffff) | 0;
        for (let i = 0; i < count; i++) {
          try {
            if (type === 'dungeon') {
              const config = { ...getDungeonConfigFromDOM(), seed: (baseSeed + i) | 0 };
              items.push(generateDungeonThumbnail(config));
            } else {
              const options = getArenaOptionsFromDOM();
              items.push(generateArenaThumbnail(options));
            }
          } catch (err) {
            console.error('Gallery thumbnail failed:', err);
          }
          renderGrid(items, ui.grid);
        }
      } finally {
        hideGeneratorSpinner();
      }

      ui.btnGenerate.disabled = false;
      if (ui.status) ui.status.textContent = items.length ? `Ready (${items.length} items)` : 'Ready';
    });
  });

  ui.typeDungeon?.addEventListener('change', syncGalleryGeneratorPanelVisibility);
  ui.typeArena?.addEventListener('change', syncGalleryGeneratorPanelVisibility);
  syncGalleryGeneratorPanelVisibility();

  if (ui.backLink) {
    ui.backLink.addEventListener('click', () => {
      const event = new CustomEvent('gallery-back-to-generator');
      window.dispatchEvent(event);
    });
  }

  renderGrid(items, ui.grid);
}
