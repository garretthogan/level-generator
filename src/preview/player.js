// Ref: https://threejs.org/docs/pages/PointerLockControls.html
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const MOVE_SPEED = 8;
const COLLISION_MARGIN = 0.3;

export function createPlayer(camera, domElement, floorGrid, offsetX, offsetZ) {
  const controls = new PointerLockControls(camera, domElement);
  const keys = new Set();

  domElement.addEventListener('click', () => {
    if (!controls.isLocked) controls.lock();
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

  function update(dt) {
    if (!controls.isLocked) return;

    const distance = MOVE_SPEED * dt;

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

    if (!canMoveTo(nextX, nextZ)) {
      camera.position.x = prevX;
      camera.position.z = prevZ;

      if (canMoveTo(nextX, prevZ)) {
        camera.position.x = nextX;
      } else if (canMoveTo(prevX, nextZ)) {
        camera.position.z = nextZ;
      }
    }

    camera.position.y = 1.6;
  }

  return { controls, update };
}
