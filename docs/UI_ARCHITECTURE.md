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
- UI-only work must not change `package.json` or `package-lock.json` unless explicitly requested.
- Do not commit binary assets; reuse existing files under `docs/static/img/assets`.

## Verification

Run the UI smoke test after layout or rendering changes:

```bash
node scripts/ui-smoke.mjs
```

The smoke test serves `docs/`, opens the app at mobile through desktop viewport sizes, verifies all primary controls remain visible, verifies each tab panel can be activated, and exercises choice progression plus theme toggling.

## Scene data contract

Narrative content lives in `docs/static/data/characters.json` and `docs/static/data/scenes.json`. The loader validates these files before normalizing data for rendering, so schema issues fail early with an actionable error in the UI.

### Characters

`characters.json` must be an object keyed by character ID. Each entry can be either a string display name or an object. After normalization, every character must have non-empty string values for:

- `name` — display name shown in the speaker label.
- `portrait` — portrait folder name under `docs/static/img/assets/characters/<portrait>/`.
- `emotion` — default portrait image basename, such as `neutral`, `warm`, or `angry`.

### Scenes

`scenes.json` must be an object keyed by scene ID. Every scene object must include:

- `location` — non-empty string rendered as the scene heading.
- `speaker` — character ID that exists in `characters.json`.
- `text` — non-empty string rendered as dialogue.
- `choices` — optional array. Omit this for terminal scenes; when present it must be an array.

Each choice object must include:

- `label` — non-empty string rendered on the choice button.
- `next` — scene ID that exists in `scenes.json`.
- `effects` — optional object. When present, it can only contain supported effect keys:
  - `flags` — object keyed by flag name with non-empty string keys.
  - `relation` — object keyed by character ID with finite numeric deltas.
  - `addItems` — array of non-empty inventory item strings.

Unsupported effect keys, missing scene targets, unknown speakers, blank required strings, and malformed choice/effect values cause `loadGameData()` to throw an `Error` that names the scene ID, choice index, or character ID that failed validation.
