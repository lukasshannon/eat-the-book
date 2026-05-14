# UI architecture

The playable mockup is intentionally split by responsibility so visual iteration can happen without changing narrative state rules.

## HTML structure

- `docs/index.html` owns semantic regions and stable integration IDs.
- Keep the existing contracts used by the game code and smoke test: `scenePanel`, `stats`, `book`, `inventory`, tab buttons, and save controls.
- Character portraits are rendered with prepared assets from `docs/static/img/assets/characters/<name>/<emotion>.png`.

## CSS layers

`docs/static/css/ui.css` is an import-only entrypoint. Edit the smallest layer that matches the change:

1. `docs/static/css/ui/tokens.css` — colors, dimensions, shadows, and asset URLs.
2. `docs/static/css/ui/base.css` — reset rules, viewport lock, and page background.
3. `docs/static/css/ui/layout.css` — notebook grid, HUD placement, tabs, pockets, and controls.
4. `docs/static/css/ui/components.css` — decorative art, rendered paper cards, choices, recipe cards, journal rows, and portrait styling.
5. `docs/static/css/ui/responsive.css` — breakpoint overrides that keep the app full-screen without horizontal overflow.

When fixing layout bugs, prefer token changes first, then component-local changes, then breakpoint changes. Avoid placing new base rules in responsive files unless the rule is only valid at that breakpoint.

Selectors may appear in both `layout.css` and `components.css` only when their declarations remain split by responsibility: `layout.css` owns sizing, grid placement, offsets, positioning, stacking, and overflow; `components.css` owns backgrounds, gradients, borders, shadows, filters, decorative pseudo-element artwork, and other asset fidelity styling.

## JavaScript modules

- `docs/static/js/main.js` is only the boot wrapper and top-level error presenter.
- `docs/static/js/game-core.js` wires modules together and owns event flow.
- `docs/static/js/game-data.js` loads and normalizes JSON content.
- `docs/static/js/game-state.js` owns save data, defaults, and gameplay state mutations.
- `docs/static/js/ui-dom.js` validates required DOM contracts and centralizes error display helpers.
- `docs/static/js/ui-render.js` renders UI-only projections: tabs, status values, portraits, inventory, recipes, journal, and scene markup.
- `docs/static/js/constants.js` keeps shared storage keys, tabs, inventory glyphs, and recipe metadata out of orchestration code.

## Safety notes

- Rendered scene, choice, inventory, relation, and recipe strings are HTML-escaped before insertion. Continue this pattern for any future JSON-backed UI.
- New JSON-backed render helpers must call the centralized `escapeHtml()` before interpolating data-backed strings into HTML.
- UI-only work must not change `package.json` or `package-lock.json` unless explicitly requested.
- Do not commit binary assets; reuse existing files under `docs/static/img/assets`.

## Verification

Run the UI smoke test after layout or rendering changes:

```bash
node scripts/ui-smoke.mjs
```

The smoke test serves `docs/`, opens the app at mobile through desktop viewport sizes, verifies all primary controls remain visible, verifies each tab panel can be activated, and exercises choice progression plus theme toggling.

## Cover, tabs, and page motion

The first page is the closed front cover in `docs/index.html`. `syncBookMode()` keeps `#bookPages` and `#tabBar` hidden and inert until the player chooses `Start`, `Continue / Load`, or cover `Settings`. `animateBookOpen()` briefly shows the cover while the book opens, then leaves only the in-game tabbed interface visible.

The in-game navigation is the right-edge `#tabBar`. The labels are Café, Recipes, Worlds, Characters, Journal, and Settings. Layout rules in `layout.css` create the cardstock tab shape, and mobile overrides in `responsive.css` keep the tabs inside the phone viewport with minimum tap sizes. `setActiveTab()` updates ARIA state, shows the matching tab panel, persists the active tab after the game has started, and triggers a lightweight page-turn animation. The `prefers-reduced-motion: reduce` rule disables both cover and page-turn animations.

## Scene data contract

Runtime narrative content lives in `docs/static/data/story/dialogue.json`. Character display names and portrait folders live in `docs/static/data/characters.json`. The legacy `docs/static/data/scenes.json` file is not used by the runtime and remains only as a compatibility note for older tooling. The loader validates JSON before normalizing data for rendering, so schema issues fail early with an actionable error in the UI.

### Characters

`characters.json` must be an object keyed by character ID. Each entry should include:

- `name` — display name shown in the speaker label.
- `portrait` — portrait folder name under `docs/static/img/assets/characters/<portrait>/`.
- `emotion` — default portrait image basename, such as `neutral`, `warm`, or `angry`.

### Story scenes

`dialogue.json` must contain a top-level `scenes` array. Every scene object must include:

- `sceneId` — stable scene/node ID.
- `characterId` — character key from `characters.json`.
- `speakerName` — speaker label rendered in the dialogue card.
- `emotionKey` — portrait image basename used for the scene.
- `dialogueText` — text rendered from JSON, not hardcoded in JavaScript.
- `labels` — tab/page labels shown as scene tags.
- `conditions` — scene-level condition objects for future gating.
- `effects` — scene-level effect object for future hooks. Runtime one-time effects currently use `onEnter`.
- `worldTags` / `chapterTags` — optional tags.
- `choices` — array of branch options.

Each choice object must include:

- `label` — non-empty string rendered on the choice button.
- `nextNodeId` — scene ID that exists in `dialogue.json`.
- `conditions` — array reserved for branch gating.
- `effects` — optional object. Supported runtime effect keys are:
  - `flags` — object keyed by flag name.
  - `relation` or `relationship` — object keyed by character ID with finite numeric deltas.
  - `addItems` — array of inventory item strings.

Unsupported choice effect keys, missing scene targets, blank required strings, and malformed choice/effect values cause `loadGameData()` to throw an `Error` that names the scene ID or choice index that failed validation. Keep sample prose minimal and limited to the confirmed concepts: café outside time, recipe book, corrupted worlds, ghost children, recipes as portals, and branching character routes.
