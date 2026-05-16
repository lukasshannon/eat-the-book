# Eat the Book

## Current runnable UI

The web build in `docs/` opens on a closed book cover. The cover owns the meta menu (`Start`, `Continue / Load`, and `Settings`) so those controls do not appear inside the in-game page. Choosing `Start` resets to the sample opening scene; choosing `Continue / Load` reads local storage; both paths animate the cover open and reveal the notebook interface.

The in-game notebook uses right-edge cardstock tabs instead of a bottom menu. The tab list lives in `docs/index.html` as `#tabBar`, while `docs/static/css/ui/layout.css` and `docs/static/css/ui/responsive.css` keep the tabs inside phone viewports and sized as touch targets. Tab changes call `setActiveTab()` in `docs/static/js/ui-render.js`, which swaps the visible panel and applies a short directional page-slide/page-turn animation. The tab order decides whether the page eases left or right, a brief paper sheen reinforces the turn, and JavaScript skips the animation automatically when `prefers-reduced-motion: reduce` is active.

Runtime dialogue is JSON-driven. Story data lives in `docs/static/data/story/dialogue.json`, and character portrait defaults live in `docs/static/data/characters.json`. `docs/static/js/game-data.js` fetches, validates, and normalizes the JSON into renderable scene nodes. To add a scene, add an object to the `scenes` array with `sceneId`, `characterId`, `speakerName`, `emotionKey`, `dialogueText`, `labels`, `conditions`, `effects`, optional `worldTags`/`chapterTags`, and `choices`. Each choice needs `label`, `nextNodeId`, `conditions`, and `effects` such as `flags`, `relationship` deltas, `addItems`, or `addBook`. For dialogue follow-ups, point `nextNodeId` to the exact scene that answers the selected question; use a reciprocal choice such as “Ask the other question” when a node should stay in the conversation, and keep an explicit “Return to the café page” choice when the player should leave the branch. Scene-level `effects` are applied once on first visit, so sample inventory/book changes stay in JSON instead of JavaScript.

The Café dialogue card hides JSON labels and emotion keys behind the small `Details` disclosure rendered by `docs/static/js/ui-render.js`. Open that disclosure while developing to inspect tags and mood data; leave it closed for normal player-facing presentation. Dialogue response nodes also get an in-card `← Café page` return button, and no-choice data nodes fall back to the same café return behavior so the player is never trapped.

The Recipes and Worlds tabs also read sample entries from `notebookSamples` in `docs/static/data/story/dialogue.json`. Add recipe cards under `notebookSamples.recipes` with `id`, `name`, optional `type`, `description`, `ingredients`, `status`, `world`, and optional `aliases` for renamed/legacy recipe IDs; use the same `id` in a scene or choice `addBook` effect to unlock the card. Add world cards under `notebookSamples.worlds` with `id`, `name`, `status`, and `description`. Keep placeholder copy minimal and limited to the confirmed concepts: café outside time, magical Recipe Book, recipes as portals, corrupted worlds, ghost children, branching character routes, baby-suns, and restored/pure ingredients.

On narrow screens, the desktop left-hand intro card is removed from layout and replaced by the `details.mobile-intro` control in `docs/index.html`. CSS in `docs/static/css/ui/responsive.css` keeps that control as a small café icon by default; tapping it expands only the short description so the notebook and right-side tabs remain within the portrait viewport without horizontal scrolling.

Layout acceptance is part of the UI contract: the notebook shell, right-side binder tabs, active dialogue/cards, and mobile intro control must remain inside supported viewports without horizontal scrolling. Dialogue `Details` and `← Café page` controls should shrink or wrap instead of pushing the reading area sideways; JSON recipe/world cards must stay inside their panels; and reduced-motion tab navigation must remain reliable without page-turn classes affecting final layout. Run `node scripts/ui-smoke.mjs` before UI PRs to verify these alignment checks.

Run locally with:

```bash
python3 -m http.server 8000 --directory docs
```

Then open `http://127.0.0.1:8000/`. Before this UI pass, the live GitHub Pages build was checked at a 390×844 mobile viewport for horizontal overflow, readable text, and touch target size. For automated layout and interaction checks, run:

