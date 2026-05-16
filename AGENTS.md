# AGENTS.md

## Purpose
This repository expects coding agents to prioritize correctness, clarity, maintainability, and safety in every change.

## Core quality rules
1. **Understand before changing**
   - Read the surrounding code and related files before editing.
   - Prefer minimal, focused diffs that solve the root cause.

2. **Plan first for non-trivial work**
   - Outline a short plan before implementing multi-step changes.
   - Call out assumptions and validate them with code or tests.

3. **Keep code readable**
   - Use clear names and small functions.
   - Avoid duplicated logic; extract helpers when repetition appears.
   - Follow existing project style and patterns.

4. **Preserve behavior unless requested**
   - Do not introduce unrelated refactors.
   - If behavior changes, document what changed and why.

5. **Add/adjust tests**
   - Add or update automated tests for every functional change when feasible.
   - Cover happy paths, edge cases, and regression scenarios.

6. **Run verification locally**
   - Run the narrowest relevant checks first, then broader suites as needed.
   - Do not claim success without running commands.

7. **Fail safely**
   - Handle errors explicitly and return actionable messages.
   - Never swallow exceptions silently.

8. **Security and data handling**
   - Validate inputs at boundaries.
   - Avoid secrets in code, logs, tests, or fixtures.
   - Use least-privilege principles for integrations.

9. **Performance awareness**
   - Avoid unnecessary allocations, queries, and network calls.
   - For hot paths, include a short note on complexity/trade-offs.

10. **Document decisions**
   - Update docs/comments when interfaces or behavior change.
   - In PR summaries, include: problem, approach, validation, and risks.
   - Update this file `AGENTS.md` with any important user requirements mentioned.

## Pull request checklist
Before finalizing, ensure all are true:
- [ ] Change is scoped and understandable.
- [ ] Tests were added/updated as appropriate.
- [ ] Relevant linters/tests pass locally.
- [ ] Backward compatibility considered.
- [ ] No credentials or sensitive data introduced.
- [ ] Documentation updated if needed.
- [ ] User's request was satisfies completely.

## UI plan
- The reference mockup for the final complete UI is in `ref/ui-mockup`.
- Separate structure (`docs/index.html`), visuals (`docs/static/css/ui.css`), and gameplay logic (`docs/static/js/*.js`) so interface work stays isolated from narrative state logic.
- Place generated UI assets in `docs/static/img/` and reference them from CSS/HTML only.
- Preserve existing game IDs and behavior contracts (`scenePanel`, `stats`, `book`, `inventory`, controls) while enabling incremental UI iteration.
- Do not add or modify dependency manifest lock files for UI-only work (`package.json` and `package-lock.json` must remain unchanged unless explicitly requested).

- UI iteration requirement (2026-05-05): continue implementing the UI and reuse image assets from `docs/static/img/assets`.
- Character portrait requirement (2026-05-12): use the prepared pictures under `docs/static/img/assets/characters/<name>` for character portraits.
- Compact spacing requirement (2026-05-14): minimize unnecessary empty space around the notebook on compact/mobile viewports.
- Mobile tab requirement (2026-05-14): prioritize phone portrait usability; right-side binder tabs must stay fully within the viewport, avoid horizontal scrolling, and remain large enough to tap.
- Story data requirement (2026-05-14): keep dialogue JSON-driven under `docs/static/data/story/`; placeholder copy should refer only to confirmed concepts and avoid invented chapter lore.
- UI motion requirement (2026-05-14): tab changes should use quick page-turn or slide animation while respecting reduced-motion preferences and keeping interactions responsive.
- Mobile intro requirement (2026-05-14): collapse the left-hand intro banner on narrow screens into a small expandable control so the notebook remains the priority.
- JSON sample requirement (2026-05-14): demonstrate sample tab content loaded from JSON rather than hardcoded UI strings.
- Commit content requirement (2026-05-05): do not include binary files (for example `.png`, `.jpg`, `.gif`, `.webp`, `.ico`, `.pdf`) in any commit.
- Visual polish requirement (2026-05-15): do focused, cohesive improvements to the existing cozy-haunted recipe notebook UI; preserve the current design direction, mobile-first readability, JSON-driven content, and DOM/test contracts.
- Journal background requirement (2026-05-16): render the split journal background from `docs/static/img/assets/journal/` so the center can stretch responsively without distorting the outer notebook edges.
- JSON content requirement (2026-05-16): Café, Recipes, and Worlds tab sample content should load from `docs/static/data/story/dialogue.json`; include orchard ghost child dialogue, one discovered recipe, and the orchard world entry without hardcoded narrative copy.
- Layout priority requirement (2026-05-16): screen alignment is the first UI priority; keep the notebook shell, right-side tabs, dialogue controls, and JSON cards fully inside supported desktop/mobile viewports with no horizontal overflow.
- Book component requirement (2026-05-16): `docs/book.html` / `page-turn-book` should be a clean-room vanilla JavaScript Web Component adaptation inspired by `github.com/blasten/turn.js`; do not depend on jQuery or the turn.js runtime.
- Turn book touch animation requirement (2026-05-16): continue improving `docs/book.html` touch/drag controls with responsive page-curl animations, clear edge affordances, reduced-motion support, and no jQuery/turn.js runtime dependency.
