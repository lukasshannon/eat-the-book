import { loadGameData } from "./game-data.js";
import { applyEffects, applyOnEnter, defaultState, loadState, resetSave, saveState } from "./game-state.js";
import { clearError, collectUi, showError } from "./ui-dom.js";
import {
  animateBookOpen,
  createTabLayout,
  renderCharacterPortrait,
  renderProgressNote,
  renderSceneContent,
  renderStats,
  renderStatus,
  setActiveTab,
  syncBookMode,
  syncTheme,
} from "./ui-render.js";

export async function initGame() {
  const desktopWorldHud = window.matchMedia("(min-width: 981px)");
  const ui = collectUi();
  const tabLayout = createTabLayout(ui);
  const { scenes, notebookSamples } = await loadGameData();
  let state = loadState({
    onCorrupt: () => showError(ui, "Save file is corrupted. Starting fresh."),
  });

  function persist(nextState) {
    saveState(nextState);
  }

  function activateTab(tabName, shouldPersist = true) {
    setActiveTab(ui, tabLayout, desktopWorldHud, state, tabName, persist, shouldPersist);
  }

  function revealBook(tabName = state.activeTab) {
    const wasClosed = !state.started;
    state.started = true;
    activateTab(tabName, false);
    persist(state);
    if (wasClosed) animateBookOpen(ui);
    syncBookMode(ui, state);
  }

  function renderScene() {
    clearError(ui);
    const node = scenes[state.current];

    if (!node) {
      showError(ui, `Scene '${state.current}' is missing. Use Reset Save to recover.`);
      ui.scenePanel.innerHTML = "<h2>Scene Load Failure</h2><p>We couldn't find this scene ID in story data.</p>";
      syncBookMode(ui, state);
      return;
    }

    applyOnEnter(state, node);
    persist(state);

    renderProgressNote(ui, state, node);
    renderCharacterPortrait(ui, state, node);
    renderSceneContent(ui, node);
    renderStatus(ui, state, node);
    renderStats(ui, state, notebookSamples);
    syncTheme(ui, state);
    syncBookMode(ui, state);
    activateTab(state.activeTab, false);

    function returnToCafePage() {
      state.started = true;
      state.current = "cafe_intro";
      state.activeTab = "cafe";
      persist(state);
      renderScene();
    }

    ui.scenePanel.querySelector("[data-dialogue-return]")?.addEventListener("click", returnToCafePage);

    ui.scenePanel.querySelectorAll("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-choice"));
        const selectedChoice = node.choices?.[index];

        if (!selectedChoice) {
          returnToCafePage();
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
        const isTabNav = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key);
        if (!isTabNav) return;
        event.preventDefault();

        let nextIndex = index;
        if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (index + 1) % tabButtons.length;
        else if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
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

  ui.coverSettingsBtn.addEventListener("click", () => {
    revealBook("settings");
  });

  ui.tabBar.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  wireTabKeyboardNavigation();
  desktopWorldHud.addEventListener("change", () => activateTab(state.activeTab, false));

  ui.startBtn.addEventListener("click", () => {
    state = defaultState();
    state.started = true;
    state.current = "cafe_intro";
    state.activeTab = "cafe";
    persist(state);
    renderScene();
    animateBookOpen(ui);
  });

  ui.continueBtn.addEventListener("click", () => {
    state = loadState({
      onCorrupt: () => showError(ui, "Save file is corrupted. Starting fresh."),
    });
    if (!state.started) state.started = true;
    renderScene();
    animateBookOpen(ui);
  });

  ui.resetBtn.addEventListener("click", () => {
    resetSave();
    state = defaultState();
    renderScene();
  });

  syncTheme(ui, state);
  renderScene();
}
