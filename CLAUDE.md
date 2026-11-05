# Rules of Engagement

## Standing rule

**Never build or edit code without explicit instruction.**

- Finding a bug, inconsistency, or improvement is never permission to fix it. Write it down (Build Planner or Build Queue) and leave it alone until authorized.
- "Explicit instruction" means something unambiguous: "go ahead and build it," "yes, add it." A problem description, a design discussion, or "that should probably be fixed" is not authorization.
- If an instruction is ambiguous, ask a clarifying question and wait for the answer. Don't guess, and don't build partway while waiting.
- Applies to small changes too. A one-line fix still waits for the go-ahead.
- Don't "clean up," optimize, or reformat anything unasked. Keep original formatting, spacing, and structure. Never add or remove features unless asked.

## Who owns the build docs

You (Claude) own editing the Build Log, Build Queue, and Build Planner sections of `README.md`. Update them yourself as part of doing the work. Don't wait for the user to write them, and don't ask them to.

These sections are your memory across sessions. At the start of every session, read them to learn what's shipped, what's specified and waiting, and what's only an idea.

A build isn't done until it's verified and logged. The same commit that contains the code also contains the Build Log entry and the Queue/Planner cleanup.

## The three sections (in README.md)

- **Build Log:** append-only, numbered history of completed work (`## Build Log N (completed)`). Each entry has a short title, a sentence or two of context, a `- [x]` checklist precise enough to reconstruct the change (file names, function names, exact behavior), and a **Verification** line stating exactly how it was tested and the result. A bug found and fixed during verification gets its own bullet. Never edit old entries to look right; corrections become new entries.
- **Build Queue:** fully specified, authorized-to-design but not yet built work. Specs must be complete enough that building is just execution. Mark each item "Not yet authorized to build." When built, remove it from the Queue in the same commit. If empty, write `_Empty — nothing queued right now._`
- **Build Planner:** the backlog of ideas, known gaps, and half-formed concepts, with open questions. When a design is settled, promote it to the Queue. Delete built, dropped, or superseded items (their history lives in the Log). If empty, write `_Empty — nothing backlogged right now._`

## Lifecycle

idea → Build Planner (if not ready) → design discussion → Build Queue → explicit "go ahead" → build → verify → Build Log entry → remove from Queue → commit + push

A design settled in one sitting can skip the Planner and go straight to the Queue.

## Working conventions

- **Design out loud first.** Restate what you think the user means and let them confirm or correct it.
- **Ask at real decision points,** and include a recommendation.
- **Reuse before inventing.** Check whether existing code already does almost the same thing, and note the reuse in the Log entry.
- **Log inconsistencies, don't fix them.** Even trivial ones. Surface them and let the user decide.
- **Cleanup your own build makes obsolete** (a Queue/Planner entry the build just resolved) is removed in the same commit. Unrelated things you notice are logged and left alone.
- **Catch your own mistakes.** If verification finds a bug your change introduced, fix it before calling the build done and say so in the Log.
- **Audit cross-references.** When editing numbered or cross-referenced content (help text, section numbers), update every reference and confirm with an automated check.

## Commits

- Authorization to build includes authorization to commit and push to `main`. Don't pause to ask. Risky git operations (force-push, history rewrite) still need a check first.
- New commit per build. Never amend, even for a tiny follow-up fix.
- Commit message: short summary line, then a line or two on *why*, not a restatement of the diff.
- Direct-to-main, no PRs (solo project). If collaborators join, that process takes precedence.

## Verification

"Verified" means actually driving the running app, not reading the diff.

1. Write throwaway Playwright scripts in a scratch location. Never commit them.
2. Register a page-error listener first and print the collected errors at the end. Zero JS errors is a hard bar.
3. Drive the UI like a real user (click buttons, fill inputs, read the rendered DOM). Don't reach into internal JS state.
4. Log each check with its expected value next to the actual value.
5. Screenshot any visual claim.
6. Only run tests directly affected by the change or that interact with it. No full regression runs for small changes. Keep tests under 3 minutes normally and about 1 minute for simple changes.
7. Test realistic data, not just an empty app.
8. **Reproduce a reported bug first.** Confirm the exact symptom fails, then find the root cause, fix it, and re-run the same reproduction.
9. **Long-press menus:** with the browser's simulated touch, lifting the finger sends a click that closes the menu, so pick the menu item while the finger is still down, then lift.
10. If something can't be verified here (real touch gestures, long-press, pinch, live network), say so explicitly and flag it for a real-device check. Don't silently skip it.

## Cache-busting

The app is split into `index.html`, `styles.css` and `script.js`, served directly with no bundler. The two asset tags in `index.html` carry a version query string (`styles.css?v=N`, `script.js?v=N`). Any edit to `styles.css` or `script.js` bumps that file's number by exactly 1 in the same change; a file that did not change keeps its number. The Build Log entry records before and after (`script.js?v=6→7`).

## Hosting and caching

The app is published with GitHub Pages at https://tundrajon.github.io/Virtual-Tabletop/ and pages are cached by browsers for up to 10 minutes. If the user says a change is not showing, or something looks half-updated, first suggest an incognito tab or adding `?v=N` to the address. This was the cause once already (a fix that was live but not visible).

## File encoding

`index.html` has no charset declaration, so `script.js` must stay pure ASCII. Write any non-ASCII character in it as a `\u` escape (for example the multiply sign as `\u00d7`). After editing `script.js`, check that it has no raw non-ASCII characters. This broke twice (the multiply and divide signs, and the minus key).

## Changes to this file

This file is mine to edit. Whenever I add or change something here, I tell the user in my reply: that I did it and exactly what changed.
