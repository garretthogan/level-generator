# BSP Dungeon Generator

Procedural 2D dungeon and arena layout generator with a 2D step-through view, 3D preview (Three.js), and GLB export. Built with vanilla JS (ES modules) and Vite.

---

## Architecture

### Entry and shell

- **`src/main.js`** — Boots the app: loads design-system and styles, calls `initApp()`, `initArenaApp()` (lazy when switching to Arena), and wires the **tab shell** (Dungeon / Arena / Gallery). Handles view switching, moves parameter panels between generator and gallery, and listens for `gallery-back-to-generator` and `gallery-open-2d` to return from gallery or open a specific layout in the 2D generator.
- **`index.html`** — Single-page layout: generator viewport (dungeon + arena canvases), gallery grid, controls area with tabs and actions, parameter panels, and a fullscreen 3D preview overlay.

### Generator modes

| Mode      | Entry           | Config / algorithm                         | 2D renderer        |
|----------|------------------|---------------------------------------------|--------------------|
| **Dungeon** | `src/app.js`     | `bsp/config.js` + `bsp/generate.js` (BSP)  | `src/renderer.js`  |
| **Arena**   | `src/arena-app.js` | `arena/arena-config.js` + `arena/arena-generator.js` | `src/arena-renderer.js` |

- **Dungeon (BSP)**  
  - **`bsp/generate.js`** — Single run produces a list of **steps**: partition (BSP tree splits), room placement, corridor connection, exit stubs. Steps are used for both 2D debug view and 3D mesh build.  
  - **`bsp/config.js`** — Defaults (dungeon size, max depth, min partition/room sizes, padding, corridor/exit width, seed).  
  - **`bsp/random.js`** — Seeded RNG for reproducible layouts.

- **Arena**  
  - **`arena/arena-generator.js`** — Grid-based: wall density, flood-fill regions, buildings, connectivity and exits. Returns a single **arena result** (grid + metadata), no step list.  
  - **`arena/arena-config.js`** — Defaults (cols, rows, density, building count/sizes, smoothing, corridor/exit width, candidates).

### Shared layer

- **`shared/config-dom.js`** — Single source of truth for parameters: **`DUNGEON_PARAM_SPEC`** and **`ARENA_PARAM_SPEC`** (input ids, keys, defaults, parse/display). **`readConfigFromDOM`** / **`syncConfigFromDOM`** read or sync config from the DOM; **`buildParamsFromSpec`** / **`bindParamInputs`** build and bind param UI. Used by dungeon app, arena app, and gallery.
- **`shared/canvas-pan-zoom.js`** — **`wirePanZoom(canvas, camera, draw)`** for pan and zoom on the 2D canvas; camera is `{ panX, panY, zoom }`, `draw` is called on interaction/resize.

### 2D rendering

- **`renderer.js`** — **`createRenderer(canvas)`** renders dungeon **steps** for a given `stepIndex`: boundary, split lines, rooms, corridors, exits, spawn marker. Uses a fixed palette and cell-based scaling; respects camera pan/zoom.
- **`arena-renderer.js`** — **`createArenaRenderer(canvas)`** renders the arena **result** (grid, regions, buildings, exits) with pan/zoom.

### 3D preview and export

- **`preview/coordinator.js`** — **`openPreview(payload, returnToOverride)`** / **`closePreview()`**. Payload is either `{ type: 'dungeon', config, steps }` or `{ type: 'arena', arenaResult }`. Shows fullscreen overlay, runs the correct preview (dungeon vs arena), stores a destroy callback and `returnTo` (dungeon / arena / gallery) for the back button.
- **`preview/run-preview.js`** — Dungeon 3D scene: builds meshes from steps, OrbitControls + pointer-lock option, resize, back button.
- **`preview/run-arena-preview.js`** — Arena 3D scene from `arenaResult`.
- **`preview/dungeon-mesh.js`** / **`preview/arena-mesh.js`** — Build Three.js geometry (floors, walls) from steps or arena result; shared by preview and export.
- **`preview/player.js`** — Shared first-person / pointer-lock behavior if used by previews.
- **`export-glb.js`** — **`exportDungeonAsGLB(config, steps)`** and **`exportArenaAsGLB(arenaResult)`** use the same mesh builders (geometry only, no lights), then **GLTFExporter** (binary) and trigger download.

