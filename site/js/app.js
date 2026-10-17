import {createI18n, localizeCatalog, translate} from './i18n.js';
import {catalogForSave} from './catalog-profile.js';
import {RANKS, rankFor} from './tier-ranks.js';
import {createGraphView, edgeGeometry, graphNeighborhood} from './graph-view.js';
import {parseSave, slotProgress} from './save-parser.js';
import {STATUS, validateCatalog, createEvaluator, buildGraph, layoutGraph, conditionLabel} from './unlock-engine.js';

const i18n=createI18n(), t=source=>i18n.t(source);
const html=(strings,...values)=>i18n.html(typeof strings==='string'?strings:strings.reduce((result,part,index)=>result+part+(index<values.length?values[index]:''),''));
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const kindNames = {collectible:'Item',trinket:'Trinket',card:'Card',rune:'Rune',pill:'Pill',character:'Character',
  stage:'Route',boss:'Boss',challenge:'Challenge',feature:'Feature',condition:'Condition',gate:'Logic'};
const symbols = {collectible:'✦',trinket:'♧',card:'▤',rune:'◈',pill:'◒',character:'♙',stage:'⌂',boss:'♜',challenge:'⚑',feature:'◇'};
const state = {data:null,baseData:null,catalog:null,icons:new Map(),save:null,progress:null,evaluator:null,fileName:'',
  manual:{},page:'tiers',search:'',filter:'all',kind:'all',showDefaultOpen:true,inferSaveEvidence:false,graphMode:'progress',showOpened:false,selected:null,zoom:1,layout:null};
let toastTimer, uploadGeneration = 0, graphView;
const graphPositions = new Map();
function toast(message) { const box=$('#toast'); i18n.text(box,message); box.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>box.hidden=true,5500); }
const graphLink = id => `#/graph${id ? '?item='+encodeURIComponent(id) : ''}`;
const wikiLink = node => node.wikiUrl || `https://bindingofisaacrebirth.wiki.gg/wiki/${encodeURIComponent(node.name.replaceAll(' ','_'))}`;
const availabilityLabel = status => t(status === STATUS.YES ? 'Unlocked' : status === STATUS.NO ? 'Locked' : 'No data');
const earnedLabel = status => t(status === STATUS.YES ? 'Verified in this slot' : status === STATUS.NO ? 'Requirement not verified' : 'Needs verification');
const icon = (node, className='', lazy=true) => state.icons.has(node.id)
  ? html`<img class="${className}" src="${esc(state.icons.get(node.id))}" alt="" ${lazy?'loading="lazy"':''} decoding="async">`
  : html`<span class="generic-icon ${className}" aria-hidden="true">${symbols[node.kind]||'◇'}</span>`;

