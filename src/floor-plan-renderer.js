/**
 * 2D Canvas renderer for floor plan generator output.
 * Draws rooms, hallways, walls, and openings with pan/zoom.
 */

const CANVAS_PADDING = 24;

const PALETTE = {
  background: '#0d0d0d',
  room: 'rgba(0, 212, 255, 0.2)',
  roomStroke: 'rgba(0, 212, 255, 0.5)',
  hallway: 'rgba(40, 44, 52, 0.8)',
  hallwayStroke: 'rgba(0, 212, 255, 0.25)',
  wall: '#f4f6f8',
  door: '#6de38b',
  window: '#5ab6ff',
  spawn: '#ff69b4',
};

/**
 * Build a set of cell keys for hallways so we can distinguish room vs hallway fill.
 */
function getHallwayCellSet(plan) {
  const set = new Set();
  for (const hall of plan.hallways ?? []) {
    for (const cell of hall.cells ?? []) {
      set.add(`${Math.floor(cell.x)},${Math.floor(cell.y)}`);
    }
  }
  return set;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ render(plan: object, camera: object): void, resize(): void }}
 */
export function createFloorPlanRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * @param {object} plan - Floor plan from generateFloorPlan()
   * @param {object} camera - { panX, panY, zoom }
   */
  function render(plan, camera) {
    const { width: cw, height: ch } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, cw, ch);

    if (!plan?.meta) return;

    const w = Math.max(1, Number(plan.meta.width) ?? 36);
    const h = Math.max(1, Number(plan.meta.height) ?? 24);
    const zoom = camera?.zoom ?? 1;
    const cellSize =
      Math.min(
        (cw - CANVAS_PADDING * 2) / w,
        (ch - CANVAS_PADDING * 2) / h
      ) * zoom;
    const ox = (cw - w * cellSize) / 2 + (camera?.panX ?? 0);
    const oy = (ch - h * cellSize) / 2 + (camera?.panY ?? 0);

    const px = (gx) => ox + gx * cellSize;
    const py = (gy) => oy + gy * cellSize;
    const sc = (v) => v * cellSize;

    const hallwayCells = getHallwayCellSet(plan);
    const drawn = new Set();

    for (const hallway of plan.hallways ?? []) {
      for (const cell of hallway.cells ?? []) {
        const x = Math.floor(Number(cell.x));
        const y = Math.floor(Number(cell.y));
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const key = `${x},${y}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        ctx.fillStyle = PALETTE.hallway;
        ctx.fillRect(px(x), py(y), sc(1), sc(1));
        ctx.strokeStyle = PALETTE.hallwayStroke;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px(x), py(y), sc(1), sc(1));
      }
    }

    for (const room of plan.rooms ?? []) {
      for (const cell of room.cells ?? []) {
        const x = Math.floor(Number(cell.x));
        const y = Math.floor(Number(cell.y));
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const key = `${x},${y}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        ctx.fillStyle = PALETTE.room;
        ctx.fillRect(px(x), py(y), sc(1), sc(1));
        ctx.strokeStyle = PALETTE.roomStroke;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px(x), py(y), sc(1), sc(1));
      }
    }

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, cellSize * 0.2);

    for (const wall of plan.walls ?? []) {
      ctx.strokeStyle = PALETTE.wall;
      ctx.beginPath();
      ctx.moveTo(px(wall.x1), py(wall.y1));
      ctx.lineTo(px(wall.x2), py(wall.y2));
      ctx.stroke();
    }

    for (const opening of plan.openings ?? []) {
      ctx.strokeStyle = opening.type === 'door' ? PALETTE.door : PALETTE.window;
      ctx.lineWidth = Math.max(0.5, cellSize * 0.15);
      ctx.beginPath();
      ctx.moveTo(px(opening.x1), py(opening.y1));
      ctx.lineTo(px(opening.x2), py(opening.y2));
      ctx.stroke();
    }

    const rooms = plan.rooms ?? [];
    if (rooms.length > 0) {
      const r = rooms[0];
      const cx = px(r.labelX ?? (r.x + r.width / 2));
      const cy = py(r.labelY ?? (r.y + r.height / 2));
      const rad = Math.max(2, cellSize * 0.3);
      ctx.fillStyle = PALETTE.spawn;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  return { render, resize };
}
