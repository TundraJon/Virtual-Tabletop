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

Build the two items below in this order (A, then B), so the keypad gets the final key set.

### A. Advanced dice notation, percentile dice, and advantage on any die

**Not yet authorized to build.**

Upgrades the notation engine in `script.js` and the dice display. No keypad work (that is item B). The existing notation (`NdS`, `d%`, `kh kl dh dl`, `+ - * /`, parentheses, limits) keeps working unchanged.

- [ ] **Groups with a comma:** `(a, b)kh1` or `{a, b}kh1` (parentheses and braces are interchangeable). Items are separated by top-level commas; each item is any expression and counts as one value (its total). A suffix `kh`, `kl`, `dh` or `dl` with an optional number (default 1, at most the number of items) keeps or drops items, and the group's value is the sum of the kept items. Examples: `(1d8, 1d6)kh` keeps the higher of the two; `2d20kh1 + (d8, d6)kh1 + 2`. Plain parentheses with no commas and no suffix stay ordinary math. A comma outside a group with a keep/drop suffix, or a keep/drop suffix on a group with no commas (for example `(1d8+1d6)kh`), is an error with a plain-English hint such as "use (1d8,1d6)kh1".
- [ ] **Shorthand:** `k` alone means `kh1`; `kN` means `khN`; `dN` (digits required) after a dice term or group means drop lowest N (`dlN`). `d` followed by nothing is not valid as a modifier.
- [ ] **Exploding dice `!`:** `1d8!` rolls again on a maximum and adds; the extra dice are rolled in a chain. At most 20 extra dice per term (extras do not count toward the 50-dice limit). The term's value includes all extra dice. Keep/drop on the same term applies after explosions, across all its dice (`4d6!kh3`). Not allowed on d100 / `d%` (error). Works inside group items, so Savage Worlds is `(1d8!, 1d6!)kh`.
- [ ] **min / max:** a suffix `minN` or `maxN` on a dice term or a group clamps its result: `min5` sets a floor of 5, `max8` a ceiling of 8 (`{1d10+3}min5`: a result under 5 counts as 5). A group with min/max and no commas is ordinary math inside, then clamped. Suffixes chain left to right (`(d8, d6)kh1min2`).
- [ ] **Percentile dice:** `d100` and `d%` always roll two dice, a tens die (00, 10, ... 90) and a ones die (0 to 9). The result is tens plus ones, and `00` with `0` counts as 100. Each d100 counts as 1 die toward the 20-per-term and 50-per-roll limits. Percentile dice work inside groups and with kh/kl/dh/dl (`2d100kh1` is true advantage: two full rolls).
- [ ] **Bonus and penalty dice (Call of Cthulhu 7e):** `d100b` adds one bonus die, `d100b2` adds two; `d100p` and `d100p2` add penalty dice. The ones die is rolled once, each extra tens die is rolled separately, and each tens die is paired with the ones die (`00`+`0` = 100). Bonus keeps the lowest result, penalty keeps the highest. Example: tens 50 and 20, ones 4 gives 24 (the 50 is dropped). Only on a single d100 (`2d100b` is an error).
- [ ] **Result text:** group: `(1d8[3], 1d6[5])kh1[(3),5] = 5` (dropped item totals in parentheses); percentile: `1d100[tens 20, ones 4] = 24`; bonus: `1d100b[tens (50),20; ones 4] = 24`; exploding: `1d8![8,3] = 11`; clamp: `(1d10[2] + 3)min5 = 5`.
- [ ] **Per-die results for the animation:** the engine returns every die with its sides, value, and kept/dropped flag. Dice inside a dropped group item, and dropped bonus/penalty tens dice, are flagged dropped. Percentile dice carry their role (tens or ones). Exploded extras are flagged as extras.
- [ ] **Percentile display:** each d100 shows two dice. The tens die uses the d100 color, a kite shape, and labels `00` to `90`; the ones die uses the d10 color and labels `0` to `9`. Dropped dice are dimmed as today. The 12-dice animation limit counts individual dice (a d100 is 2).
- [ ] **ADV / DIS on any die or term:** the buttons convert the dice term at the cursor (the term the cursor is in or right after, including its modifiers; a whole `( ... )` group counts as one term). A single die `1dN` or `dN` becomes `2dNkh1` (ADV) or `2dNkl1` (DIS), including d100. Any other term `T` becomes `(T, T)kh1` or `(T, T)kl1`, for example `2d6` becomes `(2d6, 2d6)kh1`. So `d6 advantage + 2d4` is `2d6kh1+2d4`. They are disabled when there is no dice term at the cursor.
- [ ] **One-tap shortcut kept:** when the box holds exactly one die (`d6`, `1d20`, `d100`, any size), ADV or DIS rolls the advantage version immediately and leaves the box unchanged, as it does now for a lone d20. Otherwise ADV/DIS edit the box and do not roll.
- [ ] **Limits and errors:** existing limits unchanged (20 dice per term, 50 per roll, 2 to 1000 sides). New error messages in the same plain-English style, shown live in the existing error line.
- [ ] **Files:** `script.js` only (engine, ADV/DIS logic, dice drawing); `index.html` and `styles.css` unchanged unless a label tweak is needed. Cache-bust: script.js?v=2→3.
- [ ] Out of scope here: rerolls (`r`, `ro`), target-count pools (`>X`, `<X`, `fX`), success/failure checks, game presets, and all keypad work (see Planner and item B).

