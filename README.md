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

## Build Log 2 (completed)
### Dice roller with dice notation

Built the animated dice roller and notation box from the Build Queue spec. Reuses the dice-notation parser logic the user supplied from QSheet, adapted into `script.js` (not stored as its own file).

- [x] `index.html`: dice button (`#diceFab`, bottom-left) and a bottom tray (`#diceTray`) containing the stage canvas, total, roll text, notation box, die buttons, modifier, ADV/DIS/Clear, preview, ROLL, and history.
- [x] `styles.css`: new "Dice Roller" section. Tray slides up from the bottom (z-index 1090, above the map, below the sidebar). Stage is 230px tall with a 44px strip kept clear for the total.
- [x] `script.js`: new self-contained `(function () { ... })()` block before the final `window.onclick` line. No existing map, token or calibration code was changed.
- [x] Engine: `rollDice(expr)` supports `NdS`, `d%`, `kh/kl/dh/dl`, `+ - * /`, parentheses and decimals. Every die is rolled with `crypto.getRandomValues` and rejection sampling (`randInt`). Returns `{ total, text, dice }` with each die's sides, value and kept/dropped flag. Limits: 20 dice per term, 50 per roll, 2 to 1000 sides. Plain-English error messages (`niceError`).
- [x] Notation box is the source of truth. Die buttons (d2, d4, d6, d8, d10, d12, d20, d30, d100, dX) edit it: tapping a die you already have increments its count, otherwise appends `+1dS`. dX uses a prompt for 2 to 1000 sides. ROLL is disabled while the expression is empty or invalid, and the error shows live.
- [x] Modifier (-99 to +99) is added at roll time. ADV/DIS roll `2d20kh1` / `2d20kl1` and are enabled only when the box is exactly one d20.
- [x] Visuals: canvas-drawn dice with a distinct shape and color per type (d2 coin, d4 triangle, d6 rounded square, d8 diamond, d10/d100 kite, d12 pentagon, d20 hexagon with inner triangle, d30 and other sizes hexagon). Tumble with hops, flips and flickering numbers for about 1.2 seconds, then land with a pop. Dropped dice are dimmed. Up to 12 dice are animated; the rest appear as small chips. Kept d20 natural 20 gets a gold glow, particle burst, ring and stage flash with a gold total; natural 1 gets a red version. Reduced-motion devices get an instant result.
- [x] History: last 10 rolls in `localStorage` key `vttDiceHistory`, with Clear History.
- [x] Opening the tray also minimizes the sidebar so they do not overlap.
- [x] Cache-bust bumped: styles.css?v=1→2, script.js?v=1→2.

**Bugs found and fixed during verification:**
- [x] Non-ASCII characters (the `···` rolling placeholder and the `×` / `÷` signs in roll text) rendered as garbage (`Â·`) because `index.html` has no charset declaration and `script.js` is now a separate file. Fixed by writing them as `\u` escapes in `script.js` so the app no longer depends on server or file encoding. Checks added for both signs.
- [x] The big total overlapped the top-right die when many dice were rolled. Fixed by reserving a 44px strip at the top of the stage and raising the stage height from 200px to 230px.
- [x] `doRoll` was rolling once to validate and again to roll. Removed the first roll; validity is already guaranteed by the disabled ROLL button.

**Verification:** Playwright (Chromium, phone viewport 390x844, plus 360x640), 73 checks, all pass, zero JS errors.
- Parser through the UI: precedence, parentheses, decimals, spaces and capitals, `d%`, and every error and limit message (`/0`, `1d1`, `1d1001`, 21 dice in a term, 51 in a roll, `2d6kh3`, `3d6 4`, trailing operator, 0 dice). 300 keep/drop rolls (`4d6dl1`, `2d20kh1`, `2d20kl1`, `4d6dh2`, `3d6kh2`) checked against their dice with zero mismatches.
- Randomness: thousands of rolls through the real ROLL button for d2, d6, d20, d30 and d100. Every face appeared, nothing out of range, chi-square well under the p=0.001 limit for each.
- UI: tray open/close, die-button editing (including d1/d10/d100 not colliding), dX accept and reject, modifier clamping at +/-99, ADV/DIS enable rules and math with forced dice values, nat 20 (gold) and nat 1 (red) via forced `crypto.getRandomValues` in the test harness, 20d6 showing 8 extra chips, Enter key, history cap of 10, survives reload, clears and stays cleared.
- Regression: Build Log 1 checks (splash fade, sidebar, tabs, 10 swatches, canvas size) still pass. Screenshots reviewed for each die shape, the dimmed dropped dice, bursts, and the small-phone layout.
- **Not verified here:** touch feel and animation smoothness on a real phone. Gold/red effects were checked in screenshots, not by eye in motion. Needs a real-device check.

## Build Log 3 (completed)
### Fix: dice button and tray off the bottom of the screen on Android Chrome

Reported on Android Chrome: the dice button could not be seen. Cause: the button and tray were positioned against `#map-container`, which is `height: 100vh`. On Android Chrome `100vh` includes the area behind the address bar and bottom toolbar, so the container is taller than the visible screen and anything pinned to its bottom edge lands off-screen.

- [x] `styles.css`: `.dice-fab` changed from `position: absolute` to `position: fixed`, so it anchors to the visible screen.
- [x] `styles.css`: `#diceTray` changed from `position: absolute` to `position: fixed`, and `max-height: 86vh` now has a `max-height: 86dvh` line after it (browsers without `dvh` keep the `vh` value).
- [x] Existing map layout (`#map-container`, the canvas, the hamburger) was not touched.
- [x] Cache-bust bumped: styles.css?v=2→3 (script.js and index.html markup unchanged).

**Verification:** reproduced first. Playwright with a simulated Android toolbar (container 120px taller than the visible screen) put the dice button 61px below the visible screen, and the tray and ROLL button also off-screen, at 412x780, 360x600 and 780x360. After the fix, the dice button and tray are fully on screen at all three sizes. Targeted re-check at 412x700 (8 checks, zero JS errors): new stylesheet version served, button on screen, tray on screen, ROLL on screen, a roll still works, tray closes, button still on screen after closing, hamburger sidebar still opens.
- **Known limitation, not changed:** below about 700px of visible height (for example 360x600) the tray's content is taller than the tray, so ROLL is reached by scrolling inside the tray. At 412x700 and taller, ROLL is visible without scrolling.
- **Needs a real-device check:** the simulation reproduces the symptom, but the real Chrome toolbar behavior should be confirmed on the phone.

## Build Queue

_Empty — nothing queued right now._

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