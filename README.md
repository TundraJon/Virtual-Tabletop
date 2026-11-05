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

## Build Log 5 (completed)
### Percentile tens-dice notation (`d100tN`) and plain-words bonus/penalty text

Added game-neutral notation for rolling several tens dice on a d100, and made bonus/penalty rolls say what they kept. Engine and roll text in `script.js` only.

- [x] `d100tNkl` / `d100tNkh` (also `d%`): N tens dice (2 to 11) with one shared ones die; each tens die is paired with the ones die, compared by final result (`00`+`0` counts as 100), and exactly one is kept. `k` means `kh`; `dh` / `dl` work with N-1; `kl`, `kh` and the drop forms are all accepted.
- [x] `d100b`, `d100bN`, `d100p`, `d100pN` kept as shortcuts and now share the same code path (`b` is `kl`, `p` is `kh`, with N+1 tens dice).
- [x] Roll text says what was kept: `1d100t3kl[tens (50),20,(70) keep lowest; ones 4] = 24`, `... keep highest ...`; also in the history list.
- [x] New errors: single d100 only, `t` with `b`/`p`, `t` with no keep/drop, keeping more than one tens die, N outside 2 to 11, `t` on a non-d100, `t` with no number.
- [x] `termAt` regex recognizes `d100tNkl` as one dice term, so ADV/DIS convert it as a unit.
- [x] Cache-bust bumped: script.js?v=3→4.

**Verification:** Playwright with forced dice values, 40 checks, all pass, zero JS errors, 13 seconds. `d100t2kl` equals `d100b` and `d100t2kh` equals `d100p` for the same dice; three tens dice with 50, 20, 70 and ones 4 give 24 (`kl`) and 74 (`kh`); `00`+`0` case (30 for `kl`, 100 for `kh`); `dh2`, `dl2`, `d1` and `k` forms; `d%`; every new error; plain-words text in the roll text and in history; plain `d100` text unchanged; ADV/DIS on a `d100t3kl` term, alone and inside a sum; 150 random `d100t3kl` rolls where the kept die was always the lowest result and matched the total.

## Build Log 6 (completed)
### Expression Builder (on-screen keypad for the dice notation box)

Replaced the die-button grid with a calculator-style keypad so expressions can be built without the phone keyboard. Each key inserts exactly what it says.

- [x] `index.html`: tray restructured into a pinned top (`#dicePinned`: notation box, keyboard-toggle button `#diceKb`, error line, preview), a scrolling middle (`#diceScroll`: dice stage, roll text, modifier/ADV/DIS/Clear row, keypad `#diceKeys`, caption `#diceKeyHint`, history) and a pinned bottom (`#diceFoot` with ROLL). The box moved above the dice stage. The old `#dicePad` is gone.
- [x] Keys (39): d2, d4, d6, d8, d10, d12, d20, d30, d100 and `d`; digits 1 to 0; `+ − × ÷ ( )` (the multiply and divide keys insert `*` and `/`); `, ! B P T MIN MAX`; KH KL DH DL and DEL; a full-width `4D6KH3` quick key (inserts `4d6kh3`). Caption under the keys explains B, P and T in plain words. Built in `script.js` from a `KEY_ROWS` table.
- [x] Keys insert at the cursor and replace any selected text (`insertText`); DEL removes the selection or the character before the cursor (`backspace`). Keys do not steal focus from the box.
- [x] The box uses `inputmode="none"` so the phone keyboard stays hidden; the keyboard button toggles `inputmode` between `none` and `text`.
- [x] Removed: the old die grid, `addDie` and the dX prompt (custom dice come from the `d` key plus digits). Clear, the modifier field, ADV/DIS, the engine, limits, animation and history are unchanged.
- [x] ROLL is pinned at the bottom of the tray. The notation box and error/preview line are pinned at the top.
- [x] The red error message now appears 700 ms after the last change (`setMsg`); ROLL still disables immediately and the message clears at once when the expression becomes valid.
- [x] Dice stage height 230px → 150px.
- [x] Key sizes come from CSS custom properties on `#diceKeys` (`--key-h: 40px`, `--key-gap: 6px`) and the column counts per row, so tightening them later is a small edit. Hard minimum 32 x 32 px via `min-width: 32px` and `min-height: max(32px, var(--key-h))`.
- [x] Added during the build (not in the spec): pressing ROLL scrolls the keys area back to the top so the dice are in view. Without it, the stage scrolls out of sight while you are using the keys, and a roll would animate off-screen.
- [x] Cache-bust bumped: styles.css?v=3→4, script.js?v=4→5.

