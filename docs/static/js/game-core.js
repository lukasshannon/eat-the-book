import { loadGameData } from "./game-data.js";
import { applyEffects, applyOnEnter, defaultState, loadState, resetSave, saveState } from "./game-state.js";
import { clearError, collectUi, showError } from "./ui-dom.js";
import {
  createTabLayout,
  renderCharacterPortrait,
  renderProgressNote,
  renderSceneContent,
  renderStats,
  renderStatus,
  setActiveTab,
  syncTheme,
} from "./ui-render.js";

export async function initGame() {
  const desktopWorldHud = window.matchMedia("(min-width: 981px)");
  const ui = collectUi();
  const tabLayout = createTabLayout(ui);
  const { scenes } = await loadGameData();
  let state = loadState({
    onCorrupt: () => showError(ui, "Save file is corrupted. Starting fresh."),
  });

  function persist(nextState) {
    saveState(nextState);
  }

  function activateTab(tabName, shouldPersist = true) {
    setActiveTab(ui, tabLayout, desktopWorldHud, state, tabName, persist, shouldPersist);
  }

  function renderScene() {
    clearError(ui);
    const node = scenes[state.current];

    if (!node) {
      showError(ui, `Scene '${state.current}' is missing. Use Reset Save to recover.`);
      ui.scenePanel.innerHTML = "<h2>Scene Load Failure</h2><p>We couldn't find this scene ID in game data.</p>";
      return;
    }

    applyOnEnter(state, node);
    persist(state);

    renderProgressNote(ui, state, node);
    renderCharacterPortrait(ui, state, node);
    renderSceneContent(ui, node);
    renderStatus(ui, state, node);
    renderStats(ui, state);
    activateTab(state.activeTab, false);

    ui.scenePanel.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-choice"));
        const selectedChoice = node.choices?.[index];

        if (!selectedChoice) {
          showError(ui, "Choice data is missing for this scene.");
          return;
        }

        applyEffects(state, selectedChoice.effects);
        state.started = true;
        state.current = selectedChoice.next;
        persist(state);
        renderScene();
      });
    });
  }

  function wireTabKeyboardNavigation() {
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
        activateTab(nextButton.dataset.tab);
      });
    });
  }

  ui.themeToggle.addEventListener("click", () => {
    state.uiTheme = state.uiTheme === "high-contrast" ? "default" : "high-contrast";
    syncTheme(ui, state);
    persist(state);
  });

  ui.tabBar.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  wireTabKeyboardNavigation();
  desktopWorldHud.addEventListener("change", () => activateTab(state.activeTab, false));

  ui.startBtn.addEventListener("click", () => {
    state = defaultState();
    state.started = true;
    state.current = "title";
    persist(state);
    renderScene();
  });

  ui.continueBtn.addEventListener("click", () => {
    state = loadState({
      onCorrupt: () => showError(ui, "Save file is corrupted. Starting fresh."),
    });
    renderScene();
  });

  ui.resetBtn.addEventListener("click", () => {
    resetSave();
    state = defaultState();
    renderScene();
  });

  syncTheme(ui, state);
  renderScene();
}
