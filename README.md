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

_Empty — nothing queued right now._

## Build Planner

Resolved, built, dropped, or superseded items are deleted from this section. Their history lives in the Build Log.

_Empty — nothing backlogged right now._
