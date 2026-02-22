/**
 * Shared loading spinner over the generator area.
 * Ensures the spinner is visible for at least MIN_DISPLAY_MS so quick generations still show feedback.
 * Hides the canvas/content until the spinner is hidden so the UI feels responsive.
 */

const OVERLAY_ID = 'generator-loading-overlay';
const APP_ID = 'app';
const LOADING_CLASS = 'generator-loading';
const MIN_DISPLAY_MS = 250;

let overlayEl = null;
let minDisplayUntil = 0;

function getOverlay() {
  if (!overlayEl) overlayEl = document.getElementById(OVERLAY_ID);
  return overlayEl;
}

function getApp() {
  return document.getElementById(APP_ID);
}

function applyHide() {
  const overlay = getOverlay();
  const app = getApp();
  if (overlay) overlay.classList.add('hidden');
  if (app) app.classList.remove(LOADING_CLASS);
}

/**
 * Show the generator loading overlay (spinner) and hide the canvas.
 * Call at the very start of a generate action so the UI can paint before heavy work runs.
 */
export function showGeneratorSpinner() {
  const el = getOverlay();
  const app = getApp();
  if (el) {
    el.classList.remove('hidden');
    minDisplayUntil = Date.now() + MIN_DISPLAY_MS;
  }
  if (app) app.classList.add(LOADING_CLASS);
}

/**
 * Hide the generator loading overlay and show the canvas again.
 * Will not hide until at least MIN_DISPLAY_MS has passed since the last showGeneratorSpinner().
 * Call when a generate action finishes (success or error).
 */
export function hideGeneratorSpinner() {
  const el = getOverlay();
  if (!el) return;
  const delay = Math.max(0, minDisplayUntil - Date.now());
  if (delay > 0) {
    setTimeout(applyHide, delay);
  } else {
    applyHide();
  }
}

/**
 * Run a callback after the next paint so the spinner is visible before heavy work blocks the main thread.
 * Use: showGeneratorSpinner(); runAfterSpinnerVisible(() => { ... generate ...; hideGeneratorSpinner(); });
 */
export function runAfterSpinnerVisible(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fn();
    });
  });
}
