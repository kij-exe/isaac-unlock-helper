import {RANKS, rankFor} from './tier-ranks.js';
import {createGraphView, edgeGeometry} from './graph-view.js';
import {parseSave, slotProgress} from './save-parser.js';
import {STATUS, validateCatalog, createEvaluator, buildGraph, layoutGraph, conditionLabel} from './unlock-engine.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const kindNames = {collectible:'Предмет',trinket:'Брелок',card:'Карта',rune:'Руна',pill:'Пилюля',character:'Персонаж',
  stage:'Маршрут',boss:'Босс',challenge:'Испытание',feature:'Механика',condition:'Условие',gate:'Логика'};
const symbols = {collectible:'✦',trinket:'♧',card:'▤',rune:'◈',pill:'◒',character:'♙',stage:'⌂',boss:'♜',challenge:'⚑',feature:'◇'};
const state = {data:null,catalog:null,icons:new Map(),save:null,progress:null,evaluator:null,fileName:'',
  manual:{},page:'tiers',search:'',filter:'all',kind:'all',graphMode:'progress',showOpened:false,selected:null,zoom:1,layout:null};
let toastTimer, uploadGeneration = 0, graphView;
const graphPositions = new Map();
function toast(message) { const box=$('#toast'); box.textContent=message; box.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>box.hidden=true,5500); }
const graphLink = id => `#/graph${id ? '?item='+encodeURIComponent(id) : ''}`;
const wikiLink = node => node.wikiUrl || `https://bindingofisaacrebirth.wiki.gg/wiki/${encodeURIComponent(node.name.replaceAll(' ','_'))}`;
const availabilityLabel = status => status === STATUS.YES ? 'Открыт' : status === STATUS.NO ? 'Закрыт' : 'Нет данных';
const earnedLabel = status => status === STATUS.YES ? 'Подтверждено в слоте' : status === STATUS.NO ? 'Условие не подтверждено' : 'Нужна проверка';
const icon = (node, className='', lazy=true) => state.icons.has(node.id)
  ? `<img class="${className}" src="${esc(state.icons.get(node.id))}" alt="" ${lazy?'loading="lazy"':''} decoding="async">`
  : `<span class="generic-icon ${className}" aria-hidden="true">${symbols[node.kind]||'◇'}</span>`;

