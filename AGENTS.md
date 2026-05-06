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
- Commit content requirement (2026-05-05): do not include binary files (for example `.png`, `.jpg`, `.gif`, `.webp`, `.ico`, `.pdf`) in any commit.