```bash
node scripts/ui-smoke.mjs
```

Deploy by publishing the `docs/` directory through GitHub Pages. This project intentionally uses plain HTML, CSS, JavaScript modules, and JSON for the current UI slice.

## Core concept

A game where you run a quiet café outside time, serving ghosts, failed heroes, and other survivors of broken worlds. Each recipe is more than food: when cooked and eaten, it sends you into a corrupted version of a lost world to gather ingredients, uncover memories, and restore what fate ruined.

## UI implementation notes

The browser mockup lives under `docs/`. Its structure, styles, rendering modules, state modules, and verification workflow are documented in [`docs/UI_ARCHITECTURE.md`](docs/UI_ARCHITECTURE.md).


## High Concept

A cozy-horror, character-driven mobile game about running a café outside time, serving ghosts, failed heroes, villains, alternate selves, and survivors of broken worlds.

Recipes are fixed ritual instructions from the Recipe Book, which is secretly the manual used by fate to cook worlds into endings. Cooking and eating a recipe sends the player into a corrupted version of a lost world. There, the player survives through stealth, gathers exact ingredients, restores the world’s unborn ending, and returns to the café with new recipes, new NPCs, and permanent consequences.

The emotional tone is fear and tenderness. Corrupted worlds are dangerous, but not evil. They are sick, hungry, unfinished, and hiding something vulnerable beneath their horror.


### Core Genre

- Cozy-horror adventure
- Visual novel / relationship drama
- Stealth exploration
- Light Terraria-like traversal and ingredient gathering
- Recipe and farming progression
- Postgame identity customization


### Core Themes

- Food as memory

- Sacrifice as the cost of changing endings

- Bodies as identity, access, and vulnerability

- Fate as a culinary system

- Restoration as transformation, not reversal

- Protection versus control

- Brokenness versus unfinishedness

- Identity as something first imposed by consequence, then chosen freely


### Emotional Promise

The player should feel safe in the café, afraid but protective inside corrupted worlds, attached to the ghost children, morally uneasy about sacrifice, and ultimately hopeful.

The ending is hopeful, not tragic. The player’s transformation is release and chosen becoming, not punishment.


## Main Gameplay Loop

1. Talk in the café — visual novel scenes, relationship choices, recipe planning.


2. Choose a recipe — each recipe belongs to a world and has exact requirements.


3. Cook and eat the recipe — eating sends the player into the corresponding corrupted world.


4. Survive through stealth — the player is fragile and human; they hide, run, and avoid pursuit.


5. Find the local monster disguise — once found, the disguise lets the player move freely unless they directly touch monsters and become unmasked.


6. Gather ingredients — corrupted ingredients come from corrupted worlds; pure ingredients come after restoration.


7. Reach the baby at the bottom — every corrupted world hides a baby representing its unborn ending and final hunger.


8. Feed the baby the entry recipe — the baby becomes a sun and the world restores into a peaceful new form.


9. Return to the café — unlock pure ingredients, farming, a pure recipe, and a half-monster ghost child from that world.


10. Repeat with consequences — sacrifices, sabotage, body loss, relationship choices, and recipe scars affect routes.


## Recipes

Recipes are fixed and exact. Substitutions do not work.

The first time a recipe is cooked, its sacrifice is unknown or only hinted. After first use, the Recipe Book records the cost visually through scars on the page rather than plain text.

Possible recipe scars include burns, tears, blood-like ink, missing words, black thread, gray pressed flowers, cracked illustrations, and ghostly fingerprints.


## Cost Tiers

- **Common cost (soul cost):** Helping a ghost requires some sacrifice of spirit, self, closure, or peace.
- **Serious cost (recipe cost):** A recipe may be corrupted, lost, scarred, or changed forever.
- **Highest-stakes cost (world cost):** Saving someone completely may damage, erase, or doom an entire world. This is rare and reserved for major decisions.


## Exploration and Stealth

Inside corrupted worlds, the player is physically vulnerable. The game is not combat-first. The player survives by hiding, running, using disguises, learning patrol patterns, exploiting world-specific cover, and avoiding direct contact with monsters.

