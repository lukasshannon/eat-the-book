You are working in the `lukasshannon/eat-the-book` repository.

Your task is to implement the UI so the running app closely matches:

`ref/ui-mockup.png`

Use image assets from:

`docs/static/img/assets/`

This is a visual-fidelity implementation task. Do not make a tiny incremental patch. Do not stop after “initial styling,” “basic structure,” or “some improvements.” Work through multiple substantial implementation/refinement passes in this one run.

Repository-specific context:

- This is a static docs app.
- The page entry point is `docs/index.html`.
- The main stylesheet is `docs/static/css/ui.css`.
- The app entry module is `docs/static/js/main.js`.
- `docs/static/js/main.js` only imports and calls `initGame()` from `docs/static/js/game-core.js`.
- `docs/static/js/game-core.js` owns state, tab behavior, rendering, localStorage, status values, recipe/inventory rendering, and scene choice handling.
- Game content is in `docs/static/data/characters.json` and `docs/static/data/scenes.json`.

Verify what package/test files actually exist before assuming commands. If those commands exist, run them. If not, run the closest available checks and document the mismatch.

Important implementation constraints:

1. Do not alter `ref/ui-mockup.png`.
2. Do not delete, overwrite, or rename files in `docs/static/img/assets/`.
3. Preserve existing app functionality unless it directly conflicts with the mockup.
4. Preserve JavaScript-dependent IDs unless you update all references correctly:
   - `app`
   - `scenePanel`
   - `stats`
   - `inventory`
   - `book`
   - `errorBox`
   - `progress`
   - `startBtn`
   - `continueBtn`
   - `resetBtn`
   - `chapterValue`
   - `chapterLabel`
   - `energyValue`
   - `coinValue`
   - `gemValue`
   - `themeToggle`
   - `tabBar`
   - `worldHud`
   - `recipePanel`
   - `journalPanel`
   - `stealthMeter`
   - `worldObjective`
5. Preserve tab accessibility:
   - tab buttons keep `role="tab"`
   - panels keep compatible `role="tabpanel"`
   - active tab updates `aria-selected`
   - hidden panels remain hidden correctly
   - keyboard navigation still works
6. Keep localStorage save/continue/reset behavior working.
7. Do not replace actual UI with a static screenshot. The UI must remain real HTML/CSS/JS.
8. Prefer actual assets from `docs/static/img/assets/` over CSS placeholder drawings, emoji-only visuals, or generic gradients.
9. Make the result responsive enough for common desktop and mobile widths.

Required first step:

Inspect the current repo before editing:

- Open `ref/ui-mockup.png`.
- List available assets:

  `find docs/static/img/assets -maxdepth 2 -type f | sort`

- Inspect:
  - `docs/index.html`
  - `docs/static/css/ui.css`
  - `docs/static/js/game-core.js`
  - `docs/static/js/main.js`
  - `docs/static/data/characters.json`
  - `docs/static/data/scenes.json`
  - package/test files, if present

Then create a visual checklist from the mockup before coding. The checklist should cover:

- overall canvas/background
- notebook/page shape
- asset placement
- header/status area
- main scene image area
- character/NPC art area
- dialogue card
- choices/buttons
- bottom tabs/navigation
- world HUD
- recipe/inventory panels
- typography
- color palette
- borders
- shadows
- texture/paper effects
- spacing/alignment
- responsive behavior

Implementation strategy:

Pass 1 — Structural fidelity:
- Update `docs/index.html` only where needed to support the mockup.
- Keep required IDs stable.
- Add semantic wrapper elements/classes only when they improve visual fidelity or maintainability.
- Do not break `game-core.js` selectors.

Pass 2 — Asset integration:
- Replace placeholder CSS-only visuals with real assets from `docs/static/img/assets/`.
- Use correct relative paths from CSS/HTML/JS.
- Use `background-image`, `<img>`, or generated markup as appropriate.
- Add alt text for meaningful images and `aria-hidden="true"` for decorative assets.

Pass 3 — CSS fidelity:
- Rewrite/refine `docs/static/css/ui.css` substantially.
- Match the mockup’s layout, colors, paper/notebook texture, image layering, border radius, shadows, buttons, tabs, HUD panels, spacing, and type scale.
- Remove or reduce lazy placeholders where assets should be used.
- Keep CSS organized with variables and clear sectioning.

Pass 4 — JS/rendered markup fidelity:
- Modify `docs/static/js/game-core.js` only where needed for better rendered UI.
- Improve generated markup for dialogue, choices, inventory, recipe book, tags, and HUD if needed.
- Keep state transitions, saving, tab handling, and accessibility intact.

Pass 5 — Responsive/accessibility polish:
- Ensure the page works on desktop and mobile.
- Ensure no content is clipped awkwardly.
- Ensure buttons remain tappable.
- Ensure text remains readable.
- Ensure focus states are visible.
- Ensure reduced-motion friendliness if animations are added.

Pass 6 — Verification:
Inspect the repo and run the closest valid check available. At minimum, serve `docs/` locally and manually verify `docs/index.html` loads without console errors if possible.

Anti-laziness requirements:

- Make substantial visual progress before stopping.
- Do not stop after changing only colors, only spacing, or only one component.
- Do not leave obvious placeholder rectangles if relevant assets exist.
- Do not say “future work could improve fidelity” unless you have already made a serious full-page pass.
- If the first approach is too shallow, immediately do another pass in the same run.
- Prefer completing fewer areas deeply over touching many areas superficially, but the final result should still transform the full page.

When done, report exactly:

1. Visual checklist completed.
2. Files modified.
3. Assets used from `docs/static/img/assets/`.
4. Commands/checks run and results.
5. Remaining visual differences from `ref/ui-mockup.png`, limited to real unresolved differences.

Continuation behavior:

If I later send:

`Continue`

do not ask what to do next.

Instead:

1. Re-open `ref/ui-mockup.png`.
2. Re-inspect the current implementation.
3. Re-list `docs/static/img/assets/` in case new/unused assets matter.
4. Identify the largest remaining visual gaps.
5. Make another substantial visual-fidelity pass.
6. Run checks again.
7. Report what changed, what assets were used, what checks passed/failed, and what still differs.

Every `Continue` must produce meaningful UI improvement, not tiny isolated tweaks.

