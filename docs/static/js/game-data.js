const SUPPORTED_CHOICE_EFFECT_KEYS = new Set(["flags", "relation", "relationship", "addItems"]);

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
    if (!isNonEmptyString(key)) errors.push(`${describePath(path)} contains an empty ${keyLabel}.`);
  });
}

function validateRelationMap(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${describePath(path)} must be an object.`);
    return;
  }

  Object.entries(value).forEach(([characterId, delta]) => {
    if (!isNonEmptyString(characterId)) errors.push(`${describePath(path)} contains an empty character ID.`);
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
    if (!isNonEmptyString(entryValue)) errors.push(`${describePath([...path, index])} must be a non-empty string.`);
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
      errors.push(`${describePath([...path, effectKey])} is not supported.`);
    }
  });

  if (Object.hasOwn(effects, "flags")) validateKeyedObject(effects.flags, [...path, "flags"], errors, "flag name");
  if (Object.hasOwn(effects, "relation")) validateRelationMap(effects.relation, [...path, "relation"], errors);
  if (Object.hasOwn(effects, "relationship")) validateRelationMap(effects.relationship, [...path, "relationship"], errors);
  if (Object.hasOwn(effects, "addItems")) validateStringList(effects.addItems, [...path, "addItems"], errors);
}

function normalizeCharacter(characterId, scene, rawCharacters) {
  const fallback = rawCharacters[characterId] || {};
  return {
    name: scene.speakerName || fallback.name || characterId,
    portrait: fallback.portrait || characterId,
    emotion: scene.emotionKey || fallback.emotion || "neutral",
  };
}

function validateChoice(choice, choiceIndex, sceneId, sceneIds, errors) {
  if (!isRecord(choice)) {
    errors.push(`scene '${sceneId}' choice ${choiceIndex} must be an object.`);
    return;
  }

  if (!isNonEmptyString(choice.label)) errors.push(`scene '${sceneId}' choice ${choiceIndex} label must be a non-empty string.`);
  if (!isNonEmptyString(choice.nextNodeId)) {
    errors.push(`scene '${sceneId}' choice ${choiceIndex} nextNodeId must be a non-empty scene ID.`);
  } else if (!sceneIds.has(choice.nextNodeId)) {
    errors.push(`scene '${sceneId}' choice ${choiceIndex} nextNodeId '${choice.nextNodeId}' is not defined.`);
  }

  if (!Array.isArray(choice.conditions)) errors.push(`scene '${sceneId}' choice ${choiceIndex} conditions must be an array.`);
  if (Object.hasOwn(choice, "effects")) validateEffects(choice.effects, sceneId, choiceIndex, errors);
}

function validateStoryData(rawStory) {
  const errors = [];

  if (!isRecord(rawStory) || !Array.isArray(rawStory.scenes)) {
    throw new Error("Invalid story data:\n- story/dialogue.json must contain a scenes array.");
  }

  const sceneIds = new Set();
  rawStory.scenes.forEach((scene, index) => {
    if (!isRecord(scene)) {
      errors.push(`scene ${index} must be an object.`);
      return;
    }

    if (!isNonEmptyString(scene.sceneId)) errors.push(`scene ${index} sceneId must be a non-empty string.`);
    else if (sceneIds.has(scene.sceneId)) errors.push(`scene '${scene.sceneId}' is duplicated.`);
    else sceneIds.add(scene.sceneId);
  });

  rawStory.scenes.forEach((scene) => {
    if (!isRecord(scene) || !isNonEmptyString(scene.sceneId)) return;
    const sceneId = scene.sceneId;

    if (!isNonEmptyString(scene.characterId)) errors.push(`scene '${sceneId}' characterId must be a non-empty string.`);
    if (!isNonEmptyString(scene.speakerName)) errors.push(`scene '${sceneId}' speakerName must be a non-empty string.`);
    if (!isNonEmptyString(scene.emotionKey)) errors.push(`scene '${sceneId}' emotionKey must be a non-empty string.`);
    if (!isNonEmptyString(scene.dialogueText)) errors.push(`scene '${sceneId}' dialogueText must be a non-empty string.`);
    if (!Array.isArray(scene.labels)) errors.push(`scene '${sceneId}' labels must be an array.`);
    if (!Array.isArray(scene.conditions)) errors.push(`scene '${sceneId}' conditions must be an array.`);
    if (!isRecord(scene.effects)) errors.push(`scene '${sceneId}' effects must be an object.`);
    if (!Array.isArray(scene.choices)) errors.push(`scene '${sceneId}' choices must be an array.`);
    else scene.choices.forEach((choice, choiceIndex) => validateChoice(choice, choiceIndex, sceneId, sceneIds, errors));
  });

  if (errors.length > 0) throw new Error(`Invalid story data:\n- ${errors.join("\n- ")}`);
}

function normalizeScenes(rawStory, rawCharacters) {
  return Object.fromEntries(
    rawStory.scenes.map((scene) => {
      const character = normalizeCharacter(scene.characterId, scene, rawCharacters);
      const tags = [...(scene.labels || []), ...(scene.worldTags || []), ...(scene.chapterTags || [])];

      return [
        scene.sceneId,
        {
          id: scene.sceneId,
          location: scene.labels?.[0] || "Café",
          speakerId: scene.characterId,
          speaker: scene.speakerName,
          text: scene.dialogueText,
          tags,
          conditions: scene.conditions || [],
          effects: scene.effects || {},
          worldTags: scene.worldTags || [],
          chapterTags: scene.chapterTags || [],
          onEnter: scene.onEnter,
          choices: scene.choices.map((choice) => ({
            label: choice.label,
            next: choice.nextNodeId,
            conditions: choice.conditions,
            effects: choice.effects || {},
          })),
          portrait: character.portrait,
          portraitEmotion: character.emotion,
        },
      ];
    }),
  );
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return response.json();
}

export async function loadGameData() {
  const [rawCharacters, rawStory] = await Promise.all([
    fetchJson("./static/data/characters.json"),
    fetchJson("./static/data/story/dialogue.json"),
  ]);

  validateStoryData(rawStory);

  return { scenes: normalizeScenes(rawStory, rawCharacters), characters: rawCharacters };
}
