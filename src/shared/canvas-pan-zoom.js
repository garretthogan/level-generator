/**
 * Shared pan/zoom for 2D generator canvases (dungeon and arena).
 * Single implementation so behavior and zoom math stay in one place.
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ panX: number, panY: number, zoom: number }} camera - mutable camera state
 * @param {() => void} onDraw - called after pan/zoom changes (e.g. renderer.draw())
 */
export function wirePanZoom(canvas, camera, onDraw) {
  const drag = { active: false, startX: 0, startY: 0, panOriginX: 0, panOriginY: 0 };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag.active = true;
    drag.pointerId = e.pointerId;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.panOriginX = camera.panX;
    drag.panOriginY = camera.panY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag.active) return;
    camera.panX = drag.panOriginX + (e.clientX - drag.startX);
    camera.panY = drag.panOriginY + (e.clientY - drag.startY);
    onDraw();
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!drag.active) return;
    drag.active = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    canvas.style.cursor = '';
  });

  canvas.addEventListener('pointercancel', () => {
    if (drag.active && drag.pointerId != null) {
      try { canvas.releasePointerCapture(drag.pointerId); } catch (_) {}
    }
    drag.active = false;
    canvas.style.cursor = '';
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const oldZoom = camera.zoom;
    const factor = Math.pow(1.001, -e.deltaY);
    camera.zoom = Math.min(10, Math.max(0.1, oldZoom * factor));
    const ratio = camera.zoom / oldZoom;
    camera.panX = dx * (1 - ratio) + camera.panX * ratio;
    camera.panY = dy * (1 - ratio) + camera.panY * ratio;
    onDraw();
  }, { passive: false });
}
