export async function initGame() {
  const STORAGE_KEY = "eat-the-book-vertical-slice-v1";
  const desktopWorldHud = window.matchMedia("(min-width: 981px)");
  const itemGlyphs = {
    "+": "+",
    "grave-honey": "bottle",
    "blighted apple milk": "flower",
    "shell salt": "shell",
    "drowned roots": "root",
    "pale seaweed": "leaf",
    "hot kettle coal": "coal",
    "stable broth base": "bowl",
    "new sun ember": "sun",
  };

  const recipeNotes = {
    "Orchard Porridge": { world: "Ruined Orchard", scar: "pressed clover", cost: "warmth" },
    "Tide Broth": { world: "Drowned Village", scar: "salt bloom", cost: "breath" },
    "Scarecrow Stitch": { world: "Hedge Patrol", scar: "black thread", cost: "limb" },
    "Kitchen Oath": { world: "Fate Stove", scar: "burnt corner", cost: "choice" },
  };

  function normalizeCharacter(characterId, character) {
    if (typeof character === "string") {
      return { name: character, portrait: characterId, emotion: "neutral" };
    }

    return {
      name: character?.name || characterId,
      portrait: character?.portrait || characterId,
      emotion: character?.emotion || "neutral",
    };
  }

  async function loadGameData() {
    const [charactersResponse, scenesResponse] = await Promise.all([
      fetch("./static/data/characters.json"),
      fetch("./static/data/scenes.json"),
    ]);

    if (!charactersResponse.ok || !scenesResponse.ok) {
      throw new Error("Unable to load game data JSON files.");
    }

    const rawCharacters = await charactersResponse.json();
    const characters = Object.fromEntries(
      Object.entries(rawCharacters).map(([characterId, character]) => [
        characterId,
        normalizeCharacter(characterId, character),
      ]),
    );
    const rawScenes = await scenesResponse.json();
    const scenes = Object.fromEntries(
      Object.entries(rawScenes).map(([sceneId, node]) => {
        const character = characters[node.speaker] || normalizeCharacter(node.speaker, node.speaker);

        return [
          sceneId,
          {
            ...node,
            speakerId: node.speaker,
            speaker: character.name,
            portrait: character.portrait,
            portraitEmotion: character.emotion,
          },
        ];
      }),
    );

    return { scenes };
  }

  const { scenes: GAME_DATA } = await loadGameData();

  const ui = {
    scenePanel: document.getElementById("scenePanel"),
    stats: document.getElementById("stats"),
    inventory: document.getElementById("inventory"),
    book: document.getElementById("book"),
    errorBox: document.getElementById("errorBox"),
    progress: document.getElementById("progress"),
    startBtn: document.getElementById("startBtn"),
    continueBtn: document.getElementById("continueBtn"),
    resetBtn: document.getElementById("resetBtn"),
    chapterValue: document.getElementById("chapterValue"),
    chapterLabel: document.getElementById("chapterLabel"),
    energyValue: document.getElementById("energyValue"),
    coinValue: document.getElementById("coinValue"),
    gemValue: document.getElementById("gemValue"),
    themeToggle: document.getElementById("themeToggle"),
    tabBar: document.getElementById("tabBar"),
    worldHud: document.getElementById("worldHud"),
    recipePanel: document.getElementById("recipePanel"),
    journalPanel: document.getElementById("journalPanel"),
    stealthMeter: document.getElementById("stealthMeter"),
    worldObjective: document.getElementById("worldObjective"),
    worldCompanion: document.querySelector(".world-companion"),
    companionStealth: document.querySelector("[data-world-stealth]"),
    companionInventory: document.querySelector("[data-world-inventory]"),
    companionObjective: document.querySelector("[data-world-objective]"),
    sceneCharacterAsset: document.getElementById("sceneCharacterAsset"),
    sceneCharacterName: document.getElementById("sceneCharacterName"),
  };

  const TAB_LAYOUT = {
    cafe: [ui.scenePanel],
    recipes: [ui.recipePanel],
    worlds: [ui.worldHud],
    journal: [ui.journalPanel],
  };

  const TABBABLE_SECTIONS = [ui.scenePanel, ui.worldHud, ui.recipePanel, ui.journalPanel];

  function defaultState() {
    return {
      current: "title",
      started: false,
      flags: {
        protective: false,
        riskyPlan: false,
        sharedTruth: false,
        disguiseChecked: false,
        extraIngredients: false,
        limbInjury: false,
        choseFeed: false,
      },
      relation: { orchard: 0, raincoat: 0, mirror: 0 },
      inventory: [],
      recipeBook: ["Orchard Porridge"],
      visited: {},
      uiTheme: "default",
      activeTab: "cafe",
    };
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showError(message) {
    ui.errorBox.style.display = "block";
    ui.errorBox.textContent = `Error: ${message}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();

      const parsed = JSON.parse(raw);
      const fallback = defaultState();
      return {
        ...fallback,
        ...parsed,
        flags: { ...fallback.flags, ...(parsed.flags || {}) },
        relation: { ...fallback.relation, ...(parsed.relation || {}) },
      };
    } catch (error) {
      showError("Save file is corrupted. Starting fresh.");
      return defaultState();
    }
  }

  function clearError() {
    ui.errorBox.style.display = "none";
    ui.errorBox.textContent = "";
  }

  function uniquePush(list, items) {
    items.forEach((item) => {
      if (!list.includes(item)) list.push(item);
    });
  }

  function applyEffects(state, effects = {}) {
    if (effects.flags) {
      Object.entries(effects.flags).forEach(([key, value]) => {
        state.flags[key] = value;
      });
    }

    if (effects.relation) {
      Object.entries(effects.relation).forEach(([key, value]) => {
        state.relation[key] = (state.relation[key] || 0) + value;
      });
    }

    if (effects.addItems) uniquePush(state.inventory, effects.addItems);
  }

  function applyOnEnter(state, node) {
    if (state.visited[state.current]) return;
    if (node.onEnter?.addItems) uniquePush(state.inventory, node.onEnter.addItems);
    if (node.onEnter?.addBook) uniquePush(state.recipeBook, node.onEnter.addBook);
    state.visited[state.current] = true;
  }

  function renderInventorySlots(state) {
    const showcaseSlots = ["grave-honey", "blighted apple milk", "shell salt"];
    const slots = state.inventory.length ? state.inventory.slice(-4) : showcaseSlots;
    while (slots.length < 4) slots.push("+");

    return slots
      .map((item) => {
        const glyph = itemGlyphs[item] || "mark";
        const label = item === "+" ? "Empty slot" : item;
        const itemClass = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "empty";
        const count = item === "+" ? "" : "<span class='slot-count'>1</span>";
        return `<div class="inv-slot item-${itemClass}" title="${label}" aria-label="${label}" data-item="${itemClass}"><span class="slot-glyph slot-glyph-${glyph}" aria-hidden="true"></span>${count}</div>`;
      })
      .join("");
  }

  function getPortraitEmotion(state, node) {
    if (node.end && node.speakerId === "keeper") return state.flags.choseFeed ? "happy" : "sad";
    if (node.speakerId === "raincoat" && state.flags.limbInjury) return "afraid";
    if (node.speakerId === "mirror" && state.flags.sharedTruth) return "warm";
    return node.portraitEmotion || "neutral";
  }

  function renderCharacterPortrait(state, node) {
    if (!ui.sceneCharacterAsset || !ui.sceneCharacterName) return;

    const emotion = getPortraitEmotion(state, node);
    const displayName = node.speaker || "Keeper";
    const portraitName = node.portrait || node.speakerId;

    ui.sceneCharacterAsset.src = `./static/img/assets/characters/${portraitName}/${emotion}.png`;
    ui.sceneCharacterAsset.alt = `${displayName} character portrait`;
    ui.sceneCharacterName.textContent = displayName;
  }

  function renderStatus(state, node) {
    const visitedCount = Math.max(1, Object.keys(state.visited).length);
    const chapter = node.end ? Math.min(12, visitedCount) : 12;
    const stealth = state.flags.limbInjury ? "♥♥♥" : "♥♥♥♥";
    const objective = node.end
      ? "The shift is over. Reflect on what you chose."
      : `Stay unseen. Find ingredients.\nReturn from ${node.location}.`;

    ui.chapterValue.textContent = String(chapter);
    ui.chapterLabel.textContent = node.end ? "Finale" : "Barista";
    ui.energyValue.textContent = `${Math.max(40, 120 - state.inventory.length * 4)}/120`;
    ui.coinValue.textContent = String(1200 + state.inventory.length * 25 + state.relation.orchard * 15);
    ui.gemValue.textContent = String(80 + state.relation.mirror * 3 + (state.flags.sharedTruth ? 6 : 0));
    ui.stealthMeter.textContent = stealth;
    ui.worldObjective.textContent = objective;

    if (ui.companionStealth) ui.companionStealth.textContent = stealth;
    if (ui.companionObjective) ui.companionObjective.textContent = objective;
  }

  function renderStats(state) {
    const tone = state.flags.protective ? "Protective" : "Balanced";
    const risk = state.flags.riskyPlan ? "Risky Brew" : "Careful Brew";
    const truth = state.flags.sharedTruth ? "Truth Shared" : "Truth Hidden";
    const body = state.flags.limbInjury ? "Injured" : "Whole";
    const inventoryHtml = renderInventorySlots(state);
    const relationRows = Object.entries(state.relation)
      .map(([name, value]) => `<span class="relation-chip"><span>${name}</span><strong>${value}</strong></span>`)
      .join("");
    const inventoryRows = (state.inventory.length ? state.inventory : ["grave-honey", "blighted apple milk", "shell salt"])
      .map((item) => {
        const glyph = itemGlyphs[item] || "mark";
        return `<li><span class="slot-glyph slot-glyph-${glyph}" aria-hidden="true"></span><span>${item}</span><em>×1</em></li>`;
      })
      .join("");

    ui.stats.innerHTML = `<div class="journal-grid"><div class="journal-stat"><span>Route Tone</span><strong>${tone}</strong></div><div class="journal-stat"><span>Plan</span><strong>${risk}</strong></div><div class="journal-stat"><span>Trust</span><strong>${truth}</strong></div><div class="journal-stat"><span>Body</span><strong class="meter">${body}</strong></div></div><div class="relation-row" aria-label="Relations">${relationRows}</div><h4>Gathered Ingredients</h4><ul class="inventory-ledger">${inventoryRows}</ul>`;
    ui.inventory.innerHTML = inventoryHtml;
    if (ui.companionInventory) ui.companionInventory.innerHTML = inventoryHtml;
    ui.book.innerHTML = `<div class="recipe-spread">${state.recipeBook
      .map((recipe, index) => {
        const note = recipeNotes[recipe] || { world: "Unknown World", scar: "blank margin", cost: "unknown" };
        return `<article class="recipe-card recipe-card-${index % 4}"><span class="recipe-index">0${index + 1}</span><h4>${recipe}</h4><p>${note.world}</p><dl><dt>Scar</dt><dd>${note.scar}</dd><dt>Cost</dt><dd>${note.cost}</dd></dl></article>`;
      })
      .join("")}</div>`;
  }

  function setDetailsPanelState(tab) {
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

  function syncWorldCompanionVisibility(state) {
    if (!ui.worldCompanion) return;
    ui.worldCompanion.hidden = !(desktopWorldHud.matches && state.activeTab !== "worlds");
  }

  function setActiveTab(state, tabName, shouldPersist = true) {
    state.activeTab = TAB_LAYOUT[tabName] ? tabName : "cafe";

    ui.tabBar.querySelectorAll(".tab-btn").forEach((button) => {
      const isActive = button.dataset.tab === state.activeTab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    TABBABLE_SECTIONS.forEach((section) => setPanelVisibility(section, false));
    TAB_LAYOUT[state.activeTab].forEach((section) => setPanelVisibility(section, true));
    syncWorldCompanionVisibility(state);
    setDetailsPanelState(state.activeTab);
    if (shouldPersist) save(state);
  }

  function renderScene(state) {
    clearError();
    const node = GAME_DATA[state.current];

    if (!node) {
      showError(`Scene '${state.current}' is missing. Use Reset Save to recover.`);
      ui.scenePanel.innerHTML = "<h2>Scene Load Failure</h2><p>We couldn't find this scene ID in game data.</p>";
      return;
    }

    applyOnEnter(state, node);
    save(state);

    ui.progress.textContent = node.end ? "TODAY'S SPECIAL\nStory complete" : "TODAY'S SPECIAL\nHoney\nDream\nLatte";
    renderCharacterPortrait(state, node);

    const tagsHtml = (node.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("");
    const choicesHtml = (node.choices || [])
      .map((choice, index) => `<button class="choice" data-choice="${index}"><span class="choice-mark" aria-hidden="true"></span><span>${choice.label}</span></button>`)
      .join("");

    ui.scenePanel.innerHTML = `<div class="scene-meta"><h2>${node.location}</h2><div class="tags">${tagsHtml}</div></div><div class="speaker-label">${node.speaker}</div><div class="dialogue-text">${node.text}</div><div class="dialogue-stamp" aria-hidden="true"></div><div class="choices">${choicesHtml || "<div class='mini'>The shift is over. Use Start New to replay.</div>"}</div>`;

    renderStatus(state, node);
    renderStats(state);
    setActiveTab(state, state.activeTab, false);

    ui.scenePanel.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-choice"));
        const selectedChoice = node.choices?.[index];
        if (!selectedChoice) {
          showError("Choice data is missing for this scene.");
          return;
        }

        applyEffects(state, selectedChoice.effects);
        state.started = true;
        state.current = selectedChoice.next;
        save(state);
        renderScene(state);
      });
    });
  }

  let state = load();

  function wireTabKeyboardNavigation(state) {
    const tabButtons = Array.from(ui.tabBar.querySelectorAll(".tab-btn"));
    tabButtons.forEach((button, index) => {
      button.addEventListener("keydown", (event) => {
        const isHorizontalNav = ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key);
        if (!isHorizontalNav) return;
        event.preventDefault();

        let nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabButtons.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabButtons.length - 1;

        const nextButton = tabButtons[nextIndex];
        nextButton.focus();
        setActiveTab(state, nextButton.dataset.tab);
      });
    });
  }

  ui.themeToggle.addEventListener("click", () => {
    state.uiTheme = state.uiTheme === "high-contrast" ? "default" : "high-contrast";
    document.body.dataset.theme = state.uiTheme;
    ui.themeToggle.setAttribute("aria-pressed", String(state.uiTheme === "high-contrast"));
    save(state);
  });

  ui.tabBar.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(state, button.dataset.tab));
  });

  wireTabKeyboardNavigation(state);
  desktopWorldHud.addEventListener("change", () => setActiveTab(state, state.activeTab, false));

  ui.startBtn.addEventListener("click", () => {
    state = defaultState();
    state.started = true;
    state.current = "title";
    save(state);
    renderScene(state);
  });

  ui.continueBtn.addEventListener("click", () => {
    state = load();
    renderScene(state);
  });

  ui.resetBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    renderScene(state);
  });

  document.body.dataset.theme = state.uiTheme;
  ui.themeToggle.setAttribute("aria-pressed", String(state.uiTheme === "high-contrast"));
  renderScene(state);
}
