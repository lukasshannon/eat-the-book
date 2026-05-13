const SUPPORTED_CHOICE_EFFECT_KEYS = new Set(["flags", "relation", "addItems"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function describePath(path) {
  return path.join(".");
}

function validateKeyedObject(value, path, errors, keyLabel) {
  if (!isRecord(value)) {
    errors.push(`${describePath(path)} must be an object.`);
    return;
  }

  Object.keys(value).forEach((key) => {
    if (!isNonEmptyString(key)) {
      errors.push(`${describePath(path)} contains an empty ${keyLabel}.`);
    }
  });
}

function validateRelationMap(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${describePath(path)} must be an object.`);
    return;
  }

  Object.entries(value).forEach(([characterId, delta]) => {
    if (!isNonEmptyString(characterId)) {
      errors.push(`${describePath(path)} contains an empty character ID.`);
    }

    if (typeof delta !== "number" || !Number.isFinite(delta)) {
      errors.push(`${describePath([...path, characterId])} must be a finite number.`);
    }
  });
}

function validateStringList(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${describePath(path)} must be an array.`);
    return;
  }

  value.forEach((entryValue, index) => {
    if (!isNonEmptyString(entryValue)) {
      errors.push(`${describePath([...path, index])} must be a non-empty string.`);
    }
  });
}

function validateEffects(effects, sceneId, choiceIndex, errors) {
  const path = ["scene", sceneId, "choice", choiceIndex, "effects"];

  if (!isRecord(effects)) {
    errors.push(`${describePath(path)} must be an object when present.`);
    return;
  }

  Object.keys(effects).forEach((effectKey) => {
    if (!SUPPORTED_CHOICE_EFFECT_KEYS.has(effectKey)) {
      errors.push(
        `${describePath([...path, effectKey])} is not supported. Supported effect keys: ${Array.from(
          SUPPORTED_CHOICE_EFFECT_KEYS,
        ).join(", ")}.`,
      );
    }
  });

  if (Object.hasOwn(effects, "flags")) validateKeyedObject(effects.flags, [...path, "flags"], errors, "flag name");
  if (Object.hasOwn(effects, "relation")) validateRelationMap(effects.relation, [...path, "relation"], errors);
  if (Object.hasOwn(effects, "addItems")) validateStringList(effects.addItems, [...path, "addItems"], errors);
}

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

export function validateGameData(rawCharacters, rawScenes) {
  const errors = [];

  if (!isRecord(rawCharacters)) {
    errors.push("characters.json must contain an object keyed by character ID.");
  }

  if (!isRecord(rawScenes)) {
    errors.push("scenes.json must contain an object keyed by scene ID.");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid game data:\n- ${errors.join("\n- ")}`);
  }

  Object.entries(rawCharacters).forEach(([characterId, character]) => {
    if (!isNonEmptyString(characterId)) {
      errors.push("characters.json contains an empty character ID.");
      return;
    }

    const normalized = normalizeCharacter(characterId, character);

    if (!isNonEmptyString(normalized.name)) {
      errors.push(`character '${characterId}' has no usable name after normalization.`);
    }

    if (!isNonEmptyString(normalized.portrait)) {
      errors.push(`character '${characterId}' has no usable portrait after normalization.`);
    }

    if (!isNonEmptyString(normalized.emotion)) {
      errors.push(`character '${characterId}' has no usable emotion after normalization.`);
    }
  });

  Object.entries(rawScenes).forEach(([sceneId, node]) => {
    if (!isNonEmptyString(sceneId)) {
      errors.push("scenes.json contains an empty scene ID.");
      return;
    }

    if (!isRecord(node)) {
      errors.push(`scene '${sceneId}' must be an object.`);
      return;
    }

    if (!isNonEmptyString(node.location)) {
      errors.push(`scene '${sceneId}' location must be a non-empty string.`);
    }

    if (!isNonEmptyString(node.speaker)) {
      errors.push(`scene '${sceneId}' speaker must be a non-empty known character ID.`);
    } else if (!Object.hasOwn(rawCharacters, node.speaker)) {
      errors.push(`scene '${sceneId}' speaker '${node.speaker}' is not defined in characters.json.`);
    }

    if (!isNonEmptyString(node.text)) {
      errors.push(`scene '${sceneId}' text must be a non-empty string.`);
    }

    if (Object.hasOwn(node, "choices")) {
      if (!Array.isArray(node.choices)) {
        errors.push(`scene '${sceneId}' choices must be an array when present.`);
      } else {
        node.choices.forEach((choice, choiceIndex) => {
          if (!isRecord(choice)) {
            errors.push(`scene '${sceneId}' choice ${choiceIndex} must be an object.`);
            return;
          }

          if (!isNonEmptyString(choice.label)) {
            errors.push(`scene '${sceneId}' choice ${choiceIndex} label must be a non-empty string.`);
          }

          if (!isNonEmptyString(choice.next)) {
            errors.push(`scene '${sceneId}' choice ${choiceIndex} next must be a non-empty scene ID.`);
          } else if (!Object.hasOwn(rawScenes, choice.next)) {
            errors.push(`scene '${sceneId}' choice ${choiceIndex} next '${choice.next}' is not defined in scenes.json.`);
          }

          if (Object.hasOwn(choice, "effects")) {
            validateEffects(choice.effects, sceneId, choiceIndex, errors);
          }
        });
      }
    }
  });

  if (errors.length > 0) {
    throw new Error(`Invalid game data:\n- ${errors.join("\n- ")}`);
  }
}

async function readJson(path, label) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Unable to load ${label} (${response.status}).`);
  }

  return response.json();
}

export async function loadGameData() {
  const [rawCharacters, rawScenes] = await Promise.all([
    readJson("./static/data/characters.json", "characters"),
    readJson("./static/data/scenes.json", "scenes"),
  ]);

  validateGameData(rawCharacters, rawScenes);

  const characters = Object.fromEntries(
    Object.entries(rawCharacters).map(([characterId, character]) => [
      characterId,
      normalizeCharacter(characterId, character),
    ]),
  );

  const scenes = Object.fromEntries(
    Object.entries(rawScenes).map(([sceneId, node]) => {
      const character = characters[node.speaker];

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
