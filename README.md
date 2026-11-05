# Virtual-Tabletop
Micro virtual tabletop with lots of extras

## Build Log

## Build Log 1 (completed)
### Split index.html into HTML, CSS and JS (pure move)

Split the single-file app into three files so each part can be worked on separately. No behavior, markup, style or logic changes. `keep.html` remains the untouched single-file backup.

- [x] `styles.css`: new file, the exact contents of the former `<style>` block, moved verbatim.
- [x] `script.js`: new file, the exact contents of the former `<script>` block, moved verbatim (including the final `init();` call).
- [x] `index.html`: `<style>` block replaced by `<link rel="stylesheet" href="styles.css?v=1">` in the head; `<script>` block replaced by `<script src="script.js?v=1"></script>` in the same spot at the bottom of `<body>`. All other markup untouched.
- [x] Cache-bust started: `styles.css?v=1`, `script.js?v=1`.

**Verification:** a script that stitches `styles.css` and `script.js` back into `index.html` produced a result identical to `keep.html`. Playwright (Chromium, served locally) loaded `keep.html` and `index.html` side by side and compared the results: zero JS errors on both; all three files returned 200; splash fades to opacity 0; sidebar opens from the hamburger; Map and Help tabs switch; body background `rgb(17, 17, 17)`; 10 color swatches; canvas sized to the viewport. Screenshots of the two pages are identical. **Not verified here:** touch gestures (long-press to add a token, drag, pinch-zoom), folder loading and the calibration flow. These need a real-device check.

## Build Queue

### Dice roller

**Not yet authorized to build.**

An animated dice roller that slides up from the bottom of the map screen. Offline, no libraries.

- [ ] **Dice:** d2, d4, d6, d8, d10, d12, d20, d30, d100, plus a custom "dX" (user enters sides, 2 to 1000). d10 is 1 to 10. d100 is a single die, 1 to 100.
- [ ] **Entry point:** a dice button on the map screen (bottom-left, so it doesn't collide with the hamburger at top-right). Tapping it opens a tray that slides up from the bottom, with a close button. Tray sits above the map and below the sidebar.
- [ ] **Pool:** tapping a die type adds it to the pool; the pool shows as chips (e.g. 2d6, 1d20) and tapping a chip removes one of that die. A Clear button empties it. Cap of 10 dice total.
- [ ] **Modifier:** integer from -99 to +99, added to the total.
- [ ] **Advantage / disadvantage:** ADV and DIS toggles, enabled only when the pool is exactly one d20. Rolls two d20, keeps the higher (ADV) or lower (DIS), and shows the discarded die dimmed. *(Scope detail chosen by Claude. Change before authorizing if wanted.)*
- [ ] **Rolling:** a ROLL button. Each result is chosen first with `crypto.getRandomValues` (rejection sampling, so no modulo bias), then the animation lands on it, so the animation cannot skew a roll.
- [ ] **Visuals:** dice drawn on canvas as polyhedron silhouettes (d2 as a coin, d4 triangle, d6 square, d8 diamond, d10/d100 kite-style, d12 pentagon, d20 triangle-in-hexagon, d30 and custom as a hexagon). They tumble and spin for about 1.2 seconds, then settle on the number. Total shown large. Natural 20 on a d20 gets a gold glow and particle burst; natural 1 gets a red flash. Animation is skipped (instant result) when the device prefers reduced motion.
- [ ] **No sound, no vibration.**
- [ ] **History:** last 10 rolls (pool, modifier, individual dice, total, time) listed in the tray. Saved to `localStorage` so it survives a reload. A Clear History button.
- [ ] **Files:** markup in `index.html`, styles in `styles.css`, logic in `script.js`. Cache-bust bumped for each file changed, logged before and after.
- [ ] No changes to existing map, token or calibration behavior.

Verification plan: Playwright for zero JS errors; open and close the tray; pool add, remove, clear and the 10-dice cap; modifier limits; ADV/DIS enable rules and keep-higher/lower math; custom dX bounds; RNG distribution check over thousands of rolls per die (all faces reachable, roughly uniform); history capped at 10 and persisted across reload; screenshots of each die and the 20/1 effects; re-run the Build Log 1 checks as a regression. **Needs a real-device check:** touch feel and animation smoothness on a phone.

## Build Planner

Resolved, built, dropped, or superseded items are deleted from this section. Their history lives in the Build Log.

All items below are ideas only. None are designed, queued or authorized to build. Priority order is still to be decided.

### Known gaps in the current app

- **Mouse / desktop input:** the canvas only listens for touch events, so token placement, dragging, panning and zoom do nothing with a mouse. Open question: also add wheel zoom?
- **Save and restore:** a reload wipes tokens, calibration and the selected map; only the folder names are remembered. Open questions: autosave to localStorage, export/import as a file, or both? Map and token images are blob URLs and can't be saved directly.
- **Feet-per-square stored as a string:** `grid.ftPerSq = this.value` stores text, not a number. Distance math currently works by coercion. Log only; fix if/when authorized.
- **Undo:** no way to undo a token move, delete or HP change.

### Table features other VTTs do well

- **Initiative tracker:** turn order, current-turn highlight, round counter. Open questions: manual entry or built-in roll? Tied to tokens?
- **Conditions / status icons:** icons on tokens (stunned, prone, etc.). Open question: fixed list or user-defined?
- **Fog of war:** GM reveals the map as players explore. Open questions: paint-to-reveal, grid-cell reveal, or both?
- **Area templates:** cone, circle, line and cube overlays for spells and effects, snapped to the grid.

### Innovative ideas

- **True-size mode:** calibrate to the physical screen so one square equals exactly 1 inch, letting a tablet laid flat serve as a map for physical minis. Open question: how to calibrate (known device size, or a measure-with-a-ruler step)?
- **Custom token stats:** replace the fixed HP bar with user-defined bars (stamina, morale, armor, etc.), keeping the app system-agnostic and suited to custom combat systems. Open questions: how many bars, and how are they defined?
- **Player view:** a second screen (TV or tablet) shows the map and fog while the phone keeps the GM controls. Open question: how to link the screens with no server?
- **Encounter presets:** save a map with its tokens, positions and HP as one file and reload it in one tap. Likely shares work with save and restore.
- **Waypoint ruler:** measure a path with turns, and mark difficult terrain that costs extra movement.
- **Installable offline app:** make it a PWA, then wrap it for Google Play. Needs the HTML/CSS/JS split (done) and a manifest and service worker.

### Requested by Jon

- **Character sheets:** basic character-sheet panels that expand up from the bottom of the screen. Open questions: system-agnostic fields or a template per game? Linked to map tokens?