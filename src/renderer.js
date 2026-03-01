const PALETTE = {
  background: '#000000',
  boundary: 'rgba(242, 242, 242, 0.30)',
  splitLine: 'rgba(255, 255, 255, 0.12)',
  splitLineActive: 'rgba(255, 255, 255, 0.50)',
  roomFill: 'rgba(0, 212, 255, 0.18)',
  roomStroke: 'rgba(0, 212, 255, 0.55)',
  roomActiveFill: 'rgba(0, 212, 255, 0.38)',
  roomActiveStroke: '#00d4ff',
  corridorFill: 'rgba(0, 212, 255, 0.08)',
  corridorStroke: 'rgba(0, 212, 255, 0.28)',
  corridorActiveFill: 'rgba(0, 212, 255, 0.22)',
  corridorActiveStroke: 'rgba(0, 212, 255, 0.65)',
  exitFill: 'rgba(111, 227, 139, 0.35)',
  exitStroke: '#6de38b',
  spawnMarker: '#ff69b4',
};

const CANVAS_PADDING = 24;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render(steps, currentStepIndex, dungeonWidth, dungeonHeight, camera) {
    const { width: cw, height: ch } = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, cw, ch);

    if (currentStepIndex < 0 || steps.length === 0) return;

    const zoom = camera?.zoom ?? 1;
    const cellSize = Math.min(
      (cw - CANVAS_PADDING * 2) / dungeonWidth,
      (ch - CANVAS_PADDING * 2) / dungeonHeight,
    ) * zoom;
    const ox = (cw - dungeonWidth * cellSize) / 2 + (camera?.panX ?? 0);
    const oy = (ch - dungeonHeight * cellSize) / 2 + (camera?.panY ?? 0);

    const px = (gx) => ox + gx * cellSize;
    const py = (gy) => oy + gy * cellSize;
    const sc = (v) => v * cellSize;

    const collected = collectVisibleElements(steps, currentStepIndex);

    drawBoundary(ctx, collected.boundary, collected.exits, px, py, sc);
    drawExits(ctx, collected.exits, collected.boundary, px, py, sc);
    drawSplitLines(ctx, collected.splitLines, px, py, cellSize);
    drawCorridors(ctx, collected.corridors, px, py, sc);
    drawRooms(ctx, collected.rooms, px, py, sc);
    drawSpawnMarker(ctx, steps, currentStepIndex, px, py, cellSize);
  }

  return { render, resize };
}

function collectVisibleElements(steps, currentStepIndex) {
  const splitLines = [];
  const rooms = [];
  const corridors = [];
  let boundary = null;
  let exits = [];

  const limit = Math.min(currentStepIndex, steps.length - 1);
  for (let i = 0; i <= limit; i++) {
    const step = steps[i];
    const active = i === currentStepIndex;
    if (step.boundary) boundary = step.boundary;
    if (step.exits) exits = step.exits;
    if (step.splitLine) splitLines.push({ ...step.splitLine, active });
    if (step.room) rooms.push({ ...step.room, active });
    if (step.segments) corridors.push({ segments: step.segments, active });
  }

  return { boundary, exits, splitLines, rooms, corridors };
}

function drawBoundary(ctx, boundary, exits, px, py, sc) {
  if (!boundary) return;
  ctx.strokeStyle = PALETTE.boundary;
  ctx.lineWidth = 2;
  const { x, y, width: w, height: h } = boundary;
  if (!exits || exits.length === 0) {
    ctx.strokeRect(px(x), py(y), sc(w), sc(h));
    return;
  }
  const x0 = px(x);
  const y0 = py(y);
  const x1 = px(x + w);
  const y1 = py(y + h);
  const seg = (a, b, c, d) => {
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
    ctx.stroke();
  };
  const exitN = exits.find((e) => e.side === 'n');
  const exitS = exits.find((e) => e.side === 's');
  const exitW = exits.find((e) => e.side === 'w');
  const exitE = exits.find((e) => e.side === 'e');
  if (exitN) {
    if (exitN.x > 0) seg(x0, y0, px(x + exitN.x), y0);
    if (exitN.x + exitN.span < w) seg(px(x + exitN.x + exitN.span), y0, x1, y0);
  } else seg(x0, y0, x1, y0);
  if (exitS) {
    if (exitS.x > 0) seg(x0, y1, px(x + exitS.x), y1);
    if (exitS.x + exitS.span < w) seg(px(x + exitS.x + exitS.span), y1, x1, y1);
  } else seg(x0, y1, x1, y1);
  if (exitW) {
    if (exitW.z > 0) seg(x0, y0, x0, py(y + exitW.z));
    if (exitW.z + exitW.span < h) seg(x0, py(y + exitW.z + exitW.span), x0, y1);
  } else seg(x0, y0, x0, y1);
  if (exitE) {
    if (exitE.z > 0) seg(x1, y0, x1, py(y + exitE.z));
    if (exitE.z + exitE.span < h) seg(x1, py(y + exitE.z + exitE.span), x1, y1);
  } else seg(x1, y0, x1, y1);
}

