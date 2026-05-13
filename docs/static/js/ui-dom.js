const requiredElementIds = [
  "scenePanel",
  "stats",
  "inventory",
  "book",
  "errorBox",
  "progress",
  "startBtn",
  "continueBtn",
  "resetBtn",
  "chapterValue",
  "chapterLabel",
  "energyValue",
  "coinValue",
  "gemValue",
  "themeToggle",
  "tabBar",
  "worldHud",
  "recipePanel",
  "journalPanel",
  "stealthMeter",
  "worldObjective",
  "sceneCharacterAsset",
  "sceneCharacterName",
];

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required UI element #${id} is missing.`);
  return element;
}

export function collectUi() {
  const ui = Object.fromEntries(requiredElementIds.map((id) => [id, requireElement(id)]));

  return {
    ...ui,
    worldCompanion: document.querySelector(".world-companion"),
    companionStealth: document.querySelector("[data-world-stealth]"),
    companionInventory: document.querySelector("[data-world-inventory]"),
    companionObjective: document.querySelector("[data-world-objective]"),
  };
}

export function showError(ui, message) {
  ui.errorBox.style.display = "block";
  ui.errorBox.textContent = `Error: ${message}`;
}

export function clearError(ui) {
  ui.errorBox.style.display = "none";
  ui.errorBox.textContent = "";
}
