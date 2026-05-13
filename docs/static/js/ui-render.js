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
    cafe: [ui.scenePanel],
    recipes: [ui.recipePanel],
    worlds: [ui.worldHud],
    journal: [ui.journalPanel],
  };
}

export function syncTheme(ui, state) {
  document.body.dataset.theme = state.uiTheme;
  ui.themeToggle.setAttribute("aria-pressed", String(state.uiTheme === "high-contrast"));
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

function getPortraitEmotion(state, node) {
  if (node.end && node.speakerId === "keeper") return state.flags.choseFeed ? "happy" : "sad";
  if (node.speakerId === "raincoat" && state.flags.limbInjury) return "afraid";
  if (node.speakerId === "mirror" && state.flags.sharedTruth) return "warm";
  return node.portraitEmotion || "neutral";
}

export function renderCharacterPortrait(ui, state, node) {
  const emotion = getPortraitEmotion(state, node);
  const displayName = node.speaker || "Keeper";
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
  return sceneRecipes.at(-1) || state.recipeBook.at(-1) || "Recipe pending";
}

function getProgressTitle(node) {
  const primaryTag = node.tags?.[0];
  if (node.end) return primaryTag || "Ending";
  return primaryTag || node.location || "Current Scene";
}

export function renderProgressNote(ui, state, node) {
  const progressTitle = getProgressTitle(node);
  const progressDetail = node.end ? node.location : getRecipeForScene(state, node);
  ui.progress.textContent = `${progressTitle}\n${progressDetail}`;
}

export function renderStatus(ui, state, node) {
  const chapter = getSceneOrdinal(state);
  const stealth = state.flags.limbInjury ? "♥♥♥" : "♥♥♥♥";
  const objective = node.end
    ? `Reflect on ${node.location}.`
    : `Gather ingredients in ${node.location}.\nReturn to the Quiet Café.`;

  ui.chapterValue.textContent = String(chapter);
  ui.chapterLabel.textContent = node.end ? "Ending" : node.location;
  ui.energyValue.textContent = `${Math.max(40, 120 - state.inventory.length * 4)}/120`;
  ui.coinValue.textContent = String(1200 + state.inventory.length * 25 + state.relation.orchard * 15);
  ui.gemValue.textContent = String(80 + state.relation.mirror * 3 + (state.flags.sharedTruth ? 6 : 0));
  ui.stealthMeter.textContent = stealth;
  ui.worldObjective.textContent = objective;

  if (ui.companionStealth) ui.companionStealth.textContent = stealth;
  if (ui.companionObjective) ui.companionObjective.textContent = objective;
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
  const note = RECIPE_NOTES[recipe] || { world: "Unknown World", scar: "blank margin", cost: "unknown" };
  return `<article class="recipe-card recipe-card-${index % 4}"><span class="recipe-index">0${index + 1}</span><h4>${escapeHtml(recipe)}</h4><p>${escapeHtml(note.world)}</p><dl><dt>Scar</dt><dd>${escapeHtml(note.scar)}</dd><dt>Cost</dt><dd>${escapeHtml(note.cost)}</dd></dl></article>`;
}

function renderChoiceButton(choice, index) {
  return `<button class="choice" data-choice="${index}"><span class="choice-mark" aria-hidden="true"></span><span>${escapeHtml(choice.label)}</span></button>`;
}

function renderSceneTags(tags) {
  return tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
}

export function renderStats(ui, state) {
  const tone = state.flags.protective ? "Protective" : "Balanced";
  const risk = state.flags.riskyPlan ? "Risky Brew" : "Careful Brew";
  const truth = state.flags.sharedTruth ? "Truth Shared" : "Truth Hidden";
  const body = state.flags.limbInjury ? "Injured" : "Whole";
  const inventoryHtml = renderInventorySlots(state);
  const relationRows = renderRelationRows(state.relation);
  const inventoryRows = renderInventoryLedger(state.inventory.length ? state.inventory : SHOWCASE_SLOTS);
  const recipeCards = state.recipeBook.map(renderRecipeCard).join("");

  ui.stats.innerHTML = [
    `<div class="journal-grid"><div class="journal-stat"><span>Route Tone</span><strong>${tone}</strong></div>`,
    `<div class="journal-stat"><span>Plan</span><strong>${risk}</strong></div>`,
    `<div class="journal-stat"><span>Trust</span><strong>${truth}</strong></div>`,
    `<div class="journal-stat"><span>Body</span><strong class="meter">${body}</strong></div></div>`,
    `<div class="relation-row" aria-label="Relations">${relationRows}</div>`,
    `<h4>Gathered Ingredients</h4><ul class="inventory-ledger">${inventoryRows}</ul>`,
  ].join("");
  ui.inventory.innerHTML = inventoryHtml;
  if (ui.companionInventory) ui.companionInventory.innerHTML = inventoryHtml;
  ui.book.innerHTML = [`<div class="recipe-spread">`, recipeCards, `</div>`].join("");
}

export function renderSceneContent(ui, node) {
  const tagsHtml = renderSceneTags(node.tags || []);
  const choicesHtml = (node.choices || []).map(renderChoiceButton).join("");
  const fallbackChoice = "<div class='mini'>The shift is over. Use Start New to replay.</div>";

  ui.scenePanel.innerHTML = [
    `<div class="scene-meta"><h2>${escapeHtml(node.location)}</h2><div class="tags">${tagsHtml}</div></div>`,
    `<div class="speaker-label">${escapeHtml(node.speaker)}</div>`,
    `<div class="dialogue-text">${escapeHtml(node.text)}</div>`,
    `<div class="dialogue-stamp" aria-hidden="true"></div>`,
    `<div class="choices">${choicesHtml || fallbackChoice}</div>`,
  ].join("");
}

function setDetailsPanelState(ui, tab) {
  if (tab === "recipes") {
    ui.recipePanel.open = true;
    ui.journalPanel.open = false;
  } else if (tab === "journal") {
    ui.recipePanel.open = false;
    ui.journalPanel.open = true;
  }
}

function setPanelVisibility(section, isVisible) {
  section.classList.toggle("tab-hidden", !isVisible);
  if (isVisible) section.removeAttribute("hidden");
  else section.setAttribute("hidden", "hidden");
}

export function syncWorldCompanionVisibility(ui, desktopWorldHud, state) {
  if (!ui.worldCompanion) return;
  ui.worldCompanion.hidden = !(desktopWorldHud.matches && state.activeTab !== "worlds");
}

export function setActiveTab(ui, tabLayout, desktopWorldHud, state, tabName, onPersist, shouldPersist = true) {
  state.activeTab = tabLayout[tabName] ? tabName : "cafe";

  ui.tabBar.querySelectorAll(".tab-btn").forEach((button) => {
    const isActive = button.dataset.tab === state.activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  TAB_ORDER.flatMap((tab) => tabLayout[tab]).forEach((section) => setPanelVisibility(section, false));
  tabLayout[state.activeTab].forEach((section) => setPanelVisibility(section, true));
  syncWorldCompanionVisibility(ui, desktopWorldHud, state);
  setDetailsPanelState(ui, state.activeTab);
  if (shouldPersist) onPersist(state);
}
