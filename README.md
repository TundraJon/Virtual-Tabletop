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

## Build Log 4 (completed)
### Advanced dice notation, percentile dice, and advantage on any die

Built Build Queue item A (the notation engine and ADV/DIS upgrade) in `script.js`. The keypad (Expression Builder) is a separate item and is still queued.

- [x] Groups: `(a, b)kh1` and `{a, b}kh1` (parentheses and braces interchangeable) with comma-separated items; `kh`, `kl`, `dh`, `dl` with an optional count (default 1). Dice in a dropped item are flagged dropped. Errors with hints for a comma outside a group, a group with commas and no suffix, and a keep/drop suffix on a group with no commas (for example `(1d8+1d6)kh`).
- [x] Shorthand: `k` / `kN` (keep highest) and `dN` (drop lowest N).
- [x] Exploding dice `!`, up to 20 extra dice per term (extras do not count toward the 50-dice limit); keep/drop applies across all of a term's dice. Error on d100.
- [x] `minN` / `maxN` clamps on dice terms and groups, chainable (`(d8,d6)kh1min7`).
- [x] Percentile: `d100` and `d%` roll a tens die (00 to 90) and a ones die (0 to 9); `00`+`0` is 100. `d100b` / `d100bN` (bonus) and `d100p` / `d100pN` (penalty): one ones die, extra tens dice, keep the lowest (bonus) or highest (penalty) result. Single d100 only, 1 to 10 extra dice. `2d100kh1` is true advantage.
- [x] Engine returns each die with `sides`, `value`, `kept`, and for percentile `kind` (`tens` or `ones`) and for explosions `extra`. New `rollDice(expr, dry)`; validation (live error line, button states) now uses a dry run that rolls every die as 1 and uses no randomness.
- [x] Display: each d100 draws two dice (tens in the d100 color with labels `00` to `90`, ones in the d10 color); dropped dice, including dice in dropped group items and dropped bonus/penalty tens dice, are dimmed; new `dieLabel` and updated rolling flicker for tens/ones dice.
- [x] ADV / DIS now work on any die or term: they convert the dice term at the cursor (`d6` → `2d6kh1`, `2d6` → `(2d6, 2d6)kh1`, a whole group becomes `(group, group)kh1`); a lone die in the box (any size, including d100) rolls the advantage version immediately and leaves the box unchanged. Disabled when the cursor is not on a dice term. New helpers `termAt`, `advText`, `advDis`; the buttons re-check on cursor movement.
- [x] `niceError` now shows the engine's message and hint for new errors.
- [x] Cache-bust bumped: script.js?v=2→3 (styles.css unchanged at v=3).

**Verification:** Playwright (Chromium, 412x800) with forced dice values for exact results, 69 checks, all pass, zero JS errors, about 55 seconds.
- Groups (keep/drop with commas and braces, default count, `(1d8,1d6,1d4)dh1`, `2d20kh1 + (d8, d6)kh1 + 2` = 17), shorthand, and every new error message.
- Percentile: `20`+`4` = 24, `00`+`5` = 5, `00`+`0` = 100, `d%`, bonus (tens 50 and 20, ones 4 gives 24), penalty (gives 54), bonus with ones 0 and tens `00` and 30 gives 30, two bonus dice, `2d100kh1`, the errors. Over thousands of real rolls, `d100` covers all 100 values with chi-square inside the limit, and bonus and penalty averages land where expected (about 40 and 61).
- Exploding (8 then 3 = 11, no explosion = 4, the 20-extra cap = 168, inside a group), clamps (floor, ceiling, braces, chained, error on a number).
- ADV/DIS on terms at the cursor (`d6+2d4`, after the `+`, `2d6`, a group, `4d6kh3`), disabled cases, a lone d6 / d100 / d20 rolling immediately.
- Earlier behavior re-checked where touched: 60 rolls of `4d6dl1`, `2d20kh1`, `2d20kl1`, limits, `3d`, `/0`, `1d1`, the `×` sign. Screenshots reviewed for the percentile pair, a dropped group item, an explosion and a bonus roll with dropped tens dice.
- **Not verified here:** ADV/DIS follow the cursor through `selectionchange`; tapping inside the box on Android Chrome should be checked on the phone.
- **Known, not changed:** the old die buttons (replaced by the keypad later) increment the first matching term, so tapping d100 while the box holds `d100b` makes `2d100b`, which shows the single-d100 error.

