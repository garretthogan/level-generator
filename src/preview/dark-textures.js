/**
 * Load and provide random textures from /textures/Dark for 3D preview walls and floors.
 * Uses import.meta.env.BASE_URL so textures load when the app is served from a subpath (e.g. GitHub Pages).
 * Ref: https://threejs.org/docs/#api/en/loaders/TextureLoader
 */

import * as THREE from 'three';

// Vite BASE_URL is '/' in dev or '/repo-name/' on GitHub Pages.
const getBase = () => `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/textures/Dark`;

const DARK_TEXTURE_PATHS = [
  () => `${getBase()}/texture_01.png`,
  () => `${getBase()}/texture_13.png`,
  () => `${getBase()}/Fixtures/texture_02.png`,
  () => `${getBase()}/Fixtures/texture_03.png`,
  () => `${getBase()}/Fixtures/texture_04.png`,
  () => `${getBase()}/Fixtures/texture_05.png`,
  () => `${getBase()}/Fixtures/texture_06.png`,
  () => `${getBase()}/Fixtures/texture_07.png`,
  () => `${getBase()}/Fixtures/texture_08.png`,
  () => `${getBase()}/Fixtures/texture_09.png`,
];

let cachedTexturesPromise = null;

/**
 * Load all Dark folder textures. Cached after first load.
 * @returns {Promise<THREE.Texture[]>}
 */
export function loadDarkTextures() {
  if (cachedTexturesPromise) return cachedTexturesPromise;
  const loader = new THREE.TextureLoader();
  cachedTexturesPromise = Promise.all(
    DARK_TEXTURE_PATHS.map((getPath) =>
      new Promise((resolve, reject) => {
        const path = typeof getPath === 'function' ? getPath() : getPath;
        loader.load(
          path,
          (tex) => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            resolve(tex);
          },
          undefined,
          (err) => reject(err)
        );
      })
    )
  ).catch((err) => {
    cachedTexturesPromise = null;
    throw err;
  });
  return cachedTexturesPromise;
}

/**
 * Create a material using the given texture (for floor or wall).
 * @param {THREE.Texture} texture
 * @param {{ repeatX?: number, repeatY?: number }} [opts]
 * @returns {THREE.MeshStandardMaterial}
 */
export function createMaterialWithTexture(texture, opts = {}) {
  const repeatX = opts.repeatX ?? 1;
  const repeatY = opts.repeatY ?? 1;
  texture.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.75,
    metalness: 0.05,
  });
}

/**
 * Pick a random texture and return a new material for a floor tile.
 * Pass repeatX/repeatY in world units so the texture tiles (one repeat per unit).
 * @param {THREE.Texture[]} textures - from loadDarkTextures()
 * @param {{ repeatX?: number, repeatY?: number }} [opts] - face size in world units for tiling; default (1, 1)
 * @param {() => number} [rng] - 0..1 random; defaults to Math.random
 * @returns {THREE.MeshStandardMaterial}
 */
export function getRandomFloorMaterial(textures, opts = {}, rng = Math.random) {
  if (!textures?.length) return null;
  const tex = textures[Math.floor(rng() * textures.length)];
  const repeat = { repeatX: opts.repeatX ?? 1, repeatY: opts.repeatY ?? 1 };
  return createMaterialWithTexture(tex.clone(), repeat);
}

/**
 * Pick a random texture and return a new material for a wall segment.
 * @param {THREE.Texture[]} textures
 * @param {{ repeatX?: number, repeatY?: number }} [opts] - optional repeat for segment size
 * @param {() => number} [rng]
 * @returns {THREE.MeshStandardMaterial}
 */
export function getRandomWallMaterial(textures, opts = {}, rng = Math.random) {
  if (!textures?.length) return null;
  const tex = textures[Math.floor(rng() * textures.length)];
  return createMaterialWithTexture(tex.clone(), opts);
}
