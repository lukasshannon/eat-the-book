export function initGame() {
const STORAGE_KEY = "eat-the-book-vertical-slice-v1";

const CHARACTERS = {
  keeper: "Keeper",
  you: "You",
  orchard: "Orchard Child",
  raincoat: "Raincoat Child",
  mirror: "Mirror Child",
  villain: "Ashen Guest",
};

const GAME_DATA = {
  title: {
    location: "Title Screen",
    speaker: CHARACTERS.keeper,
    text: "Welcome back to the Quiet Café. Tonight you can save one drowning world—or leave it hungry.",
    tags: ["Hub", "Choice", "Auto-save"],
    choices: [
      { label: "Begin shift", next: "cafe_intro" }
    ]
  },
  cafe_intro: {
    location: "Quiet Café",
    speaker: CHARACTERS.you,
    text: "Three children wait beside a scarred page: orchard straw, rain-salt, and mirrored ash.",
    tags: ["Location 1", "Dialogue"],
    onEnter: { addBook: ["Orchard Porridge", "Tide Broth"] },
    choices: [
      {
        label: "Promise protection first",
        next: "cafe_plan",
        effects: { flags: { protective: true }, relation: { raincoat: 1 } }
      },
      {
        label: "Promise balance first",
        next: "cafe_plan",
        effects: { flags: { protective: false }, relation: { mirror: 1 } }
      }
    ]
  },
  cafe_plan: {
    location: "Quiet Café",
    speaker: CHARACTERS.raincoat,
    text: "The drowned village is calling. Brew fast and risky, or slow and careful?",
    tags: ["Location 1", "Branching"],
    choices: [
      {
        label: "Brew fast (higher risk, extra yield)",
        next: "orchard_gate",
        effects: { flags: { riskyPlan: true }, addItems: ["hot kettle coal"] }
      },
      {
        label: "Brew carefully (safer route)",
        next: "orchard_gate",
        effects: { flags: { riskyPlan: false }, addItems: ["stable broth base"] }
      }
    ]
  },
  orchard_gate: {
    location: "Ruined Orchard",
    speaker: CHARACTERS.orchard,
    text: "Lantern scarecrows patrol the hedges. Wear the disguise correctly, or sprint half-finished?",
    tags: ["Location 2", "Stealth"],
    onEnter: { addBook: ["Scarecrow Stitch"] },
    choices: [
      {
        label: "Stitch disguise fully",
        next: "drowned_entry",
        effects: { flags: { disguiseChecked: true }, addItems: ["grave-honey", "blighted apple milk"] }
      },
      {
        label: "Rush half-masked",
        next: "drowned_entry",
        effects: { flags: { disguiseChecked: false, limbInjury: true }, addItems: ["grave-honey"] }
      }
    ]
  },
  drowned_entry: {
    location: "Drowned Village",
    speaker: CHARACTERS.raincoat,
    text: "Water climbs the chapel stairs. One cellar is safe, one is rich with ingredients but watched.",
    tags: ["Location 3", "Gathering"],
    choices: [
      {
        label: "Take safe cellar",
        next: "mirror_chamber",
        effects: { flags: { extraIngredients: false }, addItems: ["shell salt"] }
      },
      {
        label: "Raid rich cellar",
        next: "mirror_chamber",
        effects: { flags: { extraIngredients: true }, addItems: ["shell salt", "drowned roots", "pale seaweed"] }
      }
    ]
  },
  mirror_chamber: {
    location: "Glass Refuge",
    speaker: CHARACTERS.mirror,
    text: "Your reflection splits: reveal the true cost to the child, or hide the injuries and fear?",
    tags: ["Location 4", "Trust"],
    choices: [
      {
        label: "Tell the truth",
        next: "kitchen_return",
        effects: { flags: { sharedTruth: true }, relation: { orchard: 1, mirror: 1 } }
      },
      {
        label: "Hide the burden",
        next: "kitchen_return",
        effects: { flags: { sharedTruth: false }, relation: { raincoat: 1 } }
      }
    ]
  },
  kitchen_return: {
    location: "Kitchen of Fate",
    speaker: CHARACTERS.villain,
    text: "A bitter guest blocks the stove. " +
      "\"Feed the baby and keep the machine, or starve the machine and keep your hands clean?\"",
    tags: ["Final Choice", "Ending Branch"],
    onEnter: { addBook: ["Kitchen Oath"] },
    choices: [
      {
        label: "Feed the baby-sun",
        next: "ending_feed",
        effects: { flags: { choseFeed: true }, addItems: ["new sun ember"] }
      },
      {
        label: "Refuse the ritual",
        next: "ending_refuse",
        effects: { flags: { choseFeed: false } }
      }
    ]
  },
  ending_feed: {
    location: "Quiet Café, Dawn",
    speaker: CHARACTERS.keeper,
    text: "The baby-sun wakes. The village drains, the orchard warms, and the children keep your name in the book margins.",
    tags: ["Ending"],
    end: true
  },
  ending_refuse: {
    location: "Quiet Café, Dusk",
    speaker: CHARACTERS.keeper,
    text: "You deny the ritual. No world heals tonight, but the machine cracks and a new path opens with no recipe commands.",
    tags: ["Ending"],
    end: true
  }
};

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
};

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
  };
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, flags: { ...defaultState().flags, ...(parsed.flags || {}) } };
  } catch (err) {
    showError("Save file is corrupted. Starting fresh.");
    return defaultState();
  }
}