Early visits are stealth-focused. After a world is restored, the player can return to:

- the corrupted version in monster form, now able to fight and gather corrupted ingredients;
- the saved version in human or postgame form, able to gather pure ingredients and farm.


## Limb Loss and Body-Swapping

If monsters catch the player, they steal limbs one by one. The tone is cute-horror contrast, not gore.

Examples:

- limbs unscrew like doll parts;
- limbs become wax, straw, ribbon, bread, porcelain, shadow, or cloth;
- monsters tuck stolen limbs away like keepsakes;
- replacement monster limbs are mismatched, floppy, puppet-like, wooden, waxy, or plush.


### Mechanical Effects

- Losing an arm slows gathering and limits carrying.

- Losing both arms blocks certain tools and heavy doors.

- Losing a leg slows movement and weakens jumping.

- Losing both legs forces crawling or dragging.

- Monster replacement limbs restore appearance balance but not full human function.

- Limb loss does not remove memories.


### Body-Swapping

The player’s main magic power is instant body-swapping.

Body-swapping becomes relevant after losing limbs and becomes more useful the more the player has lost. If all limbs are lost, the next capture steals the player’s head and causes a run-ending failure.

When the player swaps with the monster that stole their limbs, the monster enters the player’s old body and tries to escape. The player must chase down and consume their old body to recover body-state, memory, and control.


#### If the Monster Escapes

If a monster escapes in the player’s body:

- it invades the café disguised as the player;

- it sabotages recipes, rooms, ingredients, or NPC trust;

- the current world’s restoration is damaged or delayed;

- some NPC routes and endings may permanently change.

Consequences can be irreversible, but should open alternate routes rather than simply create worse outcomes.


## Monsters

Monsters are both:

1. corrupted residents of failed worlds; and

2. bodiless parasites wearing or hollowing out those residents.

They steal limbs because physicality is scarce and valuable in failed worlds. The player, monsters, and baby-suns are among the only beings with physical bodies there.

When a world is restored, what happens to the original residents varies by world. Some become ghosts, some become peaceful residents, some merge with monster traits, some become part of the landscape or ingredients, and some disappear, leaving recipes and memories behind.

Restoration does not undo the past. It stabilizes the world into a new form.


## Baby-Suns

At the bottom of each corrupted world is a hidden baby.

The baby is:

- the world’s unborn ending;

- the world’s final hunger made physical;

- unfinished, starving, and vulnerable.

Feeding the baby the recipe that brought the player there gives the world the conclusion it has been starving for. The baby becomes a sun, and the world stabilizes.


## Café Hub

The café is not a stressful diner sim. It is a quiet decision space focused on:

- visual novel scenes;

- recipe management;

- relationship routes;

- sacrifice preparation;

- recipe repair;

- route planning;

- consequences from sabotage and world restoration.

The café starts as a refuge but is later revealed to be part of the Kitchen of Fate.


## Recipe Organization

Recipes are organized in three layers.


### By World

Each world has a chapter containing its entry recipe, corrupted ingredients, pure ingredients, restored recipe, known sacrifices, page scars, and associated ghost child NPC.


### By NPC

Major NPCs have bookmarks to recipes tied to their routes, memories, regrets, and sacrifices.


### Physical Recipe Book Map

The Recipe Book is a visual artifact with tabs, stains, scars, repaired tears, burned corners, stitched margins, foldouts, hidden pages, pressed ingredients, and monster fingerprints.


## Relationship Route Types

Each major NPC emphasizes one route type while containing traces of the others.

- **Trust routes:** NPCs remember whether the player’s body harmed them, even if the player was not controlling it.
- **Sacrifice routes:** Close relationships ask what the player is willing to lose.
- **Truth routes:** Characters uncover the player’s identity as the missing wizard.
- **Monster routes:** Half-monster café NPCs explore body horror, transformation, and post-restoration identity.


## Story Escalation


### Act 1

Customers are mostly ghosts and failed heroes.


### Act 2

