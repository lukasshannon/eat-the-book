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

  const characters = Object.fromEntries(
    Object.entries(rawCharacters).map(([characterId, character]) => [
      characterId,
      normalizeCharacter(characterId, character),
    ]),
  );

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