**Verification:** Playwright (Chromium), 41 checks, all pass, zero JS errors, 13 seconds.
- Key sizes: all 39 keys measured at 320, 360 and 412px wide, none under 32 x 32 (a 7-key row is the tightest).
- Key sequences produce the exact strings (`2`,`d6` → `2d6`; `4`,`d6`,`DL`,`1` → `4d6dl1`; `1`,`d`,`7` → `1d7`; `(d8,d6)kh`; `d100b`; `d100t3kl`; the quick key; the operator, notation and keep/drop keys; all dice and digit keys). Insert in the middle, selection replaced by a key, DEL on a character, in the middle, at the start (no-op) and on a selection.
- Keyboard toggle flips `inputmode` and `aria-pressed`; keypad-built `2d6+3`, `(d8,d6)kh` and `d100t3kl` roll to the right totals; ADV works on a keypad-built expression; no old grid, no dialogs.
- Delayed error: ROLL disabled at once, message absent at 150 ms, shown after the pause, cleared immediately when valid.
- Layout at 412x700, 360x640 and 412x800: tray inside the screen, ROLL on screen; after scrolling the keys the box and ROLL stay in place and the stage scrolls away; ROLL scrolls back to the top. Screenshots reviewed at 412x700 and 360x640.
- **Needs a real-device check:** that `inputmode="none"` hides the keyboard on Android Chrome, how tapping in the box places the cursor, and key tap size and feel.
- **Known tradeoff:** the keypad is tall, so on a phone you scroll to reach the lower keys and scroll back up to watch a roll (ROLL does this automatically).

## Build Log 7 (completed)
### Keypad tightening: fewer rows, smart die keys

Tightened the Expression Builder keypad (Build Log 6) and brought back "tap a die repeatedly". The notation engine is not touched.

- [x] Key rows in `script.js` (`KEY_ROWS`, 37 keys): (1) `d d2 d4 d6 d8 d10 d12 d20 d100`; (2) `1` to `0`; (3) `+ − * / ( ) , !`; (4) `B P T MIN MAX KH KL DH DL`; (5) the `4D6KH3` quick key. The d30 key and the KH/KL/DH/DL/DEL row are gone (keypad 8 rows → 5). The multiply and divide keys now read `*` and `/`.
- [x] DEL moved into the modifier row, right of CLEAR (`#diceDel` in `index.html`, still `backspace()`); modifier buttons narrowed to 36px and the field to 48px; ADV/DIS/CLEAR/DEL use 11px text and at least 40px width, so the row stays on one line.
- [x] Smart die keys (`dieKey`): with a selection, replace it with `dN`; if the text before the cursor ends in a bare number (`2`, `+3`), insert `dN` (calculator style); else if the box holds a plain term of that die (not followed by `kh`, `b`, `t`, `!`, `min` etc, and not the `d2` in `)d2`) raise its count by one and keep the cursor (at the end if it was at the end); else insert `1dN` at the cursor with a `+` before it when needed and after it when the next character is a digit, letter or `(`. `d` inserts a plain `d`.
- [x] Sizing in `styles.css`: `--key-gap` 6px → 3px, new `--key-pad: 4px` (keypad side margin), `.dkey.long` (labels of 3+ characters) at 12px, key height still 40px. All keys at least 32 x 32 px.
- [x] Cache-bust bumped: styles.css?v=4→5, script.js?v=5→6.