Villains enter the café. The player learns hero and villain roles are unstable after a world ends.


### Act 3

Alternate-timeline versions of characters appear. The player realizes changing endings has already rewritten lives, deaths, and loyalties.


## Player Character

The player begins as an amnesiac café keeper.

Late in the story, they learn they were once the wizard of a legendary adventuring party. The wizard left the party because a prophecy seemed to say the party could only win if the wizard abandoned them and the party did not know this was the prophecy.

The prophecy was planted by the villain. The party appeared to win, but the prophecy was misread. The victory created the café’s ghostly machinery and exposed the cruelty of fate’s kitchen.


## Villain

The villain planted the prophecy to break fate’s machine. They were not simply trying to defeat the heroes. They wanted to prove prophecy could be corrupted, rewritten, and exploited.

At first, the villain looks like the cause of everything. Later, the player discovers fate’s machine may itself be exploitative, cruel, or artificial. The villain broke it, but may have exposed something already rotten.


## Fate’s Machine

Fate’s machine is culinary.

Worlds are not merely predicted; they are prepared into fixed endings. Prophecies are recipes. Heroes, villains, sacrifices, battles, betrayals, and miracles are ingredients in a cosmic meal.

The Recipe Book is the manual for this system. It contains the actual instructions used to cook worlds into endings.


## Seven Worlds


### World 1 — Ruined Orchard

Theme: Hunger as harvest, care, farming, and first restoration.

A blighted orchard of overgrown hedges, root-tunnels, abandoned sheds, hollow trees, and fruit-shaped horror. This world teaches stealth, disguise, ingredient gathering, baby-sun restoration, and light farming.

Baby-sun recipe: Orchard Porridge
Warm, humble, nursery-like food for a starving world.

Possible ingredients:

- bruised oats;

- blighted apple milk;

- grave-honey;

- ash cinnamon;

- rainwater collected under a dead tree.

Monster disguise: Scarecrow Child
Straw-filled childlike disguise with oversized orchard clothes, button/seed eyes, twig fingers, and root-wrapped boots.

Enemies: Scarecrow-inspired orchard workers: pickers, pruners, collectors, ladder-men, field mothers.

Restored café NPC: Gentle Orchard Child
Cheerful but uncanny. Farming helper and recipe whisperer. Teaches the pure version of Orchard Porridge and introduces crossbreeding.

Farming: Simple plant-wait-harvest loop with optional hybrid ingredients. Example ingredients: Blighted Apple, Sun Apple, Bruised Gold Apple, Cradlefruit.


### World 2 — Drowned Village

Theme: Hunger as drowning, protection, fear, and control.

A flooded settlement of bells, boats, submerged homes, docks, reed beds, cupboards, and air pockets. The village sank before it could say goodbye.

Baby-sun recipe: Tide Broth
Survival food made from what remains when land goes under.

Possible ingredients:

- brinewater from a sealed cellar;

- drowned roots;

- pale seaweed;

- shell salt;

- one warm coal from a stove that should have gone out.

Monster disguise: Fisher Ghost
Oversized raincoat, net cloak, hook-like hands, lantern eyes, waterlogged boots, fish bones, floats, and tackle charms.

Main enemy: Raincoat Mother
A large raincoat-wrapped figure searching for “lost children.” She thinks she is protecting the player. If she catches them, she wraps them inside her coat, where limbs may be stolen or replaced.

Restored café NPC: Raincoat Child
Possessively protective. Warns of danger, reacts strongly to risk and injury, and may hide ingredients or block doors “for your own good.” Teaches the pure version of Tide Broth.


### World 3 — Frozen Chapel Town

Theme: Hunger as prayer, silence, failed form, and unstable embodiment.

A snow-buried chapel town where everything is waxy, rubbery, soft, elastic, gooey, and malleable. The world feels like a trampoline or liminal space falling away.

The tragedy is not that the chapel preserves too much. It is that nothing can stay formed.

Baby-sun recipe: Ash Tea
A bitter ritual drink for mourning what cannot hold its shape.

Possible ingredients:

- chapel ash from an extinguished altar;

- melted bell-snow;

