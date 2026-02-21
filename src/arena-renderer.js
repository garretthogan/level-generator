/**
 * 2D Canvas renderer for arena generator output.
 * Draws grid (wall vs open) and strategic markers with pan/zoom.
 * Grid is column-major: grid[x][z], cols = grid.length, rows = grid[0].length.
 */

const CANVAS_PADDING = 24;

const PALETTE = {
  background: '#0d0d0d',
  open: 'rgba(40, 44, 52, 0.6)',
  wall: '#4a5568',
  wallStroke: '#2d3748',
  spawnA: '#3b82f6',
  spawnB: '#ef4444',
  flagTeamA: '#60a5fa',
  flagTeamB: '#f87171',
  flagNeutral: '#a78bfa',
  collisionPoint: '#fbbf24',
  cover: '#6ee7b7',
};

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ render(arenaResult: object, camera: object): void, resize(): void }}
 */
export function createArenaRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * @param {object} arenaResult - { grids, spawns, flags, collisionPoints, covers }
   * @param {object} camera - { panX, panY, zoom }
   */
  function render(arenaResult, camera) {
    const { width: cw, height: ch } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, cw, ch);

    if (!arenaResult?.grids?.length) return;

    const grid = arenaResult.grids[0];
    const cols = grid.length;
    const rows = grid[0].length;

    const zoom = camera?.zoom ?? 1;
    const cellSize =
      Math.min(
        (cw - CANVAS_PADDING * 2) / cols,
        (ch - CANVAS_PADDING * 2) / rows
      ) * zoom;
    const ox = (cw - cols * cellSize) / 2 + (camera?.panX ?? 0);
    const oy = (ch - rows * cellSize) / 2 + (camera?.panY ?? 0);

    const px = (gx) => ox + gx * cellSize;
    const py = (gz) => oy + gz * cellSize;
    const sc = (v) => v * cellSize;

    for (let x = 0; x < cols; x++) {
      for (let z = 0; z < rows; z++) {
        const isWall = grid[x][z] === 1;
        ctx.fillStyle = isWall ? PALETTE.wall : PALETTE.open;
        ctx.fillRect(px(x), py(z), sc(1), sc(1));
        if (isWall) {
          ctx.strokeStyle = PALETTE.wallStroke;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px(x), py(z), sc(1), sc(1));
        }
      }
    }

    const spawns = arenaResult.spawns ?? [];
    spawns.forEach((s, i) => {
      const color = i === 0 ? PALETTE.spawnA : PALETTE.spawnB;
      const cx = px(s.x) + cellSize / 2;
      const cy = py(s.z) + cellSize / 2;
      const r = Math.max(2, cellSize * 0.35);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    const flags = arenaResult.flags ?? [];
    flags.forEach((f) => {
      let color = PALETTE.flagNeutral;
      if (f.type === 'team-a') color = PALETTE.flagTeamA;
      else if (f.type === 'team-b') color = PALETTE.flagTeamB;
      const cx = px(f.x) + cellSize / 2;
      const cy = py(f.z) + cellSize / 2;
      const size = Math.max(2, cellSize * 0.3);
      ctx.fillStyle = color;
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
    });

    const collisionPoints = arenaResult.collisionPoints ?? [];
    collisionPoints.forEach((p) => {
      const cx = px(p.x) + cellSize / 2;
      const cy = py(p.z) + cellSize / 2;
      const r = Math.max(1.5, cellSize * 0.25);
      ctx.fillStyle = PALETTE.collisionPoint;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    const covers = arenaResult.covers ?? [];
    covers.forEach((c) => {
      const cx = px(c.x) + cellSize / 2;
      const cy = py(c.z) + cellSize / 2;
      const size = Math.max(1.5, cellSize * 0.22);
      ctx.fillStyle = PALETTE.cover;
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    });
  }

  return { render, resize };
}
