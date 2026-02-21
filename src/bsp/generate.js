import { createRNG } from './random.js';

export const StepPhase = Object.freeze({
  PARTITION: 'partition',
  ROOMS: 'rooms',
  CORRIDORS: 'corridors',
});

export function generateDungeon(config) {
  const rng = createRNG(config.seed);
  const steps = [];

  const root = createNode(0, 0, config.dungeonWidth, config.dungeonHeight, 0);

  steps.push({
    phase: StepPhase.PARTITION,
    label: 'Initialize boundary',
    boundary: { x: 0, y: 0, width: config.dungeonWidth, height: config.dungeonHeight },
  });

  partition(root, config, rng, steps);
  placeAllRooms(root, config, rng, steps);
  connectAllCorridors(root, config, steps);
  placeExits(config, rng, steps);

  return steps;
}

function rectsIntersect(a, b) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

function collectAllRects(steps) {
  const rects = [];
  for (const step of steps) {
    if (step.room) rects.push(step.room);
    if (step.segments) rects.push(...step.segments);
  }
  return rects;
}

/**
 * Pick two exits on opposite sides and add corridor segments from each exit inward
 * until they meet a room or corridor, so exits connect into the dungeon.
 */
function placeExits(config, rng, steps) {
  const span = Math.max(1, config.exitWidth ?? 2);
  const w = config.dungeonWidth;
  const h = config.dungeonHeight;
  const useHorizontal = rng() > 0.5;
  const allRects = collectAllRects(steps);
  const exitSegments = [];

  if (useHorizontal) {
    const minX = 0;
    const maxX = Math.max(0, w - span);
    const minSeparation = Math.max(1, span);
    let x1 = minX + Math.floor(rng() * (maxX - minX + 1));
    let x2 = minX + Math.floor(rng() * (maxX - minX + 1));
    let safety = 0;
    while (Math.abs(x2 - x1) < minSeparation && safety < 30) {
      x2 = minX + Math.floor(rng() * (maxX - minX + 1));
      safety++;
    }
    const exits = [
      { side: 'n', x: x1, span },
      { side: 's', x: x2, span },
    ];
    for (const ex of exits) {
      const seg = exitStubSegment(ex, w, h, allRects);
      if (seg) exitSegments.push(seg);
    }
    steps.push({
      phase: StepPhase.CORRIDORS,
      label: 'Exits (top & bottom)',
      exits,
      segments: exitSegments.length ? exitSegments : undefined,
    });
  } else {
    const minZ = 0;
    const maxZ = Math.max(0, h - span);
    const minSeparation = Math.max(1, span);
    let z1 = minZ + Math.floor(rng() * (maxZ - minZ + 1));
    let z2 = minZ + Math.floor(rng() * (maxZ - minZ + 1));
    let safety = 0;
    while (Math.abs(z2 - z1) < minSeparation && safety < 30) {
      z2 = minZ + Math.floor(rng() * (maxZ - minZ + 1));
      safety++;
    }
    const exits = [
      { side: 'w', z: z1, span },
      { side: 'e', z: z2, span },
    ];
    for (const ex of exits) {
      const seg = exitStubSegment(ex, w, h, allRects);
      if (seg) exitSegments.push(seg);
    }
    steps.push({
      phase: StepPhase.CORRIDORS,
      label: 'Exits (left & right)',
      exits,
      segments: exitSegments.length ? exitSegments : undefined,
    });
  }
}

/**
 * Build a corridor segment from the exit inward until it intersects a room or corridor.
 */
function exitStubSegment(exit, w, h, allRects) {
  const span = exit.span;
  const maxExtend = Math.max(w, h);

  if (exit.side === 'n') {
    for (let depth = 1; depth <= maxExtend; depth++) {
      const stub = { x: exit.x, y: 0, width: span, height: depth };
      if (allRects.some((r) => rectsIntersect(stub, r))) return stub;
    }
    return { x: exit.x, y: 0, width: span, height: Math.min(5, h) };
  }
  if (exit.side === 's') {
    for (let depth = 1; depth <= maxExtend; depth++) {
      const stub = { x: exit.x, y: h - depth, width: span, height: depth };
      if (allRects.some((r) => rectsIntersect(stub, r))) return stub;
    }
    return { x: exit.x, y: h - Math.min(5, h), width: span, height: Math.min(5, h) };
  }
  if (exit.side === 'w') {
    for (let depth = 1; depth <= maxExtend; depth++) {
      const stub = { x: 0, y: exit.z, width: depth, height: span };
      if (allRects.some((r) => rectsIntersect(stub, r))) return stub;
    }
    return { x: 0, y: exit.z, width: Math.min(5, w), height: span };
  }
  if (exit.side === 'e') {
    for (let depth = 1; depth <= maxExtend; depth++) {
      const stub = { x: w - depth, y: exit.z, width: depth, height: span };
      if (allRects.some((r) => rectsIntersect(stub, r))) return stub;
    }
    return { x: w - Math.min(5, w), y: exit.z, width: Math.min(5, w), height: span };
  }
  return null;
}