- preserved bitterleaf;

- waxflower petals;

- one ember carried without letting it go out.

Monster disguise: Candle Acolyte
Small chapel robe, wax-drip hands, softly glowing hood-face, soot marks, prayer cords, and little bells.

Main enemy: Melted Abbot
Shape-shifting, gooey, waxy chaplains who stretch, slump, reform, and ooze through the chapel. They are tragic because they cannot remain solid people.

Baby-sun location: Soft Crypt
A sagging, yielding underchapel crypt where tomb architecture has become waxy, rubbery, and unstable.

Restored café NPC: Wax-Saint Child
Serene, soft-spoken, physically unstable. Emotional counselor who helps ghosts stop confusing “broken” with “unfinished.” Teaches the pure version of Ash Tea.


### World 4 — Puppet Opera House

Theme: Role enforcement, staged villainy, control, performance, and delayed consequence.

An opera house of masks, strings, curtains, catwalks, dressing rooms, trapdoors, orchestra pits, spotlight zones, and puppet bodies. The tragedy is being forced to perform yourself incorrectly.

Baby-sun recipe: Encore Omelet
A strange breakfast-like rebirth dish. The egg represents an enclosed unborn thing cracked open into nourishment.

Possible ingredients:

- stage-hen egg;

- spotlight butter;

- curtain-salt;

- dressing-room herbs;

- one cut puppet string;

- applause pepper.

Monster disguise: Stagehand Imp
Small backstage creature with black stage clothes, rope belt, prop tags, hook tools, smudged greasepaint, and wire/cloth horn shapes.

Enemies: Lead Puppeteers, Broken Performers, Audience Mothers, String Collectors, Spotlight Wardens, and Puppets.

Restored café NPC: Broken Puppet Child
Emotionally delayed. Timing / route helper. Notices delayed consequences, unresolved route effects, sabotage that has not fully landed, and recipe costs still appearing.


### World 5 — Glass Desert Palace

Theme: False prophecy, fractured truth, mirage, interpretation, and brittle certainty.

A desert palace of glass, reflections, heat distortion, prophecy shards, mirages, and unsafe beauty. This world did not collapse because it lacked truth. It collapsed because every truth became too sharp and breakable.

Baby-sun recipe: Sun-Curd Custard
Soft, pale, fragile, heat-set, royal, and ceremonial.

Possible ingredients:

- heat-set palace milk;

- mirage citrus;

- sifted glass sugar;

- oasis egg;

- one drop of true water.

Monster disguise: Mirror
A walking reflective form or mirror-frame accepted by the palace. It can stand among mirrors, reflect incorrectly, and pass as décor.

Main enemy: Shattered Oracle
A prophetic figure cracked into contradictory selves, multiple reflected faces, overlapping voices, and fragments of possible futures.

Restored café NPC: Mirror Child
Gentle, observant, overaccommodating, identity-fragile. Route reflector who reveals hidden route splits, missed branches, alternate timelines, and emotional forks.


### World 6 — Companion Graveyard

Theme: Unmourned absence, missing names, blame, grief, and the erased wizard.

A vast graveyard for the hero’s companions, allies, summons, rescued civilians, fallen enemies, and everyone sacrificed around the final victory. Every companion has a grave except the wizard.

The wizard was denied the dignity of being mourned. To the party, they did not die; they abandoned everyone.

Baby-sun recipe: Unmarked Pie
A covered funeral/travel food for someone missing, blamed, or still expected.

Possible ingredients:

- grave apples;

- black funeral flour;

- bitter root filling;

- one unsent farewell;

- crust sealed without a name.

Monster disguise: Empty Cloak
A hanging funeral cloak with no body inside, hood full of darkness or faint grave-light, stitched with mourning thread and grave tags. The player hides inside absence itself.

Main enemy: Name Thief
Meticulous enemies that scrape, peel, or stitch names off graves, memorial plaques, ribbons, weapons, and memory. They edit mourning.

Restored café NPC: Little Name Thief
After restoration, he stops stealing names and begins returning them. He tells the player their true wizard name — but the name and history depend on the player’s choices throughout the game.