## Build Queue

### Expression Builder (on-screen keypad for the dice notation box)

**Not yet authorized to build.** The notation it builds is already in place (Build Log 4).

Replaces the current die-button grid in the dice tray with a keypad that builds the expression in the notation box without the phone keyboard. Calculator-style: every key inserts exactly what it says.

- [ ] **Dice keys (top):** d2, d4, d6, d8, d10, d12, d20, d30, d100, plus a `d` key. They insert `d2`, `d4`, ... `d100`, and `d`. Tapping `2` then `d6` gives `2d6`; `d6` alone gives `d6` (one die). Custom dice come from the `d` key plus digits (`1`, `d`, `7`).
- [ ] **Digit keys:** 1 2 3 4 5 6 7 8 9 0.
- [ ] **Operator keys:** `+`, `-`, `×`, `÷`, `(`, `)`. Multiply and divide show `×` and `÷` but insert `*` and `/`. Labels are HTML entities in the markup so they do not depend on file encoding.
- [ ] **Notation keys:** `,` (group separator), `!` (explode), `B` and `P` (insert `b` and `p`, for bonus/penalty percentile dice), `MIN` and `MAX` (insert `min` and `max`).
- [ ] **Keep/drop keys:** KH, KL, DH, DL (insert `kh`, `kl`, `dh`, `dl`).
- [ ] **Quick button:** a full-width `4D6KH3` button that inserts `4d6kh3` at the cursor (no outer parentheses).
- [ ] **DEL key:** deletes the selection, or the character before the cursor.
- [ ] **Insertion point:** keys insert at the cursor (replacing any selected text) and leave the cursor right after the inserted text. Tapping inside the box moves the cursor.
- [ ] **Keyboard:** the box uses `inputmode="none"` so the phone keyboard does not pop up. A small keyboard-icon button beside the box (inline SVG) toggles the real keyboard on and off (`inputmode` `none` and `text`).
- [ ] **Replaces the old grid:** the old die button grid (`#dicePad`), its tap-to-add-or-increment behavior (`addDie`) and the dX prompt are removed. Custom dice use the `d` key.
- [ ] **Unchanged:** Clear, the modifier -/+ field, ADV/DIS (behavior as in Build Log 4), the notation engine, limits, animation, and history.
- [ ] **ROLL button stays reachable:** the keypad makes the tray taller than most phone screens, so ROLL becomes sticky at the bottom of the tray. *(Added by Claude as a design necessity. Change before authorizing if wanted.)*
- [ ] **Live error message is delayed:** partial expressions like `3d` are invalid while building, so the red error message appears only after 700 ms with no key presses. ROLL still disables immediately, and the message clears as soon as the expression is valid. *(Added by Claude. Change before authorizing if wanted.)*
- [ ] **Expression box stays pinned:** the notation box, its error/preview line and the keyboard-toggle button are pinned (sticky) at the top of the tray under the header, so what you are building stays visible while the keys scroll underneath. Costs about 70px of screen. (Decided with the user.)
- [ ] **Stage shrinks:** the dice stage height drops from 230px to about 150px while the keypad is shown, to give the keys more room. (Decided with the user. Exact height to be tuned on the phone.)
- [ ] **Easy to resize later:** key height, key gap and column counts are set through CSS custom properties (for example `--key-h`, `--key-gap`) in one place, so tightening the keys is a one-line change. The user expects to shrink the keys after seeing the first build (their phone keyboard has 10 keys across); the 32 x 32 px minimum stays unless they say otherwise.
- [ ] **Key size (hard minimum):** every key is at least 32 x 32 CSS px. Target is 38 to 40px tall; widths come from the grid (about 62px with 5 columns and about 50px with 6 columns on a 360px-wide phone). The verification check measures every key's rendered size at 360px and 412px wide and fails the build if any key is under 32 x 32.
- [ ] **Layout:** compact keys in a grid: two dice rows (d2 to d10, then d12, d20, d30, d100 and `d`), two digit rows (1 to 5, 6 to 0), an operator row (`+ − × ÷ ( )`), a notation row (`, ! B P MIN MAX`), a keep/drop row (KH KL DH DL DEL), and the quick button row. Risk: this is a tall keypad; the tray scrolls and ROLL stays sticky. Check on the phone.
- [ ] **Files:** markup in `index.html`, styles in `styles.css`, logic in `script.js`. Cache-bust: styles.css?v=3→4, script.js?v=3→4.