function showError(message) {
  ui.errorBox.style.display = "block";
  ui.errorBox.textContent = `Error: ${message}`;
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
    Object.entries(effects.flags).forEach(([k, v]) => {
      state.flags[k] = v;
    });
  }
  if (effects.relation) {
    Object.entries(effects.relation).forEach(([k, v]) => {
      state.relation[k] = (state.relation[k] || 0) + v;
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

function renderStats(state) {
  const tone = state.flags.protective ? "Protective" : "Balanced";
  const risk = state.flags.riskyPlan ? "Risky Brew" : "Careful Brew";
  const truth = state.flags.sharedTruth ? "Truth Shared" : "Truth Hidden";
  const body = state.flags.limbInjury ? "Injured" : "Whole";
  ui.stats.innerHTML = `
    <p><strong>Route Tone:</strong> ${tone}</p>
    <p><strong>Plan:</strong> ${risk}</p>
    <p><strong>Trust:</strong> ${truth}</p>
    <p><strong>Body:</strong> <span class="meter">${body}</span></p>
    <p><strong>Relations:</strong> Orchard ${state.relation.orchard}, Raincoat ${state.relation.raincoat}, Mirror ${state.relation.mirror}</p>
  `;

  const slots = state.inventory.slice(-4);
  const padded = [...slots];
  while (padded.length < 4) padded.push("+");
  ui.inventory.innerHTML = padded
    .map((item) => `<div class="inv-slot">${item}</div>`)
    .join("");

  ui.book.innerHTML = `<ul>${state.recipeBook.map((r) => `<li>${r}</li>`).join("")}</ul>`;
}

function renderScene(state) {
  clearError();
  const node = GAME_DATA[state.current];
  if (!node) {
    showError(`Scene '${state.current}' is missing. Use Reset Save to recover.`);
    ui.scenePanel.innerHTML = `<h2>Scene Load Failure</h2><p>We couldn't find this scene ID in game data.</p>`;
    return;
  }

  applyOnEnter(state, node);
  save(state);

  ui.progress.textContent = node.end
    ? "Today's Special: Story complete. Restart for a fresh shift."
    : `Today's Special: ${node.location}`;

  const choicesHtml = (node.choices || [])
    .map((choice, i) => `<button class="choice" data-choice="${i}">${choice.label}</button>`)
    .join("");

  ui.scenePanel.innerHTML = `
    <h2>${node.location}</h2>
    <div class="tags">${(node.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
    <div class="speaker-label">${node.speaker}</div>
    <div class="dialogue-text">${node.text}</div>
    <div class="choices">${choicesHtml || "<div class='mini'>The shift is over. Use Start New to replay.</div>"}</div>
  `;

  renderStats(state);

  ui.scenePanel.querySelectorAll("[data-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.getAttribute("data-choice"));
      const selected = node.choices?.[index];
      if (!selected) {
        showError("Choice data is missing for this scene.");
        return;
      }
      applyEffects(state, selected.effects);
      state.started = true;
      state.current = selected.next;
      save(state);
      renderScene(state);
    });
  });
}

let state = load();

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

renderScene(state);

    
}
