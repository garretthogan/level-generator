import * as THREE from 'three';
import { buildArenaMeshes } from './arena-mesh.js';
import { createPlayer } from './player.js';

/**
 * Runs the 3D arena preview scene. Call destroy() when leaving preview.
 * @param {HTMLElement} container
 * @param {HTMLElement} overlay
 * @param {object} arenaResult - { grids, spawns, flags, collisionPoints, covers }
 * @returns {{ destroy: () => void }}
 */
export function runArenaPreviewScene(container, overlay, arenaResult) {
  const { group, grid, spawnPoint, offsetX, offsetZ } = buildArenaMeshes(arenaResult);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 20, 80);
  scene.add(group);

  const spawnMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff69b4 })
  );
  spawnMarker.position.set(spawnPoint.x, 0.15, spawnPoint.z);
  scene.add(spawnMarker);

  scene.add(new THREE.AmbientLight(0xaabbdd, 1));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = false;
  scene.add(dirLight);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.copy(spawnPoint);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const clickTarget = container.parentElement || container;
  const player = createPlayer(camera, clickTarget, grid, offsetX, offsetZ);
  if (overlay) {
    player.controls.addEventListener('lock', () => overlay.classList.add('hidden'));
    player.controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));
  }
  scene.add(player.controls.object);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  const timer = new THREE.Timer();
  let frameId = 0;

  function animate() {
    frameId = requestAnimationFrame(animate);
    timer.update();
    player.update(timer.getDelta());
    renderer.render(scene, camera);
  }
  animate();

  function destroy() {
    document.exitPointerLock();
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.remove();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  return { destroy };
}
