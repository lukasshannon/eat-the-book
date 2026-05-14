import { ITEM_GLYPHS, RECIPE_NOTES, SHOWCASE_SLOTS, TAB_ORDER } from "./constants.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "empty";
}

export function createTabLayout(ui) {
  return {
    cafe: [ui.scenePanel, ui.sceneCharacterAsset.closest(".scene-visual")],
    recipes: [ui.recipePanel],
    worlds: [ui.worldHud],
    characters: [ui.charactersPanel],
    journal: [ui.journalPanel],
    settings: [ui.settingsPanel],
  };
}

export function syncTheme(ui, state) {
  document.body.dataset.theme = state.uiTheme;
  ui.themeToggle.setAttribute("aria-pressed", String(state.uiTheme === "high-contrast"));
}

export function syncBookMode(ui, state) {
  const isCoverVisible = !state.started;

  ui.notebookShell.classList.toggle("cover-active", isCoverVisible);
  ui.notebookShell.classList.toggle("book-open", state.started);
  ui.bookCover.toggleAttribute("hidden", state.started);
  ui.bookCover.setAttribute("aria-hidden", String(state.started));
  ui.bookPages.toggleAttribute("hidden", isCoverVisible);
  ui.bookPages.setAttribute("aria-hidden", String(isCoverVisible));
  ui.bookPages.toggleAttribute("inert", isCoverVisible);
  ui.tabBar.toggleAttribute("hidden", isCoverVisible);
  ui.tabBar.setAttribute("aria-hidden", String(isCoverVisible));
  ui.tabBar.toggleAttribute("inert", isCoverVisible);
}

export function animateBookOpen(ui) {
  ui.bookCover.hidden = false;
  ui.bookPages.hidden = false;
  ui.tabBar.hidden = false;
  ui.notebookShell.classList.remove("cover-active");
  ui.bookPages.removeAttribute("inert");
  ui.tabBar.removeAttribute("inert");
  ui.notebookShell.classList.add("book-opening", "book-open");
  window.setTimeout(() => {
    ui.notebookShell.classList.remove("book-opening");
    ui.bookCover.hidden = true;
  }, 360);
}

function animatePageTurn(ui) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  ui.bookPages.classList.remove("page-turning");
  window.requestAnimationFrame(() => {
    ui.bookPages.classList.add("page-turning");
    window.setTimeout(() => ui.bookPages.classList.remove("page-turning"), 230);
  });
}

export function renderInventorySlots(state) {
  const slots = state.inventory.length ? state.inventory.slice(-4) : [...SHOWCASE_SLOTS];
  while (slots.length < 4) slots.push("+");

  return slots
    .map((item) => {
      const glyph = ITEM_GLYPHS[item] || "mark";
      const label = item === "+" ? "Empty slot" : item;
      const itemClass = slugify(label);
      const count = item === "+" ? "" : "<span class='slot-count'>1</span>";

      return `<div class="inv-slot item-${itemClass}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" data-item="${itemClass}"><span class="slot-glyph slot-glyph-${glyph}" aria-hidden="true"></span>${count}</div>`;
    })
    .join("");
}

function getPortraitEmotion(_state, node) {
  return node.portraitEmotion || "neutral";
}

export function renderCharacterPortrait(ui, state, node) {
  const emotion = getPortraitEmotion(state, node);
  const displayName = node.speaker || "Café Keeper";
  const portraitName = node.portrait || node.speakerId;

  ui.sceneCharacterAsset.src = `./static/img/assets/characters/${portraitName}/${emotion}.png`;
  ui.sceneCharacterAsset.alt = `${displayName} character portrait`;
  ui.sceneCharacterName.textContent = displayName;
}

function getSceneOrdinal(state) {
  return Math.max(1, Object.keys(state.visited).length);
}

function getRecipeForScene(state, node) {
  const sceneRecipes = node.onEnter?.addBook || [];
  return sceneRecipes.at(-1) || state.recipeBook.at(-1) || "Recipe note";
}

function getProgressTitle(node) {
  return node.tags?.[0] || node.location || "Current Scene";
}

export function renderProgressNote(ui, state, node) {
  const progressTitle = getProgressTitle(node);
  const progressDetail = getRecipeForScene(state, node);
  ui.progress.textContent = `${progressTitle}\n${progressDetail}`;
}

export function renderStatus(ui, state, node) {
  const chapter = getSceneOrdinal(state);
  const readiness = state.flags.openedRecipeBook ? "Ready" : "Closed";
  const objective = `Use recipes as portals from the café into corrupted worlds.\nCurrent page: ${node.location}.`;

  ui.chapterValue.textContent = String(chapter);
  ui.chapterLabel.textContent = node.location;
  ui.energyValue.textContent = `${Math.max(40, 120 - state.inventory.length * 4)}/120`;
  ui.coinValue.textContent = String(100 + state.inventory.length * 10 + (state.relation.keeper || 0));
  ui.gemValue.textContent = String(10 + (state.relation.ghostChild || 0));
  ui.stealthMeter.textContent = readiness;
  ui.worldObjective.textContent = objective;
}

function renderRelationRows(relation) {
  return Object.entries(relation)
    .map(([name, value]) => `<span class="relation-chip"><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></span>`)
    .join("");
}

function renderInventoryLedger(items) {
  return items
    .map((item) => {
      const glyph = ITEM_GLYPHS[item] || "mark";
      return `<li><span class="slot-glyph slot-glyph-${glyph}" aria-hidden="true"></span><span>${escapeHtml(item)}</span><em>×1</em></li>`;
    })
    .join("");
}