#### Generated Name System

The Name Thief reveals a personal name, a ritual title, and a history shaped by the player’s route. Both the personal name and title are generated by choices.

Names should feel religious / ritual, not ordinary.

Identity axes:

- mercy vs control;
- truth vs concealment;
- self-sacrifice vs world-sacrifice;
- humanity vs monsterhood;
- closure vs rewriting;
- trust vs isolation;
- repair vs acceptance.

Example structure:

> “Your name was not stolen cleanly. It grew back crooked. In this telling, you are Maren, the Wizard Who Fed the Wrong Sun.”


### World 7 — The Café Kitchen / Kitchen of Fate

Theme: The final truth: fate’s kitchen is not broken. It is working correctly.

World 7 is not a new distant location. It is the café kitchen itself.

The café kitchen is the Kitchen of Fate — the system that cooks worlds into endings through roles, recipes, sacrifices, and prophecy. The final horror is not malfunction. It is recognition.

The villain did not break fate’s machine. The villain exposed it.

#### Visual Style

World 7’s aesthetic depends on the player’s choices.

Examples:

- care-heavy route: sacred hearth-kitchen;
- sabotage-heavy route: domestic horror;
- monster/body-swap route: childlike nightmare kitchen;
- control-heavy route: industrial fate-machine;
- truth-heavy route: ritual archive-kitchen;
- closure-heavy route: funeral kitchen;
- rewrite-heavy route: unstable cosmic kitchen.

Invariant rule:

> World 7 is the same kitchen, but it shows the player the version of fate they most participated in.


#### Final Stealth / Body-Swap Sequence

World 7 keeps the stealth and body-switch mechanics. The villain becomes the final body-switch target.

The player must:

1. navigate the route-reactive Kitchen of Fate;

2. avoid the villain and kitchen hazards;

3. body-swap with the villain;

4. control the villain’s body;

5. catch the villain, who is now in the player’s body;

6. reach the Recipe Book;

7. eat the Recipe Book.


#### Villain Body Feel

The villain’s body feels wrongly familiar, heavy, slow, starving, and full of fragments of wizard magic.

The player gets a hunger meter while controlling the villain’s body.

Hunger escalation:

1. ingredients;

2. memories;

3. recipe scraps;

4. finally, the Recipe Book itself.

The villain, trapped in the player’s body, reaches the Recipe Book and tries fruitlessly to use it. The book does not respond to the body alone. It needs the wizard’s consent, hunger, and history.

The player catches them and eats the Recipe Book.

#### Final Action

The player does not destroy the book, repair it, or take command of it.

The player eats the Recipe Book.

This means:

- fate’s manual is consumed;

- endings can no longer pretend to be impersonal commands;

- the player digests fate itself;

- sacrifice is no longer automatically demanded by the system.


## Ending

After eating the Recipe Book, the player becomes the final baby-sun.

This reframes the whole game: the player was not only the keeper, not only the missing wizard, but also an unfinished ending.

The player becomes warmth, possibility, and a chosen ending.

### Villain After the Ending

The villain survives in the player’s old body.

In postgame:

- they have no romance route;

- they have no bond route;

- they are defeated and bitter;

- their belly is full;

- they fall asleep on a café couch;

- they sometimes wake up to complain, explain fate mechanics, or criticize recipes.

They are no longer cosmically dangerous. They are a bitter household problem.


### Café Ending

The café’s final state depends on the player’s relationships.

Examples:

- Orchard child dominant: garden-kitchen of care and growth.

- Raincoat child dominant: protective shelter from dangerous endings.

- Wax-saint child dominant: grief-counseling refuge for transformation.

- Puppet child dominant: house of choices and delayed consequences.

- Mirror child dominant: branching doorway of possible routes.

- Name Thief child dominant: refuge for the unnamed and erased.

- Hero/party dominant: memorial tavern where the wizard is finally mourned.

- Villain route dominant: dangerous free kitchen where fate can be challenged.


### Rule:

> The player becomes the sun; the café becomes the shape of what they taught others to do with that light.


## Postgame

