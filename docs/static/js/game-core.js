export async function initGame() {
  const STORAGE_KEY = "eat-the-book-vertical-slice-v1";

  async function loadGameData() {
    const [charactersResponse, scenesResponse] = await Promise.all([
      fetch("./static/data/characters.json"),
      fetch("./static/data/scenes.json"),
    ]);

    if (!charactersResponse.ok || !scenesResponse.ok) {
      throw new Error("Unable to load game data JSON files.");
    }

    const characters = await charactersResponse.json();
    const rawScenes = await scenesResponse.json();
    const scenes = Object.fromEntries(
      Object.entries(rawScenes).map(([sceneId, node]) => [
        sceneId,
        {
          ...node,
          speaker: characters[node.speaker] || node.speaker,
        },
      ]),
    );

    return { scenes };
  }

  const { scenes: GAME_DATA } = await loadGameData();

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
    chapterValue: document.getElementById("chapterValue"),
    chapterLabel: document.getElementById("chapterLabel"),
    energyValue: document.getElementById("energyValue"),
    coinValue: document.getElementById("coinValue"),
    gemValue: document.getElementById("gemValue"),
    themeToggle: document.getElementById("themeToggle"),
    tabBar: document.getElementById("tabBar"),
    worldHud: document.getElementById("worldHud"),
    recipePanel: document.getElementById("recipePanel"),
    journalPanel: document.getElementById("journalPanel"),
    stealthMeter: document.getElementById("stealthMeter"),
    worldObjective: document.getElementById("worldObjective"),
  };

  const TAB_LAYOUT = {
    cafe: [ui.scenePanel],
    recipes: [ui.recipePanel],
    worlds: [ui.worldHud],
    journal: [ui.journalPanel],
  };

  const TABBABLE_SECTIONS = [ui.scenePanel, ui.worldHud, ui.recipePanel, ui.journalPanel];

  function defaultState() { return { current:"title", started:false, flags:{ protective:false,riskyPlan:false,sharedTruth:false,disguiseChecked:false,extraIngredients:false,limbInjury:false,choseFeed:false }, relation:{ orchard:0,raincoat:0,mirror:0 }, inventory:[], recipeBook:["Orchard Porridge"], visited:{}, uiTheme:"default", activeTab:"cafe"}; }
  function save(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function showError(message){ ui.errorBox.style.display="block"; ui.errorBox.textContent=`Error: ${message}`; }
  function load(){ try{const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return defaultState(); const parsed=JSON.parse(raw); return {...defaultState(),...parsed,flags:{...defaultState().flags,...(parsed.flags||{})}};}catch(e){showError("Save file is corrupted. Starting fresh."); return defaultState();}}
  function clearError(){ ui.errorBox.style.display="none"; ui.errorBox.textContent=""; }
  function uniquePush(list, items){ items.forEach((item)=>{ if(!list.includes(item)) list.push(item);}); }
  function applyEffects(state,effects={}){ if(effects.flags) Object.entries(effects.flags).forEach(([k,v])=>{state.flags[k]=v;}); if(effects.relation) Object.entries(effects.relation).forEach(([k,v])=>{state.relation[k]=(state.relation[k]||0)+v;}); if(effects.addItems) uniquePush(state.inventory,effects.addItems); }
  function applyOnEnter(state,node){ if(state.visited[state.current]) return; if(node.onEnter?.addItems) uniquePush(state.inventory,node.onEnter.addItems); if(node.onEnter?.addBook) uniquePush(state.recipeBook,node.onEnter.addBook); state.visited[state.current]=true; }
  function renderStatus(state,node){ const visitedCount=Math.max(1,Object.keys(state.visited).length); const chapter=Math.min(7,visitedCount); ui.chapterValue.textContent=String(chapter); ui.chapterLabel.textContent=node.end?"Finale":"Chapter"; ui.energyValue.textContent=`${Math.max(40,120-state.inventory.length*4)}/120`; ui.coinValue.textContent=String(1200+state.inventory.length*25+state.relation.orchard*15); ui.gemValue.textContent=String(80+state.relation.mirror*3+(state.flags.sharedTruth?6:0)); ui.stealthMeter.textContent=state.flags.limbInjury?"🖤🖤🖤":"🖤🖤🖤🖤"; ui.worldObjective.textContent=node.end?"The shift is over. Reflect on what you chose.":`Primary objective: ${node.location}`; }
  function renderStats(state){ const tone=state.flags.protective?"Protective":"Balanced"; const risk=state.flags.riskyPlan?"Risky Brew":"Careful Brew"; const truth=state.flags.sharedTruth?"Truth Shared":"Truth Hidden"; const body=state.flags.limbInjury?"Injured":"Whole"; ui.stats.innerHTML=`<p><strong>Route Tone:</strong> ${tone}</p><p><strong>Plan:</strong> ${risk}</p><p><strong>Trust:</strong> ${truth}</p><p><strong>Body:</strong> <span class="meter">${body}</span></p><p><strong>Relations:</strong> Orchard ${state.relation.orchard}, Raincoat ${state.relation.raincoat}, Mirror ${state.relation.mirror}</p>`; const slots=state.inventory.slice(-4); while(slots.length<4) slots.push("+"); ui.inventory.innerHTML=slots.map((item)=>`<div class="inv-slot">${item}</div>`).join(""); ui.book.innerHTML=`<ul>${state.recipeBook.map((recipe)=>`<li>${recipe}</li>`).join("")}</ul>`; }
  function setDetailsPanelState(tab){ if(tab==="recipes"){ ui.recipePanel.open=true; ui.journalPanel.open=false;} else if(tab==="journal"){ ui.recipePanel.open=false; ui.journalPanel.open=true;} }
  function setActiveTab(state,tabName,shouldPersist=true){ state.activeTab=TAB_LAYOUT[tabName]?tabName:"cafe"; ui.tabBar.querySelectorAll(".tab-btn").forEach((button)=>{ const isActive=button.dataset.tab===state.activeTab; button.classList.toggle("active",isActive); button.setAttribute("aria-selected",String(isActive)); button.setAttribute("tabindex",isActive?"0":"-1");}); TABBABLE_SECTIONS.forEach((section)=>{ section.classList.add("tab-hidden"); section.setAttribute("hidden","hidden");}); TAB_LAYOUT[state.activeTab].forEach((section)=>{ section.classList.remove("tab-hidden"); section.removeAttribute("hidden");}); setDetailsPanelState(state.activeTab); if(shouldPersist) save(state); }
  function renderScene(state){ clearError(); const node=GAME_DATA[state.current]; if(!node){ showError(`Scene '${state.current}' is missing. Use Reset Save to recover.`); ui.scenePanel.innerHTML="<h2>Scene Load Failure</h2><p>We couldn't find this scene ID in game data.</p>"; return; } applyOnEnter(state,node); save(state); ui.progress.textContent=node.end?"Today's Special: Story complete. Restart for a fresh shift.":`Today's Special: ${node.location}`; const choicesHtml=(node.choices||[]).map((choice,index)=>`<button class="choice" data-choice="${index}">${choice.label}</button>`).join(""); ui.scenePanel.innerHTML=`<h2>${node.location}</h2><div class="tags">${(node.tags||[]).map((tag)=>`<span class="tag">${tag}</span>`).join("")}</div><div class="speaker-label">${node.speaker}</div><div class="dialogue-text">${node.text}</div><div class="choices">${choicesHtml||"<div class='mini'>The shift is over. Use Start New to replay.</div>"}</div>`; renderStatus(state,node); renderStats(state); setActiveTab(state,state.activeTab,false); ui.scenePanel.querySelectorAll("[data-choice]").forEach((button)=>{ button.addEventListener("click",()=>{ const index=Number(button.getAttribute("data-choice")); const selectedChoice=node.choices?.[index]; if(!selectedChoice){ showError("Choice data is missing for this scene."); return; } applyEffects(state,selectedChoice.effects); state.started=true; state.current=selectedChoice.next; save(state); renderScene(state); }); }); }

  let state = load();
  function wireTabKeyboardNavigation(state){ const tabButtons=Array.from(ui.tabBar.querySelectorAll(".tab-btn")); tabButtons.forEach((button,index)=>{ button.addEventListener("keydown",(event)=>{ const isHorizontalNav=["ArrowLeft","ArrowRight","Home","End"].includes(event.key); if(!isHorizontalNav) return; event.preventDefault(); let nextIndex=index; if(event.key==="ArrowRight") nextIndex=(index+1)%tabButtons.length; else if(event.key==="ArrowLeft") nextIndex=(index-1+tabButtons.length)%tabButtons.length; else if(event.key==="Home") nextIndex=0; else if(event.key==="End") nextIndex=tabButtons.length-1; const nextButton=tabButtons[nextIndex]; nextButton.focus(); setActiveTab(state,nextButton.dataset.tab); });}); }
  ui.themeToggle.addEventListener("click",()=>{ state.uiTheme = state.uiTheme === "high-contrast" ? "default" : "high-contrast"; document.body.dataset.theme = state.uiTheme; ui.themeToggle.setAttribute("aria-pressed", String(state.uiTheme === "high-contrast")); save(state);});
  ui.tabBar.querySelectorAll(".tab-btn").forEach((button)=>button.addEventListener("click",()=>setActiveTab(state,button.dataset.tab)));
  wireTabKeyboardNavigation(state);
  ui.startBtn.addEventListener("click",()=>{ state=defaultState(); state.started=true; state.current="title"; save(state); renderScene(state);});
  ui.continueBtn.addEventListener("click",()=>{ state=load(); renderScene(state);});
  ui.resetBtn.addEventListener("click",()=>{ localStorage.removeItem(STORAGE_KEY); state=defaultState(); renderScene(state);});
  document.body.dataset.theme=state.uiTheme;
  ui.themeToggle.setAttribute("aria-pressed", String(state.uiTheme === "high-contrast"));
  renderScene(state);
}