function renderRecipeCard(recipe, index) {
  const note = RECIPE_NOTES[recipe] || { world: "Recipe book", status: "sample", note: "placeholder" };
  return `<article class="recipe-card recipe-card-${index % 4}"><span class="recipe-index">0${index + 1}</span><h4>${escapeHtml(recipe)}</h4><p>${escapeHtml(note.world)}</p><dl><dt>Status</dt><dd>${escapeHtml(note.status)}</dd><dt>Note</dt><dd>${escapeHtml(note.note)}</dd></dl></article>`;
}

function renderChoiceButton(choice, index) {
  return `<button class="choice" data-choice="${index}"><span class="choice-mark" aria-hidden="true"></span><span>${escapeHtml(choice.label)}</span></button>`;
}

function renderSceneTags(tags) {
  return tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
}

export function renderStats(ui, state) {
  const route = state.flags.choseRouteQuestion ? "Character route noted" : "Route undecided";
  const recipe = state.flags.openedRecipeBook ? "Recipe book opened" : "Recipe book closed";
  const inventoryHtml = renderInventorySlots(state);
  const relationRows = renderRelationRows(state.relation);
  const inventoryRows = renderInventoryLedger(state.inventory.length ? state.inventory : SHOWCASE_SLOTS);
  const recipeCards = state.recipeBook.map(renderRecipeCard).join("");

  ui.stats.innerHTML = [
    `<div class="journal-grid"><div class="journal-stat"><span>Concept</span><strong>Café outside time</strong></div>`,
    `<div class="journal-stat"><span>Recipes</span><strong>${recipe}</strong></div>`,
    `<div class="journal-stat"><span>Worlds</span><strong>Corrupted portals</strong></div>`,
    `<div class="journal-stat"><span>Routes</span><strong>${route}</strong></div></div>`,
    `<div class="relation-row" aria-label="Relations">${relationRows}</div>`,
    `<h4>Notebook items</h4><ul class="inventory-ledger">${inventoryRows}</ul>`,
  ].join("");
  ui.inventory.innerHTML = inventoryHtml;
  ui.book.innerHTML = [`<div class="recipe-spread">`, recipeCards, `</div>`].join("");
  ui.characters.innerHTML = [
    `<div class="journal-grid character-grid">`,
    `<div class="journal-stat"><span>Café</span><strong>Café Keeper</strong><p>Guides the book interface.</p></div>`,
    `<div class="journal-stat"><span>Routes</span><strong>Ghost Child</strong><p>Branching character route sample.</p></div>`,
    `</div>`,
  ].join("");
}

export function renderSceneContent(ui, node) {
  const tagsHtml = renderSceneTags(node.tags || []);
  const choicesHtml = (node.choices || []).map(renderChoiceButton).join("");
  const fallbackChoice = "<div class='mini'>This data sample has no further branch.</div>";

  ui.scenePanel.innerHTML = [
    `<div class="scene-meta"><h2>${escapeHtml(node.location)}</h2><div class="tags">${tagsHtml}</div></div>`,
    `<div class="speaker-label">${escapeHtml(node.speaker)}</div>`,
    `<div class="dialogue-text">${escapeHtml(node.text)}</div>`,
    `<div class="dialogue-stamp" aria-hidden="true"></div>`,
    `<div class="choices">${choicesHtml || fallbackChoice}</div>`,
  ].join("");
}

function setDetailsPanelState(ui, tab) {
  ui.recipePanel.open = tab === "recipes";
  ui.charactersPanel.open = tab === "characters";
  ui.journalPanel.open = tab === "journal";
}

function setPanelVisibility(section, isVisible) {
  if (!section) return;
  section.classList.toggle("tab-hidden", !isVisible);
  if (isVisible) section.removeAttribute("hidden");
  else section.setAttribute("hidden", "hidden");
}

export function syncWorldCompanionVisibility(ui, desktopWorldHud, state) {
  const isCompanion = false;

  ui.worldHud.classList.toggle("world-hud-companion", isCompanion);
  if (isCompanion) {
    setPanelVisibility(ui.worldHud, true);
    ui.worldHud.setAttribute("role", "complementary");
    ui.worldHud.setAttribute("aria-label", "Worlds companion");
    ui.worldHud.removeAttribute("aria-labelledby");
  } else {
    ui.worldHud.setAttribute("role", "tabpanel");
    ui.worldHud.setAttribute("aria-labelledby", "tab-worlds");
    ui.worldHud.removeAttribute("aria-label");
  }
}

export function setActiveTab(ui, tabLayout, desktopWorldHud, state, tabName, onPersist, shouldPersist = true) {
  const previousTab = state.activeTab;
  state.activeTab = tabLayout[tabName] ? tabName : "cafe";

  ui.tabBar.querySelectorAll(".tab-btn").forEach((button) => {
    const isActive = button.dataset.tab === state.activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  TAB_ORDER.flatMap((tab) => tabLayout[tab] || []).forEach((section) => setPanelVisibility(section, false));
  tabLayout[state.activeTab].forEach((section) => setPanelVisibility(section, true));
  syncWorldCompanionVisibility(ui, desktopWorldHud, state);
  setDetailsPanelState(ui, state.activeTab);
  if (shouldPersist && state.started && previousTab !== state.activeTab) animatePageTurn(ui);
  if (shouldPersist) onPersist(state);
}