### Gallery

- **`gallery/gallery-app.js`** — **`initGalleryApp()`**: Dungeon vs Arena type, count (1–20), “Generate” builds thumbnails and fills the grid. Cards dispatch **`gallery-open-2d`** with `{ type, config, steps }` or `{ type, arenaResult }`; main.js switches tab and fires **`gallery-load-dungeon`** / **`gallery-load-arena`** so the generator shows that layout.
- **`gallery/thumbnail.js`** — **`generateDungeonThumbnail(config)`** / **`generateArenaThumbnail(options)`** return small canvas data URLs (and config/steps/arenaResult) for gallery cards.

### Data flow (high level)

- **Dungeon:** `config` + `generateDungeon(config)` → `steps` → 2D renderer (step index) and 3D/export (full steps).
- **Arena:** `options` + `generateArena(options)` → `arenaResult` → 2D renderer and 3D/export.
- **Gallery:** DOM config → thumbnail generators → grid; click → `gallery-open-2d` → generator tab + `gallery-load-dungeon` / `gallery-load-arena` with that config/result.

---

## UX

### Tabs and views

- **Dungeon** — 2D dungeon canvas, dungeon params, Generate / Debug / Preview / Export GLB. Status and step info. Debug panel appears when stepping or playing (Step, Play, Pause, speed).
- **Arena** — 2D arena canvas, arena params, Generate / Preview / Export GLB. Status. Params panel is collapsible.
- **Gallery** — Type (Dungeon / Arena), count (1–20), Generate. Grid of thumbnail cards; click a card to open that layout in the 2D generator (Dungeon or Arena tab) with that config/result loaded. “Back to generator” returns to the Dungeon tab.

View state is driven by the shell in `main.js`: which viewport/gallery is visible, which tab is selected, and where the parameter panels live (generator vs gallery). The 3D preview is a fullscreen overlay; closing it returns to the previous tab (or gallery) and restores focus.

### Dungeon interaction

- **Generate** — New seed (current + 1), instant full generation, final step shown; status “Complete — N steps”.
- **Debug** — New seed, full generation, then step index 0; status shows phase and “Step 1 / N”. **Step** advances; **Play** / **Pause** auto-advance at selected speed (1–4). Keyboard: **Space** (step or start debug or pause), **G** (instant generate), **P** (play/pause).
- **Preview** — Opens 3D overlay with current dungeon; back button closes and returns focus.
- **Export GLB** — Downloads current dungeon as binary GLB (geometry only).
- Pan/zoom on the 2D canvas (shared helper). Params and controls panels are collapsible; during debug, param inputs are disabled.

### Arena interaction

- **Generate** — One-shot generation; status “Ready”; Preview and Export GLB enabled.
- **Preview** / **Export GLB** — Same pattern as dungeon (3D overlay, GLB download).
- Pan/zoom on arena canvas. No step-through; single result.

### Gallery interaction

- Choose Dungeon or Arena; set count; **Generate** — Builds up to 20 thumbnails, shows “Ready (N items)”.
- Click card — Opens 2D generator in the right tab with that layout loaded (dungeon config + steps or arena result).
- **Back to generator** — Returns to Dungeon tab.

### Accessibility and feedback

- Tab list and tabpanels use `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-hidden`, `aria-expanded` for panels.
- Status and gallery status use `aria-live="polite"`.
- Buttons have `title`/labels; primary actions are clearly indicated. Focus is restored when leaving 3D preview or switching tabs (e.g. Generate or Preview button).

---

## Scripts

- **`npm run dev`** — Vite dev server.
- **`npm run build`** — Production build (output in `dist/`).
- **`npm run preview`** — Local preview of production build.

## Deploy (GitHub Pages)

- The repo is set up to deploy the Vite build via GitHub Actions. In the repo **Settings → Pages**, set the source to **GitHub Actions**. The workflow builds and deploys on push to `main` or via **Actions → Deploy to GitHub Pages → Run workflow**. The site is served at `https://<user>.github.io/bsp-dungeons/` (see `vite.config.js` `base` if the repo name differs).