function refreshEvaluator() { state.evaluator=createEvaluator(state.data,state.save,state.progress,state.manual); }
function setPaths(os) {
  const paths = {
    windows:[['Steam Cloud (обычно здесь)','C:\\Program Files (x86)\\Steam\\userdata\\<SteamID>\\250900\\remote\\rep_persistentgamedata1.dat'],
      ['Если Steam Cloud отключён','Документы\\My Games\\Binding of Isaac Repentance\\persistentgamedata1.dat']],
    mac:[['Папка Steam Cloud','~/Library/Application Support/Steam/userdata/<SteamID>/250900/remote/'],
      ['Сохранение с другого компьютера','Скопируйте rep_persistentgamedata*.dat из Repentance. Этот сайт работает и на macOS; файлы Rebirth / Afterbirth+ не поддерживаются.']],
    linux:[['Steam Cloud','~/.local/share/Steam/userdata/<SteamID>/250900/remote/rep_persistentgamedata1.dat'],
      ['Без Steam Cloud, через Proton','<Steam>/steamapps/compatdata/250900/pfx/drive_c/users/steamuser/Documents/My Games/Binding of Isaac Repentance/']]
  };
  $('#save-paths').innerHTML=paths[os].map(([label,path])=>`<p class="path-label">${esc(label)}</p><code>${esc(path)}</code>`).join('');
  document.querySelectorAll('[data-os]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.os===os)));
}

async function loadFile(file) {
  if (!file) return;
  if (!state.data) { state.pendingFile=file; $('#upload-status').textContent='Загружаем справочник перед чтением файла…'; return; }
  const generation = ++uploadGeneration;
  const status=$('#upload-status'); status.classList.remove('error'); status.textContent='Читаем файл и проверяем контрольную сумму…';
  try {
    const save=parseSave(await file.arrayBuffer()), progress=slotProgress(save,state.catalog);
    if (generation !== uploadGeneration) return;
    state.save=save; state.progress=progress; state.fileName=file.name; state.manual={}; state.selected=null;
    state.graphMode='progress';state.showOpened=false;state.zoom=1;graphPositions.clear();
    refreshEvaluator();
    $('#save-name').textContent=file.name;
    $('#save-meta').textContent=`Repentance · ${(save.sizeBytes/1024).toFixed(1)} КБ · checksum ✓`;
    $('#onboarding').hidden=true; $('#workspace').hidden=false; $('.main-nav').hidden=false; $('#change-save').hidden=false;
    status.textContent='Сохранение прочитано.';
    location.hash='#/tiers'; renderPage();
    $('#main').focus({preventScroll:true});
  } catch (error) {
    if (generation !== uploadGeneration) return;
    const message=error.message||'Не удалось прочитать файл.';
    status.textContent=message; status.classList.add('error'); toast(message);
  } finally { $('#save-input').value=''; }
}

function resetSave() {
  graphView?.destroy();graphView=null;graphPositions.clear();
  uploadGeneration++; state.save=null; state.progress=null; state.evaluator=null; state.manual={}; state.fileName=''; state.selected=null;
  $('#workspace').hidden=true; $('#view').replaceChildren(); $('#onboarding').hidden=false; $('.main-nav').hidden=true; $('#change-save').hidden=true;
  $('#save-input').value=''; $('#upload-status').classList.remove('error');
  $('#upload-status').textContent='Сохранение забыто. Файл не сохраняется между перезагрузками страницы.';
  location.hash='#/'; window.scrollTo(0,0);
}

function pageHeading(eyebrow, title, description, aside='') {
  return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${aside}</div>`;
}

function itemCard(node) {
  const availability=state.evaluator.availability(node.id), collected=state.evaluator.collected(node);
  const status=availability.status, statusClass=status===STATUS.YES?'yes':status===STATUS.NO?'no':'muted';
  const collectionText=collected==null?'Подбор не хранится':collected?'Подобран в этом слоте':'Ещё не подобран';
  return `<article class="item-card ${collected?'collected':''}" data-node="${esc(node.id)}">
    <a class="item-link" href="${graphLink(node.id)}" aria-label="Граф открытия ${esc(node.name)}" aria-describedby="tip-${esc(node.id)}">${icon(node)}<span class="availability-dot ${statusClass}" aria-hidden="true"></span>${collected?'<span class="collection-check" aria-hidden="true">✓</span>':''}</a>
    <a class="wiki-button" href="${esc(wikiLink(node))}" target="_blank" rel="noopener noreferrer" aria-label="Вики: ${esc(node.name)}" title="Открыть вики">↗</a>
    <div class="item-tooltip" id="tip-${esc(node.id)}" role="tooltip"><strong>${esc(node.name)}</strong><span><i class="availability-dot ${statusClass}"></i>${availabilityLabel(status)} · ${collectionText}</span>${node.sourceNote?'<small>Есть примечание в деталях анлока</small>':''}</div>
  </article>`;
}

function matches(node) {
  if (state.search && !`${node.name} ${node.unlock.description}`.toLowerCase().includes(state.search.toLowerCase())) return false;
  if (state.kind!=='all' && node.kind!==state.kind) return false;
  const available=state.evaluator.availability(node.id).status, collected=state.evaluator.collected(node);
  if (state.filter==='closed' && available!==STATUS.NO) return false;
  if (state.filter==='open' && available!==STATUS.YES) return false;
  if (state.filter==='uncollected' && collected!==false) return false;
  if (state.filter==='earned' && state.evaluator.earned(node.id)!==STATUS.YES) return false;
  return true;
}

function renderTierRows() {
  const nodes=state.data.nodes.filter(n=>n.tier&&matches(n));
  $('#tier-rows').innerHTML=RANKS.map(rank=>{
    const entries=nodes.filter(n=>rankFor(n)===rank.id).toSorted((a,b)=>(a.order??0)-(b.order??0));
    if(!entries.length)return '';
    return `<section class="tier-row" aria-label="Тир ${rank.id}: ${rank.label}"><div class="tier-label" style="--tier-color:${rank.color}" title="${rank.label}"><strong>${rank.id}</strong><small>${entries.length}</small></div><div class="tier-items">${entries.map(itemCard).join('')}</div></section>`;
  }).join('')||'<div class="empty-state">Ничего не найдено</div>';
  $('#result-count').textContent=`${nodes.length} / ${state.data.nodes.filter(n=>n.tier).length}`;
}

function renderTiers() {
  $('#view').innerHTML=`<div class="page-heading tier-heading"><div><span class="eyebrow">ПРИОРИТЕТ ОТКРЫТИЯ</span><h1>Тирлист<span class="title-dot">.</span></h1></div><div class="heading-tools"><span class="subtle">Предмет → граф открытия</span><details class="view-help"><summary aria-label="Как читать тирлист">?</summary><div class="help-popover"><h3>Как читать тирлист</h3><p><i class="availability-dot yes"></i> Открыт · <i class="availability-dot no"></i> Закрыт · ✓ Подобран в слоте.</p><p>Нажмите на предмет, чтобы открыть граф. Кнопка ↗ ведёт на вики. Название видно при наведении или фокусе.</p><p>Доступность определяется по секретам. Она не доказывает выполнение условия в этом слоте: секреты могли быть перенесены из Steam. В статистике и графе прогресса они не засчитываются.</p><p>S–F — наша группировка приоритетов открытия по <a href="${esc(state.data.source.url)}" target="_blank" rel="noopener noreferrer">руководству jnub ↗</a>, а не рейтинг силы предметов. Руны распределены отдельно. Приоритеты рассчитаны на Repentance+ и могут отличаться в Repentance.</p></div></details></div></div>
    <div class="toolbar"><label class="search-wrap"><span aria-hidden="true">⌕</span><input id="item-search" type="search" placeholder="Найти предмет…" aria-label="Поиск по тирлисту" value="${esc(state.search)}"></label>
    <select id="status-filter" aria-label="Фильтр по состоянию"><option value="all">Все состояния</option><option value="closed">Закрыты</option><option value="open">Открыты</option><option value="uncollected">Не подобраны</option><option value="earned">Подтверждены в слоте</option></select>
    <select id="kind-filter" aria-label="Тип анлока"><option value="all">Все типы</option>${['collectible','trinket','card','rune','pill','character','stage','boss','challenge','feature'].map(k=>`<option value="${k}">${kindNames[k]}</option>`).join('')}</select><span id="result-count" class="result-count"></span></div>
    <div id="tier-rows" class="tierlist"></div><div class="tier-caption"><span><i class="availability-dot yes"></i> Открыт <span class="caption-gap">✓ Подобран</span></span><span>S — в первую очередь · F — можно отложить</span></div>`;
  $('#status-filter').value=state.filter; $('#kind-filter').value=state.kind;
  $('#item-search').addEventListener('input',event=>{state.search=event.target.value;renderTierRows();});
  $('#status-filter').addEventListener('change',event=>{state.filter=event.target.value;renderTierRows();});
  $('#kind-filter').addEventListener('change',event=>{state.kind=event.target.value;renderTierRows();});
  renderTierRows();
}

const COUNTERS = [[1,'Mom’s Heart / It Lives!'],[11,'Isaac'],[13,'Satan'],[24,'???'],[25,'The Lamb'],[26,'Mega Satan'],[111,'Boss Rush'],[158,'Hush'],[187,'Delirium'],[491,'Mother'],[492,'The Beast']];
const MISC = [[10,'Смерти'],[22,'Текущая серия побед'],[23,'Лучшая серия побед'],[113,'Серия поражений'],[21,'Eden Tokens'],[20,'Donation Machine'],[115,'Greed Donation Machine'],[2,'Разрушено камней'],[3,'Tinted rocks'],[6,'Съедено пилюль'],[15,'Сделки ангела'],[16,'Сделки дьявола'],[197,'Покупки в магазине']];
const MARKS = [['Mom’s Heart / It Lives!','♥'],['Isaac','I'],['Satan','S'],['Boss Rush','BR'],['???','???'],['The Lamb','L'],['Mega Satan','MS'],['Hush','H'],['Greed / Greedier','G'],['Delirium','D'],['Mother','M'],['The Beast','B']];
function counterTable(entries) { return `<table><thead><tr><th>Показатель</th><th>Значение</th></tr></thead><tbody>${entries.map(([id,label])=>`<tr><td>${esc(label)}</td><td>${state.progress.counters[id]}</td></tr>`).join('')}</tbody></table>`; }
function renderStats() {
  const p=state.progress, secrets=state.save.chunks.achievements.flatMap((value,id)=>value&&id?[{id,name:state.catalog.secrets?.[id]?.name||`Секрет #${id}`}]:[]);
  const marks=p.characters.map(character=>{
    const node=state.data.nodes.find(n=>n.kind==='character'&&n.name===character.name);
    return `<tr><td><span class="character-cell">${node?icon(node):''}${esc(character.name)}</span></td>${MARKS.map(([target])=>{const value=character.marks[target]?.value??0;return `<td><span class="mark ${value===2?'hard':value===1?'normal':''}" title="${esc(target)}: ${value===2?(target==='Greed / Greedier'?'Greedier':'Hard'):value===1?(target==='Greed / Greedier'?'Greed':'Normal'):'нет'}">${value===2?'H':value===1?'✓':'·'}</span></td>`;}).join('')}</tr>`;
  }).join('');
  $('#view').innerHTML=pageHeading('ТОЛЬКО ДАННЫЕ ЭТОГО СЛОТА','Статистика<span class="title-dot">.</span>',
    'Отметки, коллекция и счётчики из сохранения. Достижения Steam и флаги секретов не участвуют в этих результатах.',
    '<button class="button" data-export="progress">Скачать статистику ↓</button>')+
    `<div class="stat-cards"><div class="stat-card"><label>Отметки персонажей</label><strong>${p.summary.marks}<span style="font-size:16px;color:var(--muted)"> / 408</span></strong><small>Normal, Hard и Greedier</small></div><div class="stat-card"><label>Испытания</label><strong>${p.summary.challenges}<span style="font-size:16px;color:var(--muted)"> / 45</span></strong><small>Только completed-флаги</small></div><div class="stat-card"><label>Предметы в коллекции</label><strong>${p.summary.collected}</strong><small>${p.summary.unknownCollectionFlags.length?`Ещё ${p.summary.unknownCollectionFlags.length} неизвестных флага`:'Распознанные предметы'}</small></div><div class="stat-card"><label>Лучшая серия побед</label><strong>${p.counters[23]}</strong><small>Смертей: ${p.counters[10]} · Eden Tokens: ${p.counters[21]}</small></div></div>
    <div class="stats-grid"><div><section class="section-card"><h2>Листки персонажей</h2><p>✓ — Normal / Greed · H — Hard / Greedier · · — нет отметки. Доступность персонажа по секретам здесь не учитывается.</p><div class="table-scroll"><table class="marks-table"><thead><tr><th>Персонаж</th>${MARKS.map(([target,short])=>`<th title="${esc(target)}">${short}</th>`).join('')}</tr></thead><tbody>${marks}</tbody></table></div></section>
    <section class="section-card"><h2>Бестиарий боссов</h2><p>Записи сущностей могут отличаться от зачтённых побед: составные боссы учитываются отдельно.</p><div class="table-scroll"><table><thead><tr><th>Босс / вариант</th><th>Убийства</th><th>Встречи</th><th>Смерти от него</th></tr></thead><tbody>${p.bestiary.filter(e=>e.isBoss).map(e=>`<tr><td>${esc(e.name)}</td><td>${e.kills}</td><td>${e.encounters}</td><td>${e.deaths}</td></tr>`).join('')||'<tr><td colspan="4">Нет записей.</td></tr>'}</tbody></table></div></section></div>
    <div><section class="section-card"><h2>Зачтённые победы</h2><p>MOM_KILLS означает Mom’s Heart / It Lives!, а не Mom.</p>${counterTable(COUNTERS)}</section><section class="section-card"><h2>Маленькие детали</h2>${counterTable(MISC)}</section>
    <section class="section-card"><h2>Пройденные испытания</h2><p>${p.challenges.filter(c=>c.completed).map(c=>`#${c.id} ${esc(c.name)}`).join('<br>')||'В этом слоте ещё нет пройденных испытаний.'}</p></section>
    <details class="reference-box"><summary>Секреты · отдельная справка (${secrets.length})</summary><p>Флаги в файле, а не проверенный список Steam-аккаунта. Их происхождение неизвестно. Они исключены из статистики выше и не доказывают выполнение условий в этом слоте.</p><div class="reference-list">${secrets.map(s=>`<span>#${s.id} ${esc(s.name)}</span>`).join('')||'Нет установленных флагов.'}</div><div class="export-actions"><button class="button small" data-export="secrets">Скачать справку ↓</button></div></details></div></div>`;
}

function renderCondition(condition) {
  if (['all','any'].includes(condition.type)) return `<li><span class="condition-group-label">${condition.type==='all'?'НУЖНО ВСЁ':'ДОСТАТОЧНО ОДНОГО'}</span><ul class="condition-list">${condition.conditions.map(renderCondition).join('')}</ul></li>`;
  const status=state.evaluator.evaluate(condition), node=condition.type==='node'?state.evaluator.nodes.get(condition.id):null;
  const label=node?node.name:conditionLabel(condition);
  const text=node?`<button data-select="${esc(node.id)}">${esc(label)} ↗</button>`:esc(label);
  const counter=condition.type==='counter'?` <small>(${state.progress.counters[condition.id]??'?'}/${condition.atLeast})</small>`:'';
  return `<li><div class="condition-row"><span class="condition-status ${status}" aria-label="${status===STATUS.YES?'выполнено':status===STATUS.NO?'не подтверждено':'неизвестно'}">${status===STATUS.YES?'✓':status===STATUS.NO?'○':'?'}</span><span>${text}${counter}</span></div>${condition.type==='manual'?`<label class="manual-check"><input type="checkbox" data-manual="${esc(condition.key)}" ${state.manual[condition.key]?'checked':''}><span>Подтвердить вручную<br><small>${esc(condition.reason||'Это действие не хранится в сохранении.')}</small></span></label>`:''}</li>`;
}

function renderGraphSidebar() {
  const node=state.evaluator.nodes.get(state.selected);
  if (!node) { $('#graph-sidebar').innerHTML='<span class="eyebrow">ДЕТАЛИ АНЛОКА</span><h2>Выберите вершину</h2><p class="small-note">Нажмите на предмет, персонажа или маршрут в графе. Здесь появятся условия и шаги для открытия.</p>'; return; }
  const availability=state.evaluator.availability(node.id).status, collected=state.evaluator.collected(node), earned=state.evaluator.earned(node.id);
  $('#graph-sidebar').innerHTML=`<span class="detail-kind">${esc(kindNames[node.kind]||node.kind)}</span><div style="margin-top:14px">${icon(node,'detail-icon',false)}</div><h2>${esc(node.name)}</h2><p class="detail-description">${esc(node.unlock.description)}</p>
    <div class="detail-badges"><span class="${availability===STATUS.YES?'yes':availability===STATUS.NO?'no':''}">${availabilityLabel(availability)} · доступность</span>${collected==null?'':`<span class="${collected?'yes':''}">${collected?'Подобран':'Не подобран'}</span>`}</div>
    <p class="small-note"><b>${earnedLabel(earned)}</b></p>
    <div class="detail-actions"><a class="button small primary" href="${esc(wikiLink(node))}" target="_blank" rel="noopener noreferrer">Открыть вики ↗</a><a class="button small" href="${graphLink(node.id)}">Только этот путь</a></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><span class="eyebrow">ЧТО НУЖНО СДЕЛАТЬ</span><ul class="condition-list">${renderCondition(node.unlock.requirements)}</ul>
    ${node.unlock.evidence&&state.evaluator.evaluate(node.unlock.evidence)===STATUS.YES?'<p class="small-note">✓ Прямое подтверждение результата уже есть в отметках, испытаниях или счётчиках слота. Прежние шаги отдельно доказывать не нужно.</p>':''}
    <details class="detail-help"><summary>О данных и источниках</summary><p class="small-note">Доступность по секретам не доказывает выполнение условия в этом слоте. ? — сохранение не хранит всё необходимое. Ручные подтверждения действуют только в этой вкладке и сбрасываются при смене сейва.</p>
    ${node.sourceNote?`<p class="small-note">${esc(node.sourceNote)}</p>`:''}
    <div class="source-links">Источники: ${node.sources.map((url,index)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${index+1} ↗</a>`).join(' · ')}</div></details>`;
  document.querySelectorAll('.graph-node').forEach(element=>element.classList.toggle('selected',element.dataset.owner===state.selected));
  document.querySelectorAll('.graph-edge-group').forEach(element=>element.classList.toggle('connected',element.dataset.from===state.selected||element.dataset.to===state.selected));
}

function renderGraph() {
  graphView?.destroy();graphView=null;
  const params=new URLSearchParams(location.hash.split('?')[1]||''), targetId=params.get('item');
  const target=state.evaluator.nodes.get(targetId);
  if(targetId&&!target){$('#view').innerHTML='<div class="empty-state">Анлок не найден. <a href="#/graph">Полный граф</a></div>';return;}
  state.selected=targetId||state.selected;
  const graph=buildGraph(state.data,state.evaluator,{targetId,mode:state.graphMode,showOpened:state.showOpened});
  const layout=layoutGraph(graph);state.layout=layout;
  const map=new Map(layout.nodes.map(node=>[node.id,node]));
  const edges=layout.edges.map((edge,index)=>{
    const geometry=edgeGeometry(map.get(edge.from),map.get(edge.to));
    const label=edge.label.length>48?edge.label.slice(0,46)+'…':edge.label;
    return `<g class="graph-edge-group" data-edge="${index}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}"><path class="graph-edge-hit" d="${geometry.path}"/><path class="graph-edge" d="${geometry.path}" marker-end="url(#arrow)"><title>${esc(edge.label)}</title></path><text class="edge-label" x="${geometry.x}" y="${geometry.y}" text-anchor="middle">${esc(label)}</text></g>`;
  }).join('');
  const nodeSvg=layout.nodes.map(node=>{
    const title=node.name.length>27?node.name.slice(0,25)+'…':node.name,src=state.icons.get(node.id);
    const statusText=node.status===STATUS.YES?(state.graphMode==='availability'?'✓ Доступно':'✓ Подтверждено'):node.status===STATUS.UNKNOWN?'? Нужна проверка':state.graphMode==='availability'?'○ Закрыто':'○ Не подтверждено';
    return `<g class="graph-node ${node.status} ${node.kind==='gate'?'gate':''} ${node.id===state.selected?'selected':''}" data-id="${esc(node.id)}" data-owner="${esc(node.ownerId||node.id)}" tabindex="0" role="button" aria-label="${esc(node.name)}" aria-description="Перетащите блок или используйте стрелки. Enter — детали." transform="translate(${node.x},${node.y})"><title>${esc(node.name)}</title><rect width="${node.width}" height="${node.height}" rx="12"/>${src?`<image href="${esc(src)}" x="14" y="23" width="32" height="32"/>`:''}<text x="${src?58:16}" y="21" class="node-kind">${esc(kindNames[node.kind]||node.kind)}</text><text x="${src?58:16}" y="41">${esc(title)}</text><text x="${src?58:16}" y="61" class="node-state">${statusText}</text></g>`;
  }).join('');
  $('#view').innerHTML=`<div class="page-heading graph-heading"><div><span class="eyebrow">КАРТА ЗАВИСИМОСТЕЙ</span><h1>${target?esc(target.name):'Граф анлоков'}<span class="title-dot">.</span></h1></div><a class="button small" href="${target?'#/graph':'#/tiers'}">${target?'Весь граф ↗':'← Тирлист'}</a></div>
    <div class="graph-toolbar"><select id="graph-mode" aria-label="Основа графа"><option value="progress">Прогресс слота</option><option value="availability">Доступность контента</option></select>
    <select id="graph-focus" aria-label="Выбрать путь анлока"><option value="">Все анлоки</option>${state.data.nodes.toSorted((a,b)=>a.name.localeCompare(b.name)).map(node=>`<option value="${esc(node.id)}">${esc(node.name)}</option>`).join('')}</select>
    <label class="checkbox-label"><input type="checkbox" id="show-opened" ${state.showOpened?'checked':''}>${state.graphMode==='availability'?'Открытые':'Выполненные'}</label><span class="spacer"></span><button class="button small" id="reset-layout" title="Плавно вернуть блоки на свои места">Упорядочить</button><div class="zoom-controls"><button data-zoom="out" aria-label="Уменьшить граф">−</button><span id="zoom-label"></span><button data-zoom="in" aria-label="Увеличить граф">+</button></div><button class="button small" id="fit-graph">Вписать</button></div>
    <div class="graph-mode-note ${state.graphMode==='availability'?'reference':''}">${state.graphMode==='progress'?'● Прогресс этого слота. Секреты и достижения Steam не засчитываются.':'● Доступность по секретам. Не подтверждает заслуги в этом слоте.'}</div>
    <div class="graph-layout"><div class="graph-panel"><div class="graph-canvas ${target?'':'overview'}" id="graph-canvas">${layout.nodes.length?`<svg id="unlock-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="group" aria-label="Вертикальный граф зависимостей"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" class="arrow-head"/></marker></defs>${edges}${nodeSvg}</svg>`:'<div class="graph-empty"><h2>Всё готово</h2><p>Покажите выполненные шаги или измените основу графа.</p></div>'}</div><div class="graph-bottom"><span>${graph.nodes.filter(n=>!['gate','condition'].includes(n.kind)).length} анлоков · ${graph.edges.length} связей</span><span>Колёсико — зум · блоки и фон можно двигать</span></div></div><aside class="graph-sidebar" id="graph-sidebar" aria-label="Условия выбранного анлока"></aside></div>`;
  $('#graph-mode').value=state.graphMode;$('#graph-focus').value=targetId||'';
  $('#graph-mode').addEventListener('change',event=>{state.graphMode=event.target.value;renderGraph();});
  $('#graph-focus').addEventListener('change',event=>{location.hash=graphLink(event.target.value);});
  $('#show-opened').addEventListener('change',event=>{state.showOpened=event.target.checked;renderGraph();});
  $('#fit-graph').addEventListener('click',()=>graphView?.fit());
  $('#reset-layout').addEventListener('click',()=>graphView?.reset());
  renderGraphSidebar();
  if(layout.nodes.length){
    const scope=`${targetId||'*'}:${state.graphMode}:${state.showOpened}`;
    if(!graphPositions.has(scope))graphPositions.set(scope,new Map());
    graphView=createGraphView({canvas:$('#graph-canvas'),svg:$('#unlock-svg'),layout,zoom:state.zoom,positions:graphPositions.get(scope),onSelect:id=>{state.selected=id;renderGraphSidebar();},onZoom:zoom=>{state.zoom=zoom;$('#zoom-label').textContent=`${Math.round(zoom*100)}%`;}});
  }
}

function renderPage() {
  if (!state.save) return;
  graphView?.destroy();graphView=null;
  const requested=location.hash.slice(2).split('?')[0];state.page=['tiers','stats','graph'].includes(requested)?requested:'tiers';
  document.querySelectorAll('.main-nav a').forEach(link=>{link.classList.toggle('active',link.dataset.page===state.page);if(link.dataset.page===state.page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  if(state.page==='stats')renderStats();else if(state.page==='graph')renderGraph();else renderTiers();
  document.title=`${state.page==='stats'?'Статистика':state.page==='graph'?'Карта анлоков':'Тирлист'} — Unlock Atlas`;
}

function download(kind) {
  let data;
  if (kind==='secrets') data={file:state.fileName,excludedFromGameplayAnalysis:true,source:'save_chunk_1',steamAccount:{status:'not_queried',achievements:null},
    achievements:state.save.chunks.achievements.flatMap((value,id)=>id?[{saveSecretId:id,name:state.catalog.secrets?.[id]?.name||`Секрет #${id}`,unlocked:!!value,earnedInThisSlot:null}]:[])};
  else data={file:state.fileName,checksum:state.save.checksum,progress:state.progress};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');
  link.href=url;link.download=`${state.fileName.replace(/\.dat$/i,'')}.${kind}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$('#view').addEventListener('click',event=>{
  const graph=event.target.closest('[data-graph]');if(graph){location.hash=graphLink(graph.dataset.graph);return;}
  const selected=event.target.closest('.graph-node,[data-select]');if(selected){state.selected=selected.dataset.owner||selected.dataset.select;renderGraphSidebar();return;}
  const zoom=event.target.closest('[data-zoom]');if(zoom){graphView?.setZoom(graphView.zoom*(zoom.dataset.zoom==='in'?1.2:1/1.2));return;}
  const exported=event.target.closest('[data-export]');if(exported)download(exported.dataset.export);
});
$('#view').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('.graph-node')){event.preventDefault();state.selected=event.target.dataset.owner;renderGraphSidebar();}});
$('#view').addEventListener('change',event=>{if(event.target.matches('[data-manual]')){const key=event.target.dataset.manual;state.manual[key]=event.target.checked;refreshEvaluator();renderGraph();[...document.querySelectorAll('[data-manual]')].find(input=>input.dataset.manual===key)?.focus({preventScroll:true});toast('Ручное подтверждение обновлено только в этой вкладке.');}});
function updateThemeButton() {
  const dark=document.documentElement.dataset.theme==='dark', button=$('#theme-toggle');
  button.textContent=dark?'☀':'☾';button.setAttribute('aria-label',dark?'Включить светлую тему':'Включить тёмную тему');button.title=button.getAttribute('aria-label');
  document.querySelector('meta[name="theme-color"]').content=dark?'#111318':'#f7f8fa';
}
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
  const label=paused?'Продолжить анимацию':'Приостановить анимацию';
  $('#demo-pause').setAttribute('aria-label',label);$('#demo-pause').title=label;$('#demo-pause').textContent=paused?'▷':'Ⅱ';
});
$('#save-input').addEventListener('change',event=>loadFile(event.target.files[0]));
$('#change-save').addEventListener('click',()=>$('#save-input').click());$('#clear-save').addEventListener('click',resetSave);
document.querySelectorAll('[data-os]').forEach(button=>button.addEventListener('click',()=>setPaths(button.dataset.os)));
const drop=$('#dropzone');drop.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();$('#save-input').click();}});
for(const eventName of ['dragenter','dragover'])drop.addEventListener(eventName,event=>{event.preventDefault();drop.classList.add('dragging');});
for(const eventName of ['dragleave','drop'])drop.addEventListener(eventName,event=>{event.preventDefault();drop.classList.remove('dragging');});
drop.addEventListener('drop',event=>{if(event.dataTransfer.files.length)loadFile(event.dataTransfer.files[0]);});
window.addEventListener('hashchange',()=>{if(location.hash==='#main')return;renderPage();window.scrollTo(0,0);});setPaths('windows');

try {
  const urls=['../data/unlocks.json','../data/game-catalog.json','../assets/icons/manifest.json'];
  const [data,catalog,manifest]=await Promise.all(urls.map(async url=>{const response=await fetch(new URL(url,import.meta.url));if(!response.ok)throw new Error('Не удалось загрузить каталог. Перезагрузите страницу.');return response.json();}));
  const errors=validateCatalog(data);if(errors.length)throw new Error(`Ошибка каталога: ${errors[0]}`);
  state.data=data;state.catalog=catalog;state.icons=new Map(manifest.icons.filter(entry=>['downloaded','designed'].includes(entry.status)).map(entry=>[entry.nodeId,entry.path]));
  if(state.pendingFile){const file=state.pendingFile;delete state.pendingFile;loadFile(file);}
  if(location.protocol==='file:')throw new Error('Откройте сайт через HTTP-сервер или GitHub Pages.');
} catch(error) { $('#upload-status').classList.add('error');$('#upload-status').textContent=error.message;toast(error.message); }