function drawExits(ctx, exits, boundary, px, py, sc) {
  if (!exits?.length || !boundary) return;
  const w = boundary.width;
  const h = boundary.height;
  ctx.lineWidth = 2;
  for (const ex of exits) {
    let rx, ry, rw, rh;
    if (ex.side === 'n') {
      rx = ex.x;
      ry = 0;
      rw = ex.span;
      rh = 1;
    } else if (ex.side === 's') {
      rx = ex.x;
      ry = h - 1;
      rw = ex.span;
      rh = 1;
    } else if (ex.side === 'w') {
      rx = 0;
      ry = ex.z;
      rw = 1;
      rh = ex.span;
    } else if (ex.side === 'e') {
      rx = w - 1;
      ry = ex.z;
      rw = 1;
      rh = ex.span;
    } else continue;
    ctx.fillStyle = PALETTE.exitFill;
    ctx.fillRect(px(rx), py(ry), sc(rw), sc(rh));
    ctx.strokeStyle = PALETTE.exitStroke;
    ctx.strokeRect(px(rx), py(ry), sc(rw), sc(rh));
  }
}

function drawSplitLines(ctx, splitLines, px, py, cellSize) {
  for (const line of splitLines) {
    ctx.strokeStyle = line.active ? PALETTE.splitLineActive : PALETTE.splitLine;
    ctx.lineWidth = line.active ? 2 : 1;
    ctx.setLineDash([cellSize * 0.4, cellSize * 0.4]);
    ctx.beginPath();
    ctx.moveTo(px(line.x1), py(line.y1));
    ctx.lineTo(px(line.x2), py(line.y2));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawCorridors(ctx, corridors, px, py, sc) {
  for (const corridor of corridors) {
    const fill = corridor.active ? PALETTE.corridorActiveFill : PALETTE.corridorFill;
    const stroke = corridor.active ? PALETTE.corridorActiveStroke : PALETTE.corridorStroke;
    const lw = corridor.active ? 1.5 : 0.5;

    for (const seg of corridor.segments) {
      ctx.fillStyle = fill;
      ctx.fillRect(px(seg.x), py(seg.y), sc(seg.width), sc(seg.height));
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.strokeRect(px(seg.x), py(seg.y), sc(seg.width), sc(seg.height));
    }
  }
}

function drawRooms(ctx, rooms, px, py, sc) {
  for (const room of rooms) {
    ctx.fillStyle = room.active ? PALETTE.roomActiveFill : PALETTE.roomFill;
    ctx.fillRect(px(room.x), py(room.y), sc(room.width), sc(room.height));
    ctx.strokeStyle = room.active ? PALETTE.roomActiveStroke : PALETTE.roomStroke;
    ctx.lineWidth = room.active ? 2 : 1;
    ctx.strokeRect(px(room.x), py(room.y), sc(room.width), sc(room.height));
  }
}

function drawSpawnMarker(ctx, steps, currentStepIndex, px, py, cellSize) {
  const firstRoomStepIndex = steps.findIndex((s) => s.room);
  if (firstRoomStepIndex < 0 || currentStepIndex < firstRoomStepIndex) return;
  const room = steps[firstRoomStepIndex].room;
  const cx = room.x + room.width / 2;
  const cy = room.y + room.height / 2;
  const radius = Math.max(2, cellSize * 0.4);
  ctx.fillStyle = PALETTE.spawnMarker;
  ctx.beginPath();
  ctx.arc(px(cx), py(cy), radius, 0, Math.PI * 2);
  ctx.fill();
}
