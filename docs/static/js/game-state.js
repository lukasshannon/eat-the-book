import { STORAGE_KEY, TAB_ORDER } from "./constants.js";

export function defaultState() {
  return {
    current: "cafe_intro",
    started: false,
    flags: {
      protective: false,
      riskyPlan: false,
      sharedTruth: false,
      disguiseChecked: false,
      extraIngredients: false,
      limbInjury: false,
      openedRecipeBook: false,
      choseRouteQuestion: false,
    },
    relation: { keeper: 0, ghostChild: 0 },
    inventory: [],
    recipeBook: ["Café Starter"],
    visited: {},
    uiTheme: "default",
    activeTab: "cafe",
  };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function asPlainObject(value, fallback) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fallback;

  return value;
}

function asArray(value, fallback) {
  return Array.isArray(value) ? value : fallback;
}

function asBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

function asKnownString(value, fallback, allowedValues) {
  return allowedValues.includes(value) ? value : fallback;
}

function keepStrings(items) {
  return items.filter((item) => typeof item === "string");
}

export function loadState({ onCorrupt } = {}) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw);
    const fallback = defaultState();
    let usedFallback = false;

    function validate(value, fallbackValue, normalizer) {
      const normalized = normalizer(value, fallbackValue);
      if (normalized === fallbackValue && value !== undefined) usedFallback = true;
      return normalized;
    }

    function validateStringArray(value, fallbackValue) {
      const array = validate(value, fallbackValue, asArray);
      if (array === fallbackValue) return array;

      const strings = keepStrings(array);
      if (strings.length !== array.length) usedFallback = true;
      return strings;
    }

    const safeParsed = validate(parsed, {}, asPlainObject);
    const state = {
      ...fallback,
      current: validate(safeParsed.current, fallback.current, asString),
      started: validate(safeParsed.started, fallback.started, asBoolean),
      flags: {
        ...fallback.flags,
        ...validate(safeParsed.flags, fallback.flags, asPlainObject),
      },
      relation: {
        ...fallback.relation,
        ...validate(safeParsed.relation, fallback.relation, asPlainObject),
      },
      inventory: validateStringArray(safeParsed.inventory, fallback.inventory),
      recipeBook: validateStringArray(safeParsed.recipeBook, fallback.recipeBook),
      visited: validate(safeParsed.visited, fallback.visited, asPlainObject),
      uiTheme: validate(safeParsed.uiTheme, fallback.uiTheme, (value, fallbackValue) =>
        asKnownString(value, fallbackValue, ["default", "high-contrast"]),
      ),
      activeTab: validate(safeParsed.activeTab, fallback.activeTab, (value, fallbackValue) =>
        asKnownString(value, fallbackValue, TAB_ORDER),
      ),
    };

    if (usedFallback) onCorrupt?.(new Error("Save file contains invalid data. Falling back to defaults."));

    return state;
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

  const relationEffects = effects.relation || effects.relationship;

  if (relationEffects) {
    Object.entries(relationEffects).forEach(([key, value]) => {
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
