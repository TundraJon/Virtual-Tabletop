# Virtual-Tabletop
Micro virtual tabletop with lots of extras

## Build Log

_Empty — nothing logged yet. Logging starts with the next build._

## Build Queue

### Split index.html into HTML, CSS and JS (pure move)

**Not yet authorized to build.**

Split the single-file app into three files. No behavior, markup, style or logic changes.

- [ ] `styles.css`: the exact contents of the `<style>` block in `index.html`, moved verbatim.
- [ ] `script.js`: the exact contents of the `<script>` block in `index.html`, moved verbatim (including the final `init();` call).
- [ ] `index.html`: keeps the doctype, `<head>` meta tags, `<title>` and all body markup untouched. The `<style>` block is replaced by `<link rel="stylesheet" href="styles.css?v=1">` in the head. The `<script>` block is replaced by `<script src="script.js?v=1"></script>` in the same position, at the bottom of `<body>`, so the inline `onclick` handlers and `init()` behave as before.
- [ ] `keep.html` is not touched. It stays the single-file backup.
- [ ] Cache-busting starts at `styles.css?v=1` and `script.js?v=1`.
- [ ] Original formatting, spacing and indentation preserved inside the moved blocks.

Verification plan: serve the folder locally and load it with Playwright. Check zero JS errors, the splash fades, the sidebar opens and its tabs switch, the map and token inputs exist, and styles apply (computed styles match `keep.html`). Compare screenshots of `index.html` and `keep.html`. Touch gestures (long-press, drag, pinch) can't be fully verified here and need a real-device check.

## Build Planner

Resolved, built, dropped, or superseded items are deleted from this section. Their history lives in the Build Log.

_Empty — nothing backlogged right now._