Verification plan (targeted, about 2 minutes), using the forced-random test harness for exact values: group keep-higher/lower/drop with commas and braces, default count, the two error cases, shorthand `k` / `kN` / `dN`; percentile pair math (tens 50 and 20 with ones 4 and bonus gives 24; penalty gives 54; `00`+`0` is 100; bonus with ones 0 and tens 00 and 30 gives 30); `d100` range and distribution over a few thousand rolls; exploding (forced 8 then 3 on a d8 gives 11; the 20-extra cap; error on d100); min/max clamps and chaining; ADV/DIS conversions at the cursor (`d6+2d4` cursor on d6 gives `2d6kh1+2d4`; `2d6` gives `(2d6,2d6)kh1`; single-die box rolls immediately; disabled with no term); existing `4d6dl1`, `2d20kh1`, `2d20kl1`, limits still correct; screenshots of the percentile pair, a dropped group item, and an exploded roll; zero JS errors.

### B. Expression Builder (on-screen keypad for the dice notation box)

**Not yet authorized to build.** Build after item A so the keys match the final notation.

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
- [ ] **Unchanged:** Clear, the modifier -/+ field, ADV/DIS (behavior as defined in item A), the notation engine, limits, animation, and history.
- [ ] **ROLL button stays reachable:** the keypad makes the tray taller than most phone screens, so ROLL becomes sticky at the bottom of the tray. *(Added by Claude as a design necessity. Change before authorizing if wanted.)*
- [ ] **Live error message is delayed:** partial expressions like `3d` are invalid while building, so the red error message appears only after 700 ms with no key presses. ROLL still disables immediately, and the message clears as soon as the expression is valid. *(Added by Claude. Change before authorizing if wanted.)*
- [ ] **Key size (hard minimum):** every key is at least 32 x 32 CSS px. Target is 38 to 40px tall; widths come from the grid (about 62px with 5 columns and about 50px with 6 columns on a 360px-wide phone). The verification check measures every key's rendered size at 360px and 412px wide and fails the build if any key is under 32 x 32.
- [ ] **Layout:** compact keys in a grid: two dice rows (d2 to d10, then d12, d20, d30, d100 and `d`), two digit rows (1 to 5, 6 to 0), an operator row (`+ − × ÷ ( )`), a notation row (`, ! B P MIN MAX`), a keep/drop row (KH KL DH DL DEL), and the quick button row. Risk: this is a tall keypad; the tray scrolls and ROLL stays sticky. Check on the phone.
- [ ] **Files:** markup in `index.html`, styles in `styles.css`, logic in `script.js`. Cache-bust: styles.css?v=3→4, script.js?v=3→4 (assuming item A ships first).

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