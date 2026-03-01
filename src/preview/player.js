// Quake-style FPS: WASD + mouse look, Shift to sprint, raw mouse input.
// Ref: https://threejs.org/docs/#examples/en/controls/PointerLockControls
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const MOVE_SPEED = 7;
const SPRINT_MULTIPLIER = 1.65;
const COLLISION_MARGIN = 0.3;
const POINTER_SPEED = 2.2;

function segmentsIntersect(a1x, a1z, a2x, a2z, b1x, b1z, b2x, b2z) {
  const dxa = a2x - a1x;
  const dza = a2z - a1z;
  const dxb = b2x - b1x;
  const dzb = b2z - b1z;
  const denom = dxa * dzb - dza * dxb;
  if (Math.abs(denom) < 1e-10) return false;
  const t = ((b1x - a1x) * dzb - (b1z - a1z) * dxb) / denom;
  const s = ((b1x - a1x) * dza - (b1z - a1z) * dxa) / denom;
  return t > 1e-6 && t < 1 - 1e-6 && s > 1e-6 && s < 1 - 1e-6;
}

export function createPlayer(camera, domElement, floorGrid, offsetX, offsetZ, wallSegments = null) {
  const controls = new PointerLockControls(camera, domElement);
  controls.pointerSpeed = POINTER_SPEED;
  const keys = new Set();
  const walls = Array.isArray(wallSegments) ? wallSegments : [];

  domElement.addEventListener('click', () => {
    if (!controls.isLocked) controls.lock(true);
  });

  document.addEventListener('keydown', (e) => keys.add(e.code));
  document.addEventListener('keyup', (e) => keys.delete(e.code));

  function isWalkable(worldX, worldZ) {
    const gx = Math.floor(worldX - offsetX);
    const gz = Math.floor(worldZ - offsetZ);
    if (gz < 0 || gz >= floorGrid.length) return false;
    if (gx < 0 || gx >= floorGrid[0].length) return false;
    return floorGrid[gz][gx] === 1;
  }

  function canMoveTo(x, z) {
    return (
      isWalkable(x - COLLISION_MARGIN, z - COLLISION_MARGIN) &&
      isWalkable(x + COLLISION_MARGIN, z - COLLISION_MARGIN) &&
      isWalkable(x - COLLISION_MARGIN, z + COLLISION_MARGIN) &&
      isWalkable(x + COLLISION_MARGIN, z + COLLISION_MARGIN)
    );
  }

  function moveCrossesWall(prevX, prevZ, nextX, nextZ) {
    for (const w of walls) {
      if (segmentsIntersect(prevX, prevZ, nextX, nextZ, w.x1, w.z1, w.x2, w.z2)) return true;
    }
    return false;
  }

  function update(dt) {
    if (!controls.isLocked) return;

    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = MOVE_SPEED * (sprint ? SPRINT_MULTIPLIER : 1);
    const distance = speed * dt;

    let forward = 0;
    let right = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) forward += distance;
    if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= distance;
    if (keys.has('KeyD') || keys.has('ArrowRight')) right += distance;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) right -= distance;

    if (forward === 0 && right === 0) return;

    const prevX = camera.position.x;
    const prevZ = camera.position.z;

    controls.moveForward(forward);
    controls.moveRight(right);

    const nextX = camera.position.x;
    const nextZ = camera.position.z;

    const hitWall = walls.length > 0 && moveCrossesWall(prevX, prevZ, nextX, nextZ);
    if (!canMoveTo(nextX, nextZ) || hitWall) {
      camera.position.x = prevX;
      camera.position.z = prevZ;

      if (!hitWall) {
        if (canMoveTo(nextX, prevZ)) {
          camera.position.x = nextX;
        } else if (canMoveTo(prevX, nextZ)) {
          camera.position.z = nextZ;
        }
      }
    }

    camera.position.y = 1.6;
  }

  return { controls, update };
}
