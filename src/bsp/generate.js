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
  addDefaultExits(config, rng, steps, root);

  return steps;
}

/** Cut an exit (hole) in one or two random rooms that touch the boundary. */
function addDefaultExits(config, rng, steps, root) {
  const w = config.dungeonWidth;
  const h = config.dungeonHeight;
  const rooms = collectLeaves(root).filter((n) => n.room).map((n) => n.room);
  const onBoundary = rooms.filter((r) => r.y === 0 || r.y + r.height === h || r.x === 0 || r.x + r.width === w);
  const exits = [];

  if (onBoundary.length >= 2) {
    const [a, b] = pickTwoDifferent(onBoundary, rng);
    cutExitInRoom(a, w, h, rng, exits);
    cutExitInRoom(b, w, h, rng, exits);
  } else if (onBoundary.length === 1) {
    cutExitInRoom(onBoundary[0], w, h, rng, exits);
  } else if (rooms.length >= 2) {
    const [a, b] = pickTwoDifferent(rooms, rng);
    cutExitInRoom(a, w, h, rng, exits);
    cutExitInRoom(b, w, h, rng, exits);
  } else if (rooms.length === 1) {
    cutExitInRoom(rooms[0], w, h, rng, exits);
  }
  if (exits.length === 0) {
    const span = Math.max(2, Math.min(4, Math.floor(w / 4)));
    exits.push({ side: 'n', x: Math.floor(rng() * Math.max(0, w - span + 1)), span });
  }

  steps.push({ phase: StepPhase.CORRIDORS, label: 'Exits', exits });
}

function pickTwoDifferent(rooms, rng) {
  const a = Math.floor(rng() * rooms.length);
  let b = Math.floor(rng() * rooms.length);
  while (b === a && rooms.length > 1) b = Math.floor(rng() * rooms.length);
  return [rooms[a], rooms[b]];
}

/** If room touches the boundary, cut one exit (hole) in that wall. */
function cutExitInRoom(room, w, h, rng, exits) {
  const sides = [];
  if (room.y === 0 && room.width >= 2) sides.push('n');
  if (room.y + room.height === h && room.width >= 2) sides.push('s');
  if (room.x === 0 && room.height >= 2) sides.push('w');
  if (room.x + room.width === w && room.height >= 2) sides.push('e');
  if (sides.length === 0) return;
  const side = sides[Math.floor(rng() * sides.length)];
  const span = Math.max(2, Math.min(4, side === 'n' || side === 's' ? room.width : room.height));
  if (side === 'n' || side === 's') {
    const maxStart = room.x + room.width - span;
    const start = room.x + (maxStart <= room.x ? 0 : Math.floor(rng() * (maxStart - room.x + 1)));
    exits.push({ side, x: start, span });
  } else {
    const maxStart = room.y + room.height - span;
    const start = room.y + (maxStart <= room.y ? 0 : Math.floor(rng() * (maxStart - room.y + 1)));
    exits.push({ side, z: start, span });
  }
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
  const w = config.dungeonWidth;
  const h = config.dungeonHeight;
  // No padding on sides where the leaf touches the dungeon boundary so rooms can have exits there
  const padW = leaf.x === 0 ? 0 : padding;
  const padE = leaf.x + leaf.width === w ? 0 : padding;
  const padN = leaf.y === 0 ? 0 : padding;
  const padS = leaf.y + leaf.height === h ? 0 : padding;
  const maxW = leaf.width - padW - padE;
  const maxH = leaf.height - padN - padS;

  if (maxW < config.minRoomSize || maxH < config.minRoomSize) return;

  const roomW = Math.max(config.minRoomSize, Math.floor(config.minRoomSize + rng() * (maxW - config.minRoomSize)));
  const roomH = Math.max(config.minRoomSize, Math.floor(config.minRoomSize + rng() * (maxH - config.minRoomSize)));
  const x = Math.floor(leaf.x + padW + rng() * Math.max(0, maxW - roomW));
  const y = Math.floor(leaf.y + padN + rng() * Math.max(0, maxH - roomH));

  leaf.room = { x, y, width: roomW, height: roomH };

  steps.push({
    phase: StepPhase.ROOMS,
    label: `Room at (${x}, ${y}) ${roomW}\u00d7${roomH}`,
    room: { x, y, width: roomW, height: roomH },
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