**Verification:** Playwright (Chromium), 38 checks, all pass, zero JS errors, 13 seconds. (Two checks first failed because my test expected the wrong cursor positions; the app was right, and the expectations were corrected.)
- Sizes at 360px and 412px wide: all 37 keys at least 32 x 32 (narrowest about 32px at 360px); five rows with exactly the requested keys; modifier row on one line with every control at least 32 x 32; DEL to the right of CLEAR.
- Die keys: `d8` x3 gives `3d8` with the cursor at the end; `d6` x2 then `d8` x3 gives `2d6+3d8`; `d6,d8,d6,d8` gives `2d6+2d8`; `2`,`d6` gives `2d6`; empty then `d8` gives `1d8`; `4d6kh3`, `d100b`, a group and `)d2` followed by a die key add a new term instead of changing the old one; `2d6+3` then `d8` gives `2d6+3d8`; selection replaced; inserts at the start and middle put plus signs in the right places with the cursor after the new text; incrementing keeps or shifts the cursor correctly (`9d6` → `10d6` shifts it by one); `d`,`3`,`0` gives `d30`; `*`, `/`, minus and the quick key insert the right characters.
- DEL removes a character, a selection, and does nothing on an empty box. A tap-built `2d6+3d8` rolls to the expected total with forced dice (9), and ADV converts its d6 term. No dialogs, no d30 key. Screenshots reviewed at 360x640 and 412x700.
- **Needs a real-device check:** key size and feel at 10 across, mainly the digit row on a 360px-wide phone.

## Build Log 8 (completed)
### Digits after die keys start a new term; the modifier lives in the notation box

Fixed `4`, `d2`, `2`, `d8`, `1`, `2`, `d12` giving `4d22+1d812+1d12` (it now gives `4d2+2d8+12d12`), and moved the final modifier into the notation box.