Verification plan (targeted, about 1 to 2 minutes): every key renders at least 32 x 32 px at 360px and 412px wide; key sequences produce the exact expected strings (`2`,`d6` → `2d6`; `4`,`d6`,`DL`,`1` → `4d6dl1`; `1`,`d`,`7` → `1d7`; `(`,`d8`,`,`,`d6`,`)`,`KH` → `(d8,d6)kh`; `d100`,`B` → `d100b`; the quick button; operator keys insert `* / + - ( )`); insertion in the middle of a string and replacing a selection; DEL on a character and on a selection; the keyboard toggle flips `inputmode`; a keypad-built expression rolls correctly; the delayed error message (hidden right after a key press, shown after the pause); old dX prompt and grid are gone; ROLL visible at 412x700 and 360x600; zero JS errors; a screenshot. **Needs a real-device check:** that `inputmode="none"` really suppresses the keyboard on Android Chrome, cursor behavior when tapping in the box, and key tap size and feel.

## Build Planner

Resolved, built, dropped, or superseded items are deleted from this section. Their history lives in the Build Log.

All items below are ideas only. None are designed, queued or authorized to build. Priority order is still to be decided.

### Known gaps in the current app

- **Mouse / desktop input:** the canvas only listens for touch events, so token placement, dragging, panning and zoom do nothing with a mouse. Open question: also add wheel zoom?
- **Save and restore:** a reload wipes tokens, calibration and the selected map; only the folder names are remembered. Open questions: autosave to localStorage, export/import as a file, or both? Map and token images are blob URLs and can't be saved directly.
- **Feet-per-square stored as a string:** `grid.ftPerSq = this.value` stores text, not a number. Distance math currently works by coercion. Log only; fix if/when authorized.
- **Undo:** no way to undo a token move, delete or HP change.
- **CLAUDE.md cache-busting note is out of date:** it still says "Currently N/A: the app is a single self-contained `index.html`." Since Build Log 1 the app is split into `index.html`, `styles.css` and `script.js`, so cache-busting applies and is being followed. Log only; update the note if/when authorized.

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

### Dice notation, later phases

- **Rerolls and target pools:** `r` / `ro` (reroll once), `>X` and `<X` (count successes instead of summing), `fX` (failures subtract). These change what a roll means (a success count, not a total), so they need their own design. Open questions: how a success count is displayed, and the exact reroll syntax (`r1`, `r<=2`).
- **Game presets:** one-tap buttons for common system rolls (Lancer Accuracy, Call of Cthulhu bonus/penalty, Savage Worlds trait + Wild Die, 4d6kh3 stat roll beyond the keypad quick button). Open questions: where they live (keypad, a menu, or user-defined), and whether users can save their own.
- **Success checks:** compare a roll to a skill or target (CoC hard/extreme success and fumbles, Savage Worlds target 4 and raises) and show the outcome. Open question: where the skill or target number is entered.

### Requested by Jon

- **Character sheets:** basic character-sheet panels that expand up from the bottom of the screen. Open questions: system-agnostic fields or a template per game? Linked to map tokens?