import * as THREE from 'three';
import { buildDungeonMeshes } from './dungeon-mesh.js';
import { loadDarkTextures } from './dark-textures.js';
import { createPlayer } from './player.js';

/**
 * Runs the 3D preview scene inside the given container. Call destroy() when leaving preview.
 * Loads Dark folder textures and applies them randomly to each wall and floor.
 * @param {HTMLElement} container - Element to append the canvas to (e.g. #preview-canvas-container)
 * @param {HTMLElement} overlay - Overlay element to hide on pointer lock, show on unlock
 * @param {Object} config - Dungeon config
 * @param {Array} steps - Generated dungeon steps
 * @returns {Promise<{ destroy: () => void }>}
 */
export async function runPreviewScene(container, overlay, config, steps) {
  const darkTextures = await loadDarkTextures();
  const { group, grid, spawnPoint, offsetX, offsetZ } = buildDungeonMeshes(steps, config, darkTextures);

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
