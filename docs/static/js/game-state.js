import { STORAGE_KEY } from "./constants.js";

export function defaultState() {
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

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState({ onCorrupt } = {}) {
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
    onCorrupt?.(error);
    return defaultState();
  }
}

export function resetSave() {
  localStorage.removeItem(STORAGE_KEY);
}

export function uniquePush(list, items = []) {
  items.forEach((item) => {
    if (!list.includes(item)) list.push(item);
  });
}

export function applyEffects(state, effects = {}) {
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

export function applyOnEnter(state, node) {
  if (state.visited[state.current]) return;

  uniquePush(state.inventory, node.onEnter?.addItems);
  uniquePush(state.recipeBook, node.onEnter?.addBook);
  state.visited[state.current] = true;
}