- [x] Digit memory in `script.js`: `afterDie` and `typingRun` marks (box text plus cursor, valid only while both are unchanged), `isMark`, `markDie`, `digitKey`. A digit tapped right after a die key or the `4D6KH3` quick key gets a `+` in front (unless the cursor is at the start or after an operator, `(`, `,` or `{`); the next digit just continues the number. Any other tap, edit or cursor move forgets the mark. The `d` key does not set it, so `d`,`3`,`0` still gives `d30`.
- [x] Modifier = the box's trailing `+N` or `-N` (`trailingMod`, `modOf`, `applyMod`, `setBox`); nothing before the sign, or an operator/`(`/`,`/`{` before it, means no modifier (`2*-3`). The -/+ buttons and the number field read and edit it in the box (add `+1`/`-1`, change, remove at 0 so no `+0` is left). Typing in the field is clamped to -99..+99; a hand-typed value beyond that (`+150`) is left alone and shown, the button that would push further does nothing and the other lowers it by 1. The old hidden modifier (`getMod`, `setMod`, `fullExpr`) is removed; ROLL rolls the box text and history shows it.
- [x] CLEAR empties the box, so the modifier resets to 0 (the field follows the box).
- [x] The -/+ buttons and the field are disabled while the box is empty or ends in an operator, `(`, `,` or `{`, since there is nothing to attach a modifier to (added during the build, within the spec's "do nothing" rule).
- [x] ADV/DIS one-tap shortcut now accepts one die with an optional trailing modifier (`LONE_DIE`): `1d20+3` rolls `2d20kh1+3` and leaves the box unchanged; converting the term at the cursor works as before.
- [x] The "Rolls: ..." preview line is removed (`index.html`, `styles.css`, `previewEl`), since it would only repeat the box.
- [x] Die keys: a bare number before the cursor counts as a count only when it was just typed with the digit keys; otherwise, with the cursor at the end of a box that has a trailing modifier, a new die goes before the modifier (`2d6+3` from the buttons, then `d8` gives `2d6+1d8+3`).
- [x] Cache-bust bumped: styles.css?v=5→6, script.js?v=6→7.

**Verification:** Playwright (Chromium), 44 checks, all pass, zero JS errors, 5 seconds.
- Digits: the reported sequence gives `4d2+2d8+12d12`; `d8` x3 then `5` gives `3d8+5`; the quick key then `2` gives `4d6kh3+2`; the second digit continues (`+25`); `d`,`3`,`0` gives `d30`; `2`,`d6` gives `2d6`; moving the cursor, another key or DEL clears the memory; no plus after `(`.
- Modifier: the field reads -1, 0, 0, 0, 3, -2 and 0 from `1d6+2d4-1`, `2d6+3d8`, `4d6kh3`, `2*-3`, `2d6+3`, `1d20-2`, `d100+0`; controls disabled for an empty box and for `2d6+`; + x3, - x4 and back to 0 (no `+0`); typing 5, -7 and 0 in the field; clamps at +99 and -99; a hand-typed `+150` is shown, + does nothing and - gives `+149`; CLEAR resets box and field; a roll uses the box text and history shows it (6 for forced 1,2 plus 3).
- ADV/DIS shortcut on `d20`, `1d20+3` (ADV and DIS) and `d100-2` with the right totals and history, box unchanged; ADV still converts a term at the cursor.
- Die keys with a modifier: `2d6+3` then `d8`, `d12`, `d8` gives `2d6+1d8+3`, then `+1d12`, then the d8 raised; `2`,`d6`,`+`,`3`,`d8` typed with digit keys gives `2d6+3d8`. Preview line gone. Screenshot reviewed at 360x640.
- **Earlier test re-run (keypad tightening, 37 of 38 pass):** its one check that expected `2d6+3` (set by filling the box) then `d8` to give `2d6+3d8` now gives `2d6+1d8+3`. That is the intended new rule, not a bug.
- **Needs a real-device check:** how the box and the modifier field feel together on the phone.

## Build Log 9 (completed)
### Taller dice roller tray and bigger dice stage

Requested: raise the dice roller card to almost touch the menu button and give the dice more room. CSS only.

- [x] `styles.css`: `#diceTray` max-height changed from 86% of the screen height to the full screen height minus 60px (`calc(100dvh - 60px)`, with a `100vh` fallback line before it). The 60px is 58px of space at the top plus the tray's 2px border, so the tray's top edge sits at 58px, 8px below the menu button (which ends at 50px). The tray bottom is still pinned to the screen bottom.
- [x] `styles.css`: `#diceStage` height 150px → 220px (222px with its 1px borders), so the dice are larger (about 50% bigger with several dice, up to 80px for a single die). Keys, the pinned box and ROLL are unchanged; ROLL still scrolls the dice into view.
- [x] Cache-bust bumped: styles.css?v=6→7 (script.js unchanged at v=7).

**Verification:** Playwright (Chromium), 10 checks, all pass, zero JS errors, about 10 seconds. At 412x700, 360x640 and 412x800: the tray top is exactly 58px (8px under the menu button) and its bottom is the screen bottom; the stage is 222px including borders; ROLL is on screen; every key is still at least 32px (smallest 32.1px at 360px wide); the menu button still opens the sidebar with the tray open. A roll with 8 dice scrolls the stage into view. Screenshot of an 8-dice roll reviewed.
- Two first-run failures were arithmetic on my side (the 2px border put the top at 56px, and the stage borders add 2px); fixed before this entry.
- **Needs a real-device check:** the gap under the menu button and the dice size on the phone.

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

### Keypad ideas

- **Long-press dual-purpose keys:** hold a key to get a second function, like the symbols on a phone keyboard (the user's Android keyboard shows small corner hints). Would let the keypad stay small while offering more keys. Open questions: which keys get a second function and what it is (for example a die key's long-press giving `d6!`, or a digit giving a symbol); how to show the hint (a small corner label); how long a press counts; and how it works with the 32px key minimum.

### Requested by Jon

- **Character sheets:** basic character-sheet panels that expand up from the bottom of the screen. Open questions: system-agnostic fields or a template per game? Linked to map tokens?