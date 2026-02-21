/**
 * Single entry point for opening and closing the 3D preview (dungeon or arena).
 * Ensures back button returns to the correct view and focus.
 */

let previewDestroy = null;
let returnTo = 'dungeon';

export async function openPreview(payload, returnToOverride) {
  const container = document.getElementById('preview-canvas-container');
  const overlay = document.getElementById('preview-overlay');
  const viewPreview = document.getElementById('view-preview');
  const viewGenerator = document.getElementById('view-generator');

  if (!container) return;

  if (payload.type === 'dungeon') {
    returnTo = returnToOverride ?? 'dungeon';
    const { runPreviewScene } = await import('./run-preview.js');
    const { config, steps } = payload;
    previewDestroy = runPreviewScene(container, overlay, config, steps).destroy;
  } else if (payload.type === 'arena') {
    returnTo = returnToOverride ?? 'arena';
    const { runArenaPreviewScene } = await import('./run-arena-preview.js');
    previewDestroy = runArenaPreviewScene(container, overlay, payload.arenaResult).destroy;
  } else {
    return;
  }

  viewPreview?.classList.remove('hidden');
  viewPreview?.setAttribute('aria-hidden', 'false');
  viewGenerator?.classList.add('hidden');
  viewGenerator?.setAttribute('aria-hidden', 'true');

  const backBtn = document.getElementById('preview-back-btn');
  if (backBtn) backBtn.focus();
}

export function closePreview() {
  document.exitPointerLock();
  if (previewDestroy) {
    previewDestroy();
    previewDestroy = null;
  }

  const viewPreview = document.getElementById('view-preview');
  const viewGenerator = document.getElementById('view-generator');

  viewPreview?.classList.add('hidden');
  viewPreview?.setAttribute('aria-hidden', 'true');
  viewGenerator?.classList.remove('hidden');
  viewGenerator?.setAttribute('aria-hidden', 'false');

  import('../main.js').then(({ setGeneratorTab, showGalleryView }) => {
    if (returnTo === 'gallery') {
      showGalleryView();
      document.getElementById('gallery-btn-generate')?.focus();
    } else {
      setGeneratorTab(returnTo);
      if (returnTo === 'arena') document.getElementById('arena-btn-preview')?.focus();
      else document.getElementById('btn-preview')?.focus();
    }
  });
}