function createNode(x, y, width, height, depth) {
  return { x, y, width, height, depth, left: null, right: null, room: null };
}

function chooseSplitDirection(node, rng) {
  const ratio = node.width / node.height;
  if (ratio > 1.25) return 'vertical';
  if (ratio < 0.8) return 'horizontal';
  return rng() > 0.5 ? 'vertical' : 'horizontal';
}

function partition(node, config, rng, steps) {
  if (node.depth >= config.maxDepth) return;

  const canSplitH = node.height >= config.minPartitionSize * 2;
  const canSplitV = node.width >= config.minPartitionSize * 2;
  if (!canSplitH && !canSplitV) return;

  let direction = chooseSplitDirection(node, rng);
  if (direction === 'vertical' && !canSplitV) direction = 'horizontal';
  if (direction === 'horizontal' && !canSplitH) direction = 'vertical';

  const ratio = 0.35 + rng() * 0.3;

  if (direction === 'vertical') {
    const splitX = Math.floor(node.x + node.width * ratio);
    node.left = createNode(node.x, node.y, splitX - node.x, node.height, node.depth + 1);
    node.right = createNode(splitX, node.y, node.x + node.width - splitX, node.height, node.depth + 1);
    steps.push({
      phase: StepPhase.PARTITION,
      label: `Split vertical at x=${splitX}`,
      splitLine: { x1: splitX, y1: node.y, x2: splitX, y2: node.y + node.height },
    });
  } else {
    const splitY = Math.floor(node.y + node.height * ratio);
    node.left = createNode(node.x, node.y, node.width, splitY - node.y, node.depth + 1);
    node.right = createNode(node.x, splitY, node.width, node.y + node.height - splitY, node.depth + 1);
    steps.push({
      phase: StepPhase.PARTITION,
      label: `Split horizontal at y=${splitY}`,
      splitLine: { x1: node.x, y1: splitY, x2: node.x + node.width, y2: splitY },
    });
  }

  partition(node.left, config, rng, steps);
  partition(node.right, config, rng, steps);
}

function collectLeaves(node) {
  if (!node.left && !node.right) return [node];
  const result = [];
  if (node.left) result.push(...collectLeaves(node.left));
  if (node.right) result.push(...collectLeaves(node.right));
  return result;
}

function placeAllRooms(root, config, rng, steps) {
  for (const leaf of collectLeaves(root)) {
    placeRoom(leaf, config, rng, steps);
  }
}

function placeRoom(leaf, config, rng, steps) {
  const padding = config.roomPadding;
  const maxW = leaf.width - padding * 2;
  const maxH = leaf.height - padding * 2;

  if (maxW < config.minRoomSize || maxH < config.minRoomSize) return;

  const w = Math.max(config.minRoomSize, Math.floor(config.minRoomSize + rng() * (maxW - config.minRoomSize)));
  const h = Math.max(config.minRoomSize, Math.floor(config.minRoomSize + rng() * (maxH - config.minRoomSize)));
  const x = Math.floor(leaf.x + padding + rng() * Math.max(0, maxW - w));
  const y = Math.floor(leaf.y + padding + rng() * Math.max(0, maxH - h));

  leaf.room = { x, y, width: w, height: h };

  steps.push({
    phase: StepPhase.ROOMS,
    label: `Room at (${x}, ${y}) ${w}\u00d7${h}`,
    room: { x, y, width: w, height: h },
  });
}

function findRoom(node) {
  if (node.room) return node.room;
  const leftRoom = node.left ? findRoom(node.left) : null;
  if (leftRoom) return leftRoom;
  return node.right ? findRoom(node.right) : null;
}

function connectAllCorridors(node, config, steps) {
  if (!node.left || !node.right) return;

  connectAllCorridors(node.left, config, steps);
  connectAllCorridors(node.right, config, steps);

  const roomA = findRoom(node.left);
  const roomB = findRoom(node.right);
  if (!roomA || !roomB) return;

  buildCorridor(roomA, roomB, config.corridorWidth, steps);
}

function buildCorridor(roomA, roomB, corridorWidth, steps) {
  const ax = Math.floor(roomA.x + roomA.width / 2);
  const ay = Math.floor(roomA.y + roomA.height / 2);
  const bx = Math.floor(roomB.x + roomB.width / 2);
  const by = Math.floor(roomB.y + roomB.height / 2);
  const hw = Math.floor(corridorWidth / 2);

  const segments = [];

  if (ax !== bx) {
    segments.push({
      x: Math.min(ax, bx) - hw,
      y: ay - hw,
      width: Math.abs(bx - ax) + corridorWidth,
      height: corridorWidth,
    });
  }

  if (ay !== by) {
    segments.push({
      x: bx - hw,
      y: Math.min(ay, by) - hw,
      width: corridorWidth,
      height: Math.abs(by - ay) + corridorWidth,
    });
  }

  if (segments.length > 0) {
    steps.push({
      phase: StepPhase.CORRIDORS,
      label: 'Connect rooms',
      segments,
    });
  }
}
