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
  "coverSettingsBtn",
  "notebookShell",
  "bookCover",
  "bookPages",
  "characters",
  "charactersPanel",
  "settingsPanel",
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
  return Object.fromEntries(requiredElementIds.map((id) => [id, requireElement(id)]));
}

export function showError(ui, message) {
  ui.errorBox.style.display = "block";
  ui.errorBox.textContent = `Error: ${message}`;
}

export function clearError(ui) {
  ui.errorBox.style.display = "none";
  ui.errorBox.textContent = "";
}