Postgame continues after the player becomes the baby-sun.

The player also manifests as a ghost half-monster child shaped by their choices. This child is the playable avatar for postgame farming, crafting, revisiting, and identity work.

The sun-self provides warmth and possibility. The child-self can still cook, farm, explore, and relate.


### Postgame Identity System

Main game identity is generated by consequences. Postgame identity becomes voluntary.

The player can unlock identity recipes that change:

- name;

- ritual title;

- appearance;

- monster traits;

- clothing;

- route presentation;

- dialogue state.

The player can revisit past chapters as these different versions of the character. NPC relationships and dialogue respond accordingly. The player can always return to their original ending state.


### Final Path System

Postgame identity-changing is called the Final Path.

Each postgame identity recipe is linked to one or two alternate routes. To unlock all of them, the player must:

- revisit chapters;

- make different choices;

- collect route-specific memories;

- gather unique ingredients;

- obtain NPC relationship tokens;

- craft the route-form recipe.


### 12 Postgame Route-Forms

There are 12 major route-forms. They are cosmetic, dialogue, and ingredient-focused. They do not heavily alter core movement, stealth, or combat.

1. Orchard Form — care, growth, hunger, farming.

2. Drowned Form — protection, fear, shelter, control.

3. Wax-Saint Form — instability, grief, acceptance.

4. Puppet Form — autonomy, delayed consequence, choice.

5. Mirror Form — reflection, branching, alternate routes.

6. Name-Thief Form — memory, identity, erasure.

7. Hero-Bound Form — loyalty, betrayal, mourning.

8. Villain-Bound Form — fate-breaking, rebellion, risk.

9. Monster-Touched Form — body-swapping, pursuit, stolen flesh.

10. Keeper Form — café, service, recipes, responsibility.

11. Sun-Child Form — hope, warmth, final transformation.

12. Nameless Form — freedom from fixed identity; likely the hardest to unlock.


#### Identity Recipes

The 12 route-forms are unlocked through fixed identity recipes.

Rules:

- Each route-form is a recipe.

- First cooking unlocks the form.

- Later uses are reversible and free.

- Once unlocked, forms can be switched freely.

- The recipes have fixed names.

- Unlocking requires ingredients, world-state materials, memory fragments, and relationship tokens.


### Final Path Bowl

After the player eats the Recipe Book, the Recipe Book stand remains, but the book is gone.

It becomes the Final Path Bowl: a shallow ceramic bowl of liquid sunlight.

Recipes appear as reflections in the bowl, not commands on a page. The player is no longer reading fate’s instructions. They are looking into possible selves.


#### Switching Forms

At the Final Path Bowl:

1. The player selects an unlocked identity recipe.

2. Tiny ingredients appear as reflections in the bowl.

3. The bowl simmers with sunlight.

4. The child-form dissolves into a small sun flare.

5. The flare cools into the new form.

6. The chosen name/title appears briefly, then fades.

This preserves cooking as the core identity of the game and the player’s status as the baby-sun.


### Completion Bonus

After all 12 route-forms are unlocked, the ghost children begin offering rare ingredients from their worlds for free as gifts.

This shows that the café has changed from a fate-machine into a community.


## Design Pillars

1. Every recipe matters — recipes are spells, meals, prophecies, and choices.

2. Every world is wounded, not evil — corruption is hunger, loss, and unfinishedness.

3. Bodies are meaningful — limbs, disguises, body-swaps, and monster forms are identity systems, not just mechanics.

4. Restoration creates new forms — saving a world does not restore the past; it creates a stable future.

5. Sacrifice has consequence — helping ghosts requires cost, but not all costs are final or purely tragic.

6. Identity first emerges from consequence, then becomes choice — the main game reveals who the player has become; the postgame lets them choose who they can be.

7. Hope is earned — the ending is hopeful because it does not deny horror; it digests it.


## UI Smoke Test

Run the notebook UI regression smoke test:

```bash
npm install
npm run test:ui
```

The smoke test serves `docs/` over HTTP, opens `docs/index.html` in Playwright, and verifies tab navigation + theme-toggle accessibility state.