function refreshEvaluator() {
  const options={inferCollectedUnlocks:state.inferSaveEvidence};
  state.evaluator=createEvaluator(state.data,state.save,state.progress,state.manual,options);
  state.slotEvaluator=createEvaluator(state.data,state.save,state.progress,{},options);
}
function tierAvailability(node) {
  return state.inferSaveEvidence
    ? state.slotEvaluator.availability(node.id,{inferSlotEvidence:true})
    : state.evaluator.availability(node.id);
}
function setPaths(os) {
  state.os=os;
  const paths={
    windows:[['Steam Cloud · all editions','C:\\Program Files (x86)\\Steam\\userdata\\<SteamID>\\250900\\remote\\'],
      ['Repentance+ · local save','%USERPROFILE%\\Documents\\My Games\\Binding of Isaac Repentance+\\'],
      ['Repentance / Rebirth · local save','%USERPROFILE%\\Documents\\My Games\\Binding of Isaac Repentance\\\n%USERPROFILE%\\Documents\\My Games\\Binding of Isaac Rebirth\\']],
    mac:[['Steam Cloud','~/Library/Application Support/Steam/userdata/<SteamID>/250900/remote/'],
      ['Rebirth · local save','~/Library/Application Support/Binding of Isaac Rebirth/'],
      ['Save from Windows / Steam Deck','You can use a persistentgamedata copy from Repentance or Repentance+. The contents determine its version, regardless of the computer running this site.']],
    linux:[['Steam Cloud / Steam Deck','~/.local/share/Steam/userdata/<SteamID>/250900/remote/'],
      ['Proton · Repentance+ without Steam Cloud','<Steam>/steamapps/compatdata/250900/pfx/drive_c/users/steamuser/Documents/My Games/Binding of Isaac Repentance+/'],
      ['Other editions through Proton','In the same My Games folder, open Binding of Isaac Repentance or Binding of Isaac Rebirth.']]
  };
  $('#save-paths').innerHTML=paths[os].map(([label,path])=>html`<p class="path-label">${esc(label)}</p><code>${esc(path)}</code>`).join('');
  document.querySelectorAll('[data-os]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.os===os)));
}

async function loadFile(file) {
  if (!file) return;
  if (!state.data) { state.pendingFile=file; i18n.text($('#upload-status'),'Loading the catalog before reading your save…'); return; }
  const generation = ++uploadGeneration;
  const status=$('#upload-status'); status.classList.remove('error'); i18n.text(status,'Reading your save and verifying its checksum…');
  try {
    const save=parseSave(await file.arrayBuffer(),{fileName:file.name}), progress=slotProgress(save,state.catalog);
    if (generation !== uploadGeneration) return;
    state.save=save; state.progress=progress;state.data=localizeCatalog(catalogForSave(state.baseData,save),i18n.language); state.fileName=file.name; state.manual={}; state.selected=null;
    state.graphMode='progress';state.showOpened=false;state.zoom=1;graphPositions.clear();
    refreshEvaluator();
    $('#save-name').textContent=file.name;$('#save-edition').textContent=save.profile.label;$('#file-error').hidden=true;
    i18n.text($('#save-meta'),`${(save.sizeBytes/1024).toFixed(1)} KB · checksum ✓`);
    $('#onboarding').hidden=true; $('#workspace').hidden=false; $('.main-nav').hidden=false; $('#change-save').hidden=false;
    i18n.text(status,'Save loaded.');
    location.hash=save.profile.planner?'#/tiers':'#/stats'; renderPage();
    $('#main').focus({preventScroll:true});
  } catch (error) {
    if (generation !== uploadGeneration) return;
    const message=error.message||'Could not read the file.';
    i18n.text(status,message); status.classList.add('error');$('#save-help').open=true;if(state.save){i18n.text($('#file-error'),message);$('#file-error').hidden=false;}toast(message);
  } finally { $('#save-input').value=''; }
}

function resetSave() {
  graphView?.destroy();graphView=null;graphPositions.clear();
  uploadGeneration++; state.save=null; state.progress=null; state.evaluator=null;state.slotEvaluator=null; state.manual={}; state.fileName=''; state.selected=null;state.data=state.baseData;
  $('#workspace').hidden=true;$('#file-error').hidden=true; $('#view').replaceChildren(); $('#onboarding').hidden=false; $('.main-nav').hidden=true; $('#change-save').hidden=true;
  $('#save-input').value=''; $('#upload-status').classList.remove('error');
  i18n.text($('#upload-status'),'Save forgotten. The file is not retained after a page reload.');
  location.hash='#/'; window.scrollTo(0,0);
}

function pageHeading(eyebrow, title, description, aside='') {
  return html`<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${aside}</div>`;
}

function itemCard(node) {
  const availability=tierAvailability(node), collected=state.evaluator.collected(node);
  const status=availability.status, statusClass=status===STATUS.YES?'yes':status===STATUS.NO?'no':'muted';
  const collectionText=t(collected==null?'Collection not recorded':collected?'Collected in this slot':'Not collected yet');
  const evidenceText=availability.source==='collection'?'Collected in this save, so considered unlocked':availability.source==='slot_evidence'?'Unlock confirmed by this slot’s data':'';
  return html`<article class="item-card ${collected?'collected':''}" data-node="${esc(node.id)}">
    <a class="item-link" href="${graphLink(node.id)}" aria-label="Unlock graph for ${esc(node.name)}" aria-describedby="tip-${esc(node.id)}">${icon(node)}<span class="availability-dot ${statusClass}" aria-hidden="true"></span>${collected?'<span class="collection-check" aria-hidden="true">✓</span>':''}</a>
    <a class="wiki-button" href="${esc(wikiLink(node))}" target="_blank" rel="noopener noreferrer" aria-label="Wiki: ${esc(node.name)}" title="Open wiki">↗</a>
    <div class="item-tooltip" id="tip-${esc(node.id)}" role="tooltip"><strong>${esc(node.name)}</strong><span><i class="availability-dot ${statusClass}"></i>${availabilityLabel(status)} · ${collectionText}</span>${evidenceText?html`<small>${evidenceText}</small>`:''}${node.sourceNote?'<small>See the note in unlock details</small>':''}</div>
  </article>`;
}

function matches(node) {
  const original=state.baseData.nodes.find(entry=>entry.id===node.id);
  if (state.search && !`${node.name} ${node.unlock.description} ${original?.name||''} ${original?.unlock.description||''} ${translate(original?.unlock.description,'ru')}`.toLowerCase().includes(state.search.toLowerCase())) return false;
  if (state.kind!=='all' && node.kind!==state.kind) return false;
  const available=tierAvailability(node).status, collected=state.evaluator.collected(node);
  if (state.filter==='closed' && available!==STATUS.NO) return false;
  if (state.filter==='open' && available!==STATUS.YES) return false;
  if (state.filter==='uncollected' && collected!==false) return false;
  if (state.filter==='earned' && state.evaluator.earned(node.id)!==STATUS.YES) return false;
  return true;
}

function renderTierRows() {
  const tierNodes=state.data.nodes.filter(n=>n.tier&&(state.showDefaultOpen||n.tier!=='default-open'));
  const nodes=tierNodes.filter(matches);
  $('#tier-rows').innerHTML=RANKS.map(rank=>{
    const entries=nodes.filter(n=>rankFor(n)===rank.id).toSorted((a,b)=>(a.order??0)-(b.order??0));
    if(!entries.length)return '';
    return html`<section class="tier-row ${rank.id==='DEAD GOD'?'dead-god-tier':''}" aria-label="Tier ${rank.id}: ${rank.label}"><div class="tier-label" style="--tier-color:${rank.color}" title="${rank.label}"><strong>${rank.id}</strong><small>${entries.length}</small></div><div class="tier-items">${entries.map(itemCard).join('')}</div></section>`;
  }).join('')||html('<div class="empty-state">No results</div>');
  $('#result-count').textContent=`${nodes.length} / ${tierNodes.length}`;
}

function renderTiers() {
  $('#view').innerHTML=html`<div class="page-heading tier-heading"><div><span class="eyebrow">UNLOCK PRIORITY</span><h1>Tier list<span class="title-dot">.</span></h1></div><div class="heading-tools"><span class="subtle">Item → unlock graph</span><details class="view-help"><summary aria-label="How to read the tier list">?</summary><div class="help-popover"><h3>How to read the tier list</h3><p><i class="availability-dot yes"></i> Unlocked · <i class="availability-dot no"></i> Locked · ✓ Collected in this slot.</p><p>Select an item to open its graph. The ↗ button opens the wiki. Hover or focus to see the name.</p><p>With the checkbox enabled, collected items and marks, challenges or counters recorded in this slot can show an unlock as open even if its secret flag is off.</p><p>Without this checkbox, availability comes from secret flags. Secret flags do not prove a requirement was met in this slot: they may have been synced from Steam. They do not count toward statistics or the progress graph.</p><p>S–F groups unlock priorities based on <a href="${esc(state.data.source.url)}" target="_blank" rel="noopener noreferrer">jnub’s guide ↗</a>, rather than item strength. Runes are ranked separately. Dead God is an added completion goal for Repentance. Priorities target Repentance+ and may differ in Repentance.</p></div></details></div></div>
    <div class="toolbar"><label class="search-wrap"><span aria-hidden="true">⌕</span><input id="item-search" type="search" placeholder="Find an item…" aria-label="Search tier list" value="${esc(state.search)}"></label>
    <select id="status-filter" aria-label="Filter by status"><option value="all">All statuses</option><option value="closed">Locked</option><option value="open">Unlocked</option><option value="uncollected">Not collected</option><option value="earned">Verified in this slot</option></select>
    <select id="kind-filter" aria-label="Unlock type"><option value="all">All types</option>${['collectible','trinket','card','rune','pill','character','stage','boss','challenge','feature'].map(k=>html`<option value="${k}">${kindNames[k]}</option>`).join('')}</select>
    <label class="checkbox-label tier-default-toggle"><input id="show-default-open" type="checkbox" ${state.showDefaultOpen?'checked':''}>Show items available by default</label>
    <label class="checkbox-label tier-evidence-toggle" title="If an item is in the collection or its requirement is confirmed by slot marks, challenges or counters, count it as unlocked."><input id="infer-save-evidence" type="checkbox" ${state.inferSaveEvidence?'checked':''}>Use save data to infer unlocks</label><span id="result-count" class="result-count"></span></div>
    <div id="tier-rows" class="tierlist"></div><div class="tier-caption"><span><i class="availability-dot yes"></i> Unlocked <span class="caption-gap">✓ Collected</span></span><span>S — unlock first · F — can wait</span></div>`;
  $('#status-filter').value=state.filter; $('#kind-filter').value=state.kind;
  $('#item-search').addEventListener('input',event=>{state.search=event.target.value;renderTierRows();});
  $('#status-filter').addEventListener('change',event=>{state.filter=event.target.value;renderTierRows();});
  $('#kind-filter').addEventListener('change',event=>{state.kind=event.target.value;renderTierRows();});
  $('#show-default-open').addEventListener('change',event=>{state.showDefaultOpen=event.target.checked;renderTierRows();});
  $('#infer-save-evidence').addEventListener('change',event=>{state.inferSaveEvidence=event.target.checked;refreshEvaluator();renderTierRows();});
  renderTierRows();
}

const COUNTERS = [[1,'Mom’s Heart / It Lives!'],[11,'Isaac'],[13,'Satan'],[24,'???'],[25,'The Lamb'],[26,'Mega Satan'],[111,'Boss Rush'],[158,'Hush'],[187,'Delirium'],[491,'Mother'],[492,'The Beast']];
const MISC = [[10,'Deaths'],[22,'Current win streak'],[23,'Best win streak'],[113,'Losing streak'],[21,'Eden Tokens'],[20,'Donation Machine'],[115,'Greed Donation Machine'],[2,'Rocks destroyed'],[3,'Tinted rocks'],[6,'Pills swallowed'],[15,'Angel deals'],[16,'Devil deals'],[197,'Shop purchases']];
const MARKS = [['Mom’s Heart / It Lives!','♥'],['Isaac','I'],['Satan','S'],['Boss Rush','BR'],['???','???'],['The Lamb','L'],['Mega Satan','MS'],['Hush','H'],['Greed / Greedier','G'],['Delirium','D'],['Mother','M'],['The Beast','B']];
function counterTable(entries) { return html`<table><thead><tr><th>Statistic</th><th>Value</th></tr></thead><tbody>${entries.map(([id,label])=>html`<tr><td>${esc(label)}</td><td>${state.progress.counters[id]??'—'}</td></tr>`).join('')}</tbody></table>`; }
function renderStats() {
  const p=state.progress,edition=state.save.profile,visibleMarks=MARKS.filter(([target])=>p.characters.some(character=>character.marks[target])), secrets=state.save.chunks.achievements.flatMap((value,id)=>value&&id?[{id,name:state.catalog.secrets?.[id]?.name||`Secret #${id}`}]:[]);
  const marks=p.characters.map(character=>{
    const node=state.data.nodes.find(n=>n.kind==='character'&&n.name===character.name);
    return html`<tr><td><span class="character-cell">${node?icon(node):''}${esc(character.name)}</span></td>${visibleMarks.map(([target])=>{const mark=character.marks[target],value=mark?.value??0;return html`<td><span class="mark ${value===2?'hard':value===1?'normal':''} ${mark?.online?'online':''}" title="${esc(target)}${mark?.online?' · online mark present (raw value '+mark.rawValue+')':''}: ${value===2?(target==='Greed / Greedier'?'Greedier':'Hard'):value===1?(target==='Greed / Greedier'?'Greed':'Normal'):'none'}">${value===2?'H':value===1?'✓':'·'}</span></td>`;}).join('')}</tr>`;
  }).join('');
  $('#view').innerHTML=pageHeading('THIS SLOT’S DATA ONLY','Statistics<span class="title-dot">.</span>',
    'Completion marks, collection and counters from your save. Steam achievements and secret flags do not contribute to these results.',
    '<button class="button" data-export="progress">Download statistics ↓</button>')+
    (edition.id==='rebirth'?html('<div class="edition-note"><b>Rebirth save loaded.</b> This edition has 11 characters, 6 marks each and 20 challenges. The tier list and graph target Repentance / Repentance+. If you play Repentance+, choose your current rep+persistentgamedata slot file instead of an old Rebirth file.</div>'):'')+
    html`<div class="stat-cards"><div class="stat-card"><label>Completion marks</label><strong>${p.summary.marks}<span style="font-size:16px;color:var(--muted)"> / ${p.capabilities.marks}</span></strong><small>${edition.id==='rebirth'?'Normal and Hard':'Normal, Hard and Greedier'}</small></div><div class="stat-card"><label>Challenges</label><strong>${p.summary.challenges}<span style="font-size:16px;color:var(--muted)"> / ${p.capabilities.challenges}</span></strong><small>Completed flags only</small></div><div class="stat-card"><label>Items collected</label><strong>${p.summary.collected}</strong><small>${p.summary.unknownCollectionFlags.length?`${p.summary.unknownCollectionFlags.length} additional unknown flags`:'Recognized items'}</small></div><div class="stat-card"><label>Best win streak</label><strong>${p.counters[23]}</strong><small>Deaths: ${p.counters[10]} · Eden Tokens: ${p.counters[21]}</small></div></div>
    <div class="stats-grid"><div><section class="section-card"><h2>Character completion sheets</h2><p>✓ — Normal / Greed · H — Hard / Greedier · · — no mark. Character availability from secrets is not used here.${edition.id==='repentance-plus'?' Outline — an online mark is present; Normal and Hard are decoded separately.':''}</p><div class="table-scroll"><table class="marks-table"><thead><tr><th>Character</th>${visibleMarks.map(([target,short])=>html`<th title="${esc(target)}">${short}</th>`).join('')}</tr></thead><tbody>${marks}</tbody></table></div></section>
    <section class="section-card"><h2>Boss bestiary</h2><p>Entity records may differ from credited wins: multi-part bosses are counted separately.</p><div class="table-scroll"><table><thead><tr><th>Boss / variant</th><th>Kills</th><th>Encounters</th><th>Deaths to boss</th></tr></thead><tbody>${p.bestiary.filter(e=>e.isBoss).map(e=>html`<tr><td>${esc(e.name)}</td><td>${e.kills}</td><td>${e.encounters}</td><td>${e.deaths}</td></tr>`).join('')||(p.capabilities.bestiary?'<tr><td colspan="4">No records.</td></tr>':'<tr><td colspan="4">Rebirth does not store a bestiary of encounters, kills and deaths.</td></tr>')}</tbody></table></div></section></div>
    <div><section class="section-card"><h2>Credited wins</h2><p>MOM_KILLS means Mom’s Heart / It Lives!, rather than Mom.</p>${counterTable(COUNTERS)}</section><section class="section-card"><h2>Little details</h2>${counterTable(MISC)}</section>
    ${edition.id==='repentance-plus'?html`<section class="section-card"><h2>Online and daily runs</h2>${counterTable([[497,'Current online win streak'],[498,'Best online win streak'],[499,'Online losing streak'],[521,'Best daily win streak'],[522,'Daily losing streak']])}</section>`:''}<section class="section-card"><h2>Completed challenges</h2><p>${p.challenges.filter(c=>c.completed).map(c=>`#${c.id} ${esc(c.name)}`).join('<br>')||'No completed challenges in this slot yet.'}</p></section>
    <details class="reference-box"><summary>Secrets · separate reference (${secrets.length})</summary><p>These are file flags, not a verified Steam account achievement list. Their origin is unknown. They are excluded from the statistics above and do not prove requirements were met in this slot.</p><div class="reference-list">${secrets.map(s=>html`<span>#${s.id} ${esc(s.name)}</span>`).join('')||'No flags are set.'}</div><div class="export-actions"><button class="button small" data-export="secrets">Download reference ↓</button></div></details></div></div>`;
}

function renderCondition(condition,path='root') {
  if (['all','any'].includes(condition.type)) {
    const label=condition.label||(condition.type==='all'?'ALL REQUIRED':'ANY ONE REQUIRED');
    const contents=html`<ul class="condition-list">${condition.conditions.map((child,index)=>renderCondition(child,`${path}.${index}`)).join('')}</ul>`;
    const done=condition.conditions.filter(child=>state.evaluator.evaluate(child)===STATUS.YES).length;
    return condition.conditions.length>12||condition.collapsed
      ? html`<li><details class="condition-disclosure" data-condition-key="${path}"><summary>${esc(label)}<small>${done} / ${condition.conditions.length}</small></summary>${contents}</details></li>`
      : html`<li><span class="condition-group-label">${esc(label)}</span>${contents}</li>`;
  }
  const status=state.evaluator.evaluate(condition), node=condition.type==='node'?state.evaluator.nodes.get(condition.id):null;
  const label=node?`${condition.goalSecretId?'#'+condition.goalSecretId+' · ':''}${node.name}`:conditionLabel(condition);
  const text=node?html`<button data-select="${esc(node.id)}">${esc(label)} ↗</button>`:esc(label);
  const counter=condition.type==='counter'?` <small>(${state.progress.counters[condition.id]??'?'}/${condition.atLeast})</small>`:'';
  return html`<li><div class="condition-row"><span class="condition-status ${status}" aria-label="${status===STATUS.YES?'completed':status===STATUS.NO?'not verified':'unknown'}">${status===STATUS.YES?'✓':status===STATUS.NO?'○':'?'}</span><span>${text}${counter}</span></div>${condition.type==='manual'?html`<label class="manual-check"><input type="checkbox" data-manual="${esc(condition.key)}" ${state.manual[condition.key]?'checked':''}><span>Confirm manually<br><small>${esc(condition.reason||'This action is not recorded in the save.')}</small></span></label>`:''}</li>`;
}

function renderGraphSidebar() {
  const branch=graphNeighborhood(state.layout,state.selected);
  document.querySelectorAll('.graph-node').forEach(element=>{
    element.classList.toggle('selected',element.dataset.id===state.selected);
    element.classList.toggle('connected',branch.nodes.has(element.dataset.id)&&element.dataset.id!==state.selected);
    element.classList.toggle('branch-muted',branch.nodes.size>0&&!branch.nodes.has(element.dataset.id));
  });
  document.querySelectorAll('.graph-edge-group').forEach(element=>{
    const connected=branch.edges.has(Number(element.dataset.edge));
    element.classList.toggle('connected',connected);
    element.classList.toggle('branch-muted',branch.nodes.size>0&&!connected);
  });
  const selectedNode=state.layout.nodes.find(node=>node.id===state.selected);
  const node=state.evaluator.nodes.get(selectedNode?.ownerId||state.selected);
  if (!node) { $('#graph-sidebar').innerHTML=html('<span class="eyebrow">UNLOCK DETAILS</span><h2>Select a node</h2><p class="small-note">Select an item, character or route in the graph to see its requirements and unlock steps.</p>'); return; }
  const availability=state.inferSaveEvidence
    ?state.slotEvaluator.availability(node.id,{inferSlotEvidence:true}).status
    :state.evaluator.availability(node.id).status;
  const collected=state.evaluator.collected(node), earned=state.evaluator.earned(node.id);
  const collectionProof=state.inferSaveEvidence&&collected===true;
  $('#graph-sidebar').innerHTML=html`<span class="detail-kind">${esc(kindNames[node.kind]||node.kind)}</span><div style="margin-top:14px">${icon(node,'detail-icon',false)}</div><h2>${esc(node.name)}</h2><p class="detail-description">${esc(node.unlock.description)}</p>
    <div class="detail-badges"><span class="${availability===STATUS.YES?'yes':availability===STATUS.NO?'no':''}">${availabilityLabel(availability)} · ${t('availability')}</span>${collected==null?'':html`<span class="${collected?'yes':''}">${collected?'Collected':'Not collected'}</span>`}</div>
    <p class="small-note"><b>${collectionProof?t('Unlock confirmed by collection'):earnedLabel(earned)}</b></p>
    <div class="detail-actions"><a class="button small primary" href="${esc(wikiLink(node))}" target="_blank" rel="noopener noreferrer">Open wiki ↗</a><a class="button small" href="${graphLink(node.id)}">Only this path</a></div>
    ${node.id==='feature:dead-god'?html`<p class="small-note goal-policy">${esc(state.save.profile.label)}: ${state.save.profile.id==='repentance-plus'?640:636} unlock requirements and 717 collection items. Unlocked secrets are shown separately and do not prove requirements were met in this slot. Some actions require manual verification.</p>`:''}
    <hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><span class="eyebrow">${collectionProof?'COLLECTION CONFIRMS UNLOCK':'WHAT TO DO'}</span>${collectionProof?html`<p class="small-note">This item is listed in this slot’s collection, so the unlock counts as obtained. No manual confirmation is needed. The save does not show how or in which run the item was obtained.</p>`:html`<ul class="condition-list">${renderCondition(node.unlock.requirements)}</ul>`}
    ${node.unlock.evidence&&state.evaluator.evaluate(node.unlock.evidence)===STATUS.YES?'<p class="small-note">✓ The result is already verified by this slot’s marks, challenges or counters. Earlier steps do not need separate proof.</p>':''}
    <details class="detail-help"><summary>Data and sources</summary><p class="small-note">Secret-based availability does not prove a requirement was met in this slot. ? means the save does not store all the necessary evidence. Manual confirmations apply only to this tab and reset when you change saves.</p>
    ${node.sourceNote?html`<p class="small-note">${esc(node.sourceNote)}</p>`:''}
    <div class="source-links">Sources: ${node.sources.map((url,index)=>html`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${index+1} ↗</a>`).join(' · ')}</div></details>`;
}

function renderGraph({preserveSelection=false}={}) {
  graphView?.destroy();graphView=null;
  const params=new URLSearchParams(location.hash.split('?')[1]||''), targetId=params.get('item');
  const target=state.evaluator.nodes.get(targetId);
  if(targetId&&!target){$('#view').innerHTML=html('<div class="empty-state">Unlock not found. <a href="#/graph">Full graph</a></div>');return;}
  if(!preserveSelection)state.selected=targetId||state.selected;
  const graphEvaluator=state.graphMode==='availability'&&state.inferSaveEvidence
    ?{...state.evaluator,availability:id=>state.slotEvaluator.availability(id,{inferSlotEvidence:true})}
    :state.evaluator;
  const graph=buildGraph(state.data,graphEvaluator,{targetId,mode:state.graphMode,showOpened:state.showOpened});
  graph.nodes.forEach(node=>{node.name=t(node.name);});graph.edges.forEach(edge=>{edge.label=t(edge.label);});
  const layout=layoutGraph(graph);state.layout=layout;
  const map=new Map(layout.nodes.map(node=>[node.id,node]));
  const edges=layout.edges.map((edge,index)=>{
    const geometry=edgeGeometry(map.get(edge.from),map.get(edge.to),edge.via);
    const label=edge.label.length>48?edge.label.slice(0,46)+'…':edge.label;
    return html`<g class="graph-edge-group" data-edge="${index}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}"><title>${esc(edge.label)}</title><path class="graph-edge-hit" d="${geometry.path}"/><path class="graph-edge" d="${geometry.path}" ${map.get(edge.to).kind==='gate'?'':'marker-end="url(#arrow)"'}/><text class="edge-label" x="${geometry.x}" y="${geometry.y}" text-anchor="middle">${esc(label)}</text></g>`;
  }).join('');
  const nodeSvg=layout.nodes.map(node=>{
    const title=node.name.length>27?node.name.slice(0,25)+'…':node.name,src=state.icons.get(node.id);
    const collectedProof=node.kind!=='gate'&&state.graphMode==='progress'&&state.inferSaveEvidence&&state.evaluator.collected(state.evaluator.nodes.get(node.ownerId||node.id))===true;
    const statusText=node.status===STATUS.YES?(state.graphMode==='availability'?'✓ Available':collectedProof?'✓ Unlocked by collection':'✓ Verified'):node.status===STATUS.UNKNOWN?'? Needs verification':state.graphMode==='availability'?'○ Locked':'○ Not verified';
    if(node.kind==='gate')return html`<g class="graph-node gate ${node.operator} ${node.status}" data-id="${esc(node.id)}" data-owner="${esc(node.ownerId)}" tabindex="0" role="button" aria-label="${esc(node.name)}" aria-description="Drag this node or use the arrow keys. Enter opens details." transform="translate(${node.x},${node.y})"><title>${esc(node.name)}\n${esc(map.get(node.ownerId)?.name)}\n${t(statusText)}</title><rect width="${node.width}" height="${node.height}" rx="14"/><text class="gate-label" x="${node.width/2}" y="18" text-anchor="middle">${node.operator==='all'?'AND':'OR'}</text></g>`;
    return html`<g class="graph-node ${node.status} ${node.kind==='gate'?'gate':''} ${node.id===state.selected?'selected':''}" data-id="${esc(node.id)}" data-owner="${esc(node.ownerId||node.id)}" tabindex="0" role="button" aria-label="${esc(node.name)}" aria-description="Drag this node or use the arrow keys. Enter opens details." transform="translate(${node.x},${node.y})"><title>${esc(node.name)}</title><rect width="${node.width}" height="${node.height}" rx="12"/>${src?html`<image href="${esc(src)}" x="14" y="23" width="32" height="32"/>`:''}<text x="${src?58:16}" y="21" class="node-kind">${esc(kindNames[node.kind]||node.kind)}</text><text x="${src?58:16}" y="41">${esc(title)}</text><text x="${src?58:16}" y="61" class="node-state">${statusText}</text></g>`;
  }).join('');
  $('#view').innerHTML=html`<div class="page-heading graph-heading"><div><span class="eyebrow">DEPENDENCY MAP</span><h1>${target?esc(target.name):'Unlock graph'}<span class="title-dot">.</span></h1></div><a class="button small" href="${target?'#/graph':'#/tiers'}">${target?'Full graph ↗':'← Tier list'}</a></div>
    <div class="graph-toolbar"><select id="graph-mode" aria-label="Graph basis"><option value="progress">Slot progress</option><option value="availability">Content availability</option></select>
    <select id="graph-focus" aria-label="Choose an unlock path"><option value="">All unlocks</option>${state.data.nodes.toSorted((a,b)=>a.name.localeCompare(b.name)).map(node=>html`<option value="${esc(node.id)}">${esc(node.name)}</option>`).join('')}</select>
    <label class="checkbox-label"><input type="checkbox" id="show-opened" ${state.showOpened?'checked':''}>${state.graphMode==='availability'?'Unlocked':'Completed'}</label>
    <span class="graph-evidence-toggle"><label class="checkbox-label"><input type="checkbox" id="infer-save-evidence" aria-describedby="infer-save-evidence-help" ${state.inferSaveEvidence?'checked':''}>Use save data</label><span class="evidence-help" tabindex="0" aria-label="More about using save data">ⓘ</span><span class="evidence-tooltip" id="infer-save-evidence-help" role="tooltip"><strong>How this switch works</strong><span>In “Content availability” mode, collection data and confirmed slot marks, challenges or counters help identify what is already unlocked. In “Slot progress” mode, a collected item proves that the unlock itself was obtained.</span><span>Collection data proves the item was obtained, but not which action or run unlocked it. If an item is in the collection, its unlock does not need manual confirmation. Secret flags and Steam achievements are not used; statistics are unchanged.</span></span></span>
    <span class="spacer"></span><button class="button small" id="reset-layout" title="Smoothly reset node positions">Arrange</button><div class="zoom-controls"><button data-zoom="out" aria-label="Zoom out">−</button><span id="zoom-label"></span><button data-zoom="in" aria-label="Zoom in">+</button></div><button class="button small" id="fit-graph">Fit</button></div>
    <div class="graph-mode-note ${state.graphMode==='availability'?'reference':''}">${state.graphMode==='progress'?state.inferSaveEvidence?'● This slot’s progress includes collection data. A collected item proves its unlock was obtained, but not how or in which run. Secret flags and Steam achievements do not count.':'● This slot’s progress. Marks, challenges and counters confirm recorded requirements. Secrets and Steam achievements do not count.':state.inferSaveEvidence?'● Availability includes slot data. Collection and confirmed requirements can override a secret flag. Progress statistics are unchanged.':'● Availability from secret flags. Does not verify accomplishments in this slot.'}</div>
    <div class="graph-legend"><span><b>AND</b> — all branches required</span><span><b>OR</b> — one branch is enough</span><span>Select a node to highlight its neighbors</span></div>
    <div class="graph-layout"><div class="graph-panel"><div class="graph-canvas ${target?'':'overview'}" id="graph-canvas">${layout.nodes.length?html`<svg id="unlock-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="group" aria-label="Vertical dependency graph"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" class="arrow-head"/></marker></defs>${edges}${nodeSvg}</svg>`:'<div class="graph-empty"><h2>All done</h2><p>Show completed steps or change the graph basis.</p></div>'}</div><div class="graph-bottom"><span>${graph.nodes.filter(n=>!['gate','condition'].includes(n.kind)).length} unlocks · ${graph.edges.length} links</span><span>Scroll to zoom · drag nodes or the background</span></div></div><aside class="graph-sidebar" id="graph-sidebar" aria-label="Selected unlock requirements"></aside></div>`;
  $('#graph-mode').value=state.graphMode;$('#graph-focus').value=targetId||'';
  $('#graph-mode').addEventListener('change',event=>{state.graphMode=event.target.value;renderGraph();});
  $('#graph-focus').addEventListener('change',event=>{location.hash=graphLink(event.target.value);});
  $('#show-opened').addEventListener('change',event=>{state.showOpened=event.target.checked;renderGraph();});
  $('#infer-save-evidence').addEventListener('change',event=>{state.inferSaveEvidence=event.target.checked;refreshEvaluator();renderGraph();});
  $('#fit-graph').addEventListener('click',()=>graphView?.fit());
  $('#reset-layout').addEventListener('click',()=>graphView?.reset());
  renderGraphSidebar();
  if(layout.nodes.length){
    const scope=`${targetId||'*'}:${state.graphMode}:${state.showOpened}`;
    if(!graphPositions.has(scope))graphPositions.set(scope,new Map());
    graphView=createGraphView({canvas:$('#graph-canvas'),svg:$('#unlock-svg'),layout,zoom:state.zoom,positions:graphPositions.get(scope),onSelect:id=>{state.selected=id;renderGraphSidebar();},onZoom:zoom=>{state.zoom=zoom;$('#zoom-label').textContent=`${Math.round(zoom*100)}%`;}});
  }
}

function renderPage({preserveSelection=false}={}) {
  if (!state.save) return;
  graphView?.destroy();graphView=null;
  const requested=location.hash.slice(2).split('?')[0];state.page=['tiers','stats','graph'].includes(requested)?requested:'tiers';
  document.querySelectorAll('.main-nav a').forEach(link=>{link.classList.toggle('active',link.dataset.page===state.page);if(link.dataset.page===state.page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  if(!state.save.profile.planner&&state.page!=='stats')$('#view').innerHTML=html('<div class="empty-state"><h2>This is a Rebirth save</h2><p>Save loaded: statistics are available for this edition. The tier list and graph target Repentance / Repentance+.</p><a class="button" href="#/stats">View Rebirth statistics</a></div>');else if(state.page==='stats')renderStats();else if(state.page==='graph')renderGraph({preserveSelection});else renderTiers();
  document.title=`${t(state.page==='stats'?'Statistics':state.page==='graph'?'Unlock map':'Tier list')} — Skill Issue Tracker`;
}

function download(kind) {
  let data;
  if (kind==='secrets') data={file:state.fileName,excludedFromGameplayAnalysis:true,source:'save_chunk_1',steamAccount:{status:'not_queried',achievements:null},
    achievements:state.save.chunks.achievements.flatMap((value,id)=>id?[{saveSecretId:id,name:state.catalog.secrets?.[id]?.name||`Secret #${id}`,unlocked:!!value,earnedInThisSlot:null}]:[])};
  else data={file:state.fileName,checksum:state.save.checksum,progress:state.progress};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');
  link.href=url;link.download=`${state.fileName.replace(/\.dat$/i,'')}.${kind}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$('#view').addEventListener('click',event=>{
  const graph=event.target.closest('[data-graph]');if(graph){location.hash=graphLink(graph.dataset.graph);return;}
  const selected=event.target.closest('.graph-node,[data-select]');if(selected){state.selected=selected.dataset.id||selected.dataset.select;renderGraphSidebar();return;}
  const zoom=event.target.closest('[data-zoom]');if(zoom){graphView?.setZoom(graphView.zoom*(zoom.dataset.zoom==='in'?1.2:1/1.2));return;}
  const exported=event.target.closest('[data-export]');if(exported)download(exported.dataset.export);
});
$('#view').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('.graph-node')){event.preventDefault();state.selected=event.target.dataset.id;renderGraphSidebar();}});
$('#view').addEventListener('change',event=>{
  if(!event.target.matches('[data-manual]'))return;
  const key=event.target.dataset.manual,sidebar=$('#graph-sidebar'),scroll=sidebar?.scrollTop||0;
  const canvas=$('#graph-canvas'),viewport={left:canvas?.scrollLeft||0,top:canvas?.scrollTop||0,zoom:graphView?.zoom};
  const opened=new Set([...document.querySelectorAll('.condition-disclosure[open]')].map(details=>details.dataset.conditionKey));
  state.manual[key]=event.target.checked;refreshEvaluator();renderGraph({preserveSelection:true});
  if(graphView&&viewport.zoom)graphView.setZoom(viewport.zoom);
  if($('#graph-canvas')){$('#graph-canvas').scrollLeft=viewport.left;$('#graph-canvas').scrollTop=viewport.top;}
  document.querySelectorAll('.condition-disclosure').forEach(details=>{if(opened.has(details.dataset.conditionKey))details.open=true;});
  if($('#graph-sidebar'))$('#graph-sidebar').scrollTop=scroll;
  [...document.querySelectorAll('[data-manual]')].find(input=>input.dataset.manual===key)?.focus({preventScroll:true});
  toast('Manual confirmation updated for this tab only.');
});
function updateThemeButton() {
  const dark=document.documentElement.dataset.theme==='dark', button=$('#theme-toggle');
  button.textContent=dark?'☀':'☾';button.setAttribute('aria-label',t(dark?'Switch to light theme':'Switch to dark theme'));button.title=button.getAttribute('aria-label');
  document.querySelector('meta[name="theme-color"]').content=dark?'#111318':'#f7f8fa';
}
function updateAnimationButton(){
  const button=$('#demo-pause'),paused=button.getAttribute('aria-pressed')==='true';
  const label=t(paused?'Resume animation':'Pause animation');
  button.setAttribute('aria-label',label);button.title=label;
}
function applyLanguage(){
  document.documentElement.lang=i18n.language;
  document.querySelectorAll('.topbar, #onboarding, .skip-link, .footer, meta[name="description"], #clear-save').forEach(root=>i18n.localizeDOM(root));
  document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===i18n.language)));
  const onGraph=state.save&&state.page==='graph',canvas=onGraph?$('#graph-canvas'):null,sidebar=onGraph?$('#graph-sidebar'):null;
  const viewport={left:canvas?.scrollLeft||0,top:canvas?.scrollTop||0,sidebar:sidebar?.scrollTop||0,zoom:graphView?.zoom};
  const opened=new Set([...document.querySelectorAll('.condition-disclosure[open]')].map(details=>details.dataset.conditionKey));
  if(state.baseData){state.data=localizeCatalog(state.save?catalogForSave(state.baseData,state.save):state.baseData,i18n.language);if(state.save)refreshEvaluator();}
  setPaths(state.os||'windows');i18n.refreshMessages();updateThemeButton();updateAnimationButton();
  renderPage({preserveSelection:true});
  if(onGraph){
    if(graphView&&viewport.zoom)graphView.setZoom(viewport.zoom);
    if($('#graph-canvas')){$('#graph-canvas').scrollLeft=viewport.left;$('#graph-canvas').scrollTop=viewport.top;}
    if($('#graph-sidebar'))$('#graph-sidebar').scrollTop=viewport.sidebar;
    document.querySelectorAll('.condition-disclosure').forEach(details=>{if(opened.has(details.dataset.conditionKey))details.open=true;});
  }
}
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{
  if(i18n.language===button.dataset.language)return;
  i18n.setLanguage(button.dataset.language);applyLanguage();
}));
$('#theme-toggle').addEventListener('click',()=>{
  const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=theme;try{localStorage.setItem('atlas-theme',theme);}catch{}
  updateThemeButton();
});
updateThemeButton();
$('#demo-pause').addEventListener('click',()=>{
  const paused=$('#demo-pause').getAttribute('aria-pressed')!=='true';
  $('#landing-demo').dataset.paused=String(paused);
  $('#demo-pause').setAttribute('aria-pressed',String(paused));
  const label=t(paused?'Resume animation':'Pause animation');
  $('#demo-pause').setAttribute('aria-label',label);$('#demo-pause').title=label;$('#demo-pause').textContent=paused?'▷':'Ⅱ';
});
$('#save-input').addEventListener('change',event=>loadFile(event.target.files[0]));
$('#change-save').addEventListener('click',()=>$('#save-input').click());$('#clear-save').addEventListener('click',resetSave);
document.querySelectorAll('[data-os]').forEach(button=>button.addEventListener('click',()=>setPaths(button.dataset.os)));
const drop=$('#dropzone');drop.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();$('#save-input').click();}});
for(const eventName of ['dragenter','dragover'])drop.addEventListener(eventName,event=>{event.preventDefault();drop.classList.add('dragging');});
for(const eventName of ['dragleave','drop'])drop.addEventListener(eventName,event=>{event.preventDefault();drop.classList.remove('dragging');});
drop.addEventListener('drop',event=>{if(event.dataTransfer.files.length)loadFile(event.dataTransfer.files[0]);});
window.addEventListener('hashchange',()=>{if(location.hash==='#main')return;renderPage();window.scrollTo(0,0);});applyLanguage();

try {
  const urls=['../data/unlocks.json','../data/game-catalog.json','../assets/icons/manifest.json'];
  const [data,catalog,manifest]=await Promise.all(urls.map(async url=>{const response=await fetch(new URL(url,import.meta.url));if(!response.ok)throw new Error('Could not load the catalog. Reload the page.');return response.json();}));
  const errors=validateCatalog(data);if(errors.length)throw new Error(`Catalog error: ${errors[0]}`);
  state.data=localizeCatalog(data,i18n.language);state.baseData=data;state.catalog=catalog;state.icons=new Map(manifest.icons.filter(entry=>['downloaded','designed'].includes(entry.status)).map(entry=>[entry.nodeId,entry.path]));
  if(state.pendingFile){const file=state.pendingFile;delete state.pendingFile;loadFile(file);}
  if(location.protocol==='file:')throw new Error('Open the site through an HTTP server or GitHub Pages.');
} catch(error) { $('#upload-status').classList.add('error');i18n.text($('#upload-status'),error.message);toast(error.message); }
