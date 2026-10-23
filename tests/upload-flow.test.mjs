import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSave,kageChecksum,emptySaveBytes} from '../site/js/save-parser.js';

// DOM doubles exercise the actual upload handlers and generated screens without a browser.
class Element {
  constructor(){this.hidden=false;this.value='';this.textContent='';this.innerHTML='';this.dataset={};this.attrs={};this.events=new Map();this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(name,callback){this.events.set(name,callback);}
  setAttribute(name,value){this.attrs[name]=value;}
  getAttribute(name){return this.attrs[name]||null;}
  removeAttribute(name){delete this.attrs[name];}
  focus(){}
  replaceChildren(){this.innerHTML='';}
  removeEventListener(name){this.events.delete(name);}
  querySelectorAll(){return [];}
}
async function app(t,{savedLanguage=null,savedEntries=[]}={}){
  const ids=[...fs.readFileSync('site/index.html','utf8').matchAll(/id="([^"]+)"/g)].map(m=>'#'+m[1]);
  const elements=new Map([...ids,'.brand','.main-nav','meta[name="theme-color"]','#item-search','#status-filter','#kind-filter','#show-default-open','#tier-rows','#result-count','#next-up', '#graph-mode','#graph-settings','#graph-focus','#show-opened','#fit-graph','#reset-layout','#graph-sidebar','#graph-canvas','#unlock-svg','#zoom-label','#phase-hide-obtained'].map(id=>[id,new Element()]));
  const nav=['tiers','phases','stats','graph','roulette'].map(page=>{const element=new Element();element.dataset.page=page;return element;});
  const os=['windows','mac','linux'].map(value=>{const element=new Element();element.dataset.os=value;return element;});
  const languages=['ru','en'].map(value=>{const element=new Element();element.dataset.language=value;return element;});
  const storage=new Map(savedEntries),windowEvents=new Map();
  if(savedLanguage)storage.set('atlas-language',savedLanguage);
  Object.assign(elements.get('#graph-canvas'),{clientWidth:652,clientHeight:460,scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:0})});
  const replacements={
    document:{querySelector(selector){const result=elements.get(selector);if(!result)throw new Error('Unregistered DOM selector '+selector);return result;},querySelectorAll(selector){return selector==='.main-nav a'?nav:selector==='[data-os]'?os:selector==='[data-language]'?languages:[];},documentElement:{dataset:{theme:'light'}},title:''},
    window:{addEventListener:(name,handler)=>windowEvents.set(name,handler),scrollTo(){}},location:{hash:'#/',protocol:'http:'},
    fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(url,'utf8'))}),
    setTimeout:()=>1,clearTimeout:()=>{},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    matchMedia:()=>({matches:false}),cancelAnimationFrame(){},
  };
  const originals=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(replacements))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  t.after(()=>{for(const [key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  await import(`../site/js/app.js?upload-test=${Math.random()}`);
  async function upload(name,bytes=fs.readFileSync('context/'+name)){
    const file={name,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    await elements.get('#save-input').events.get('change')({target:{files:[file]}});
  }
  return {elements,upload,storage,switchLanguage:language=>languages.find(button=>button.dataset.language===language).events.get('click')(),navigate:hash=>{location.hash=hash;windowEvents.get('hashchange')();}};
}

test('phases keep manual milestones through language changes and restoration, and clear them for another save',async t=>{
  const change=(context,checked)=>context.elements.get('#view').events.get('change')({target:{dataset:{phaseManual:'defeat-mom'},checked}});
  let savedEntries;
  await t.test('record a manual milestone',async sub=>{
    const first=await app(sub);
    await first.elements.get('#hero-empty').events.get('click')();
    first.navigate('#/phases');
    assert.match(first.elements.get('#view').innerHTML,/One save\. A whole journey\./);
    change(first,true);
    assert.match(first.elements.get('#view').innerHTML,/Confirmed manually/);
    assert.match(first.elements.get('#view').innerHTML,/class="phase-award"/);
    assert.deepEqual(JSON.parse(first.storage.get('skill-issue-save')).phaseManual,{'defeat-mom':true});
    first.switchLanguage('ru');
    assert.doesNotMatch(first.elements.get('#view').innerHTML,/class="phase-award"/);
    assert.match(first.elements.get('#view').innerHTML,/Подтверждено вручную/);
    assert.match(first.elements.get('#view').innerHTML,/Цикл сердца/);
    savedEntries=[...first.storage];
  });
  await t.test('restore and revoke it, then change saves',async sub=>{
    const restored=await app(sub,{savedEntries});
    restored.navigate('#/phases');
    assert.match(restored.elements.get('#view').innerHTML,/Подтверждено вручную/);
    assert.doesNotMatch(restored.elements.get('#view').innerHTML,/class="phase-award"/);
    change(restored,false);
    assert.doesNotMatch(restored.elements.get('#view').innerHTML,/class="phase-award"/);
    assert.equal(JSON.parse(restored.storage.get('skill-issue-save')).phaseManual,undefined);
    change(restored,true);
    await restored.upload('another-slot.dat',emptySaveBytes());
    restored.navigate('#/phases');
    assert.doesNotMatch(restored.elements.get('#view').innerHTML,/Подтверждено вручную/);
  });
});

test('phase recommendation filters and disclosure state survive language changes without changing phase status',async t=>{
  const {elements,upload,navigate,switchLanguage}=await app(t);
  const bytes=Buffer.from(emptySaveBytes()),parsed=parseSave(bytes);
  bytes[parsed.layout.find(chunk=>chunk.name==='collection').dataOffset+119]=1;
  bytes.writeUInt32LE(kageChecksum(bytes.subarray(16,-4)),bytes.length-4);
  await upload('recommendations.dat',bytes);navigate('#/phases');
  const view=()=>elements.get('#view').innerHTML;
  assert.match(view(),/data-phase-item="collectible:119"/);
  assert.match(view(),/#\/graph\?item=collectible%3A119/);
  assert.match(view(),/data-phase="mom" data-status="unknown"/);
  elements.get('#view').events.get('toggle')({target:{dataset:{phaseRecommendations:'mom'},open:false}});
  elements.get('#view').events.get('change')({target:{dataset:{phaseFilter:'obtained'},checked:true}});
  assert.doesNotMatch(view(),/data-phase-item="collectible:119"/);
  assert.match(view(),/data-phase="mom" data-status="unknown"/);
  switchLanguage('ru');
  assert.match(view(),/id="phase-hide-obtained"[^>]*checked/);
  assert.match(view(),/ЧТО ОТКРЫТЬ В ЭТОЙ ФАЗЕ/);
  assert.match(view(),/data-phase-recommendations="mom" >/);
  assert.doesNotMatch(view(),/class="phase-award"/);
});

test('actual upload flow opens Repentance+ tierlist and keeps the previous save when gamestate is selected',{skip:!fs.existsSync('context/rep+persistentgamedata1.dat')},async t=>{
  const {elements,upload}=await app(t);await upload('rep+persistentgamedata1.dat');
  assert.equal(elements.get('#save-edition').textContent,'Repentance+');
  assert.equal(elements.get('#onboarding').hidden,true);assert.equal(elements.get('#workspace').hidden,false);
  assert.equal(location.hash,'#/tiers');assert.match(elements.get('#tier-rows').innerHTML,/Dead God/);
  const allItems=elements.get('#result-count').textContent;
  elements.get('#show-default-open').events.get('change')({target:{checked:false}});
  const withoutDefault=elements.get('#result-count').textContent;
  assert.notEqual(withoutDefault,allItems);assert.match(elements.get('#tier-rows').innerHTML,/Dead God/);
  elements.get('#show-default-open').events.get('change')({target:{checked:true}});
  assert.equal(elements.get('#result-count').textContent,allItems);
  await upload('rep+gamestate2.dat',Buffer.concat([Buffer.from('ISAACNG_GSR0169'),Buffer.alloc(20)]));
  assert.equal(elements.get('#file-error').hidden,false);
  assert.match(elements.get('#file-error').textContent,/rep\+persistentgamedata2.dat/);
  assert.equal(elements.get('#save-name').textContent,'rep+persistentgamedata1.dat');
});
test('collected items automatically override a false secret flag and satisfy their unlock across tier and graph views',async t=>{
  const {elements,upload,navigate,switchLanguage}=await app(t);
  const bytes=Buffer.from(emptySaveBytes()),parsed=parseSave(bytes);
  bytes[parsed.layout.find(chunk=>chunk.name==='collection').dataOffset+538]=1; // Marbles, with its secret flag off.
  bytes.writeUInt32LE(kageChecksum(bytes.subarray(16,bytes.length-4)),bytes.length-4);
  await upload('collected-item.dat',bytes);
  const card=()=>elements.get('#tier-rows').innerHTML.match(/<article class="item-card[^>]*data-node="collectible:538"[^>]*>([\s\S]*?)<\/article>/)?.[1]||'';
  assert.doesNotMatch(elements.get('#view').innerHTML,/infer-save-evidence|Use save data/);
  assert.match(card(),/availability-dot yes/);
  assert.match(card(),/Collected in this save, so considered unlocked/);
  elements.get('#status-filter').events.get('change')({target:{value:'open'}});
  assert.match(elements.get('#tier-rows').innerHTML,/data-node="collectible:538"/);
  navigate('#/graph?item=collectible:538');
  elements.get('#graph-mode').events.get('change')({target:{value:'availability'}});
  assert.doesNotMatch(elements.get('#view').innerHTML,/infer-save-evidence|Use save data|evidence-tooltip/);
  assert.match(elements.get('#view').innerHTML,/Shows what is available and what remains to unlock/);
  assert.match(elements.get('#view').innerHTML,/✓ Available/);
  elements.get('#graph-mode').events.get('change')({target:{value:'progress'}});
  assert.match(elements.get('#view').innerHTML,/Checks recorded progress in this slot/);
  assert.match(elements.get('#view').innerHTML,/✓ Unlocked by collection/);
  const sidebar=()=>elements.get('#graph-sidebar').innerHTML;
  assert.match(sidebar(),/Unlock confirmed by collection/);
  assert.match(sidebar(),/No manual confirmation is needed/);
  assert.doesNotMatch(sidebar(),/data-manual=/);
  assert.deepEqual([...elements.get('#view').innerHTML.matchAll(/[А-Яа-яЁё]+/g)].map(([word])=>word),[]);
  switchLanguage('ru');
  assert.match(sidebar(),/Ручное подтверждение условия не требуется/);
  assert.match(elements.get('#view').innerHTML,/✓ Открыт по коллекции/);
  assert.doesNotMatch(elements.get('#view').innerHTML,/Учитывать данные сейва/);
  switchLanguage('en');
  elements.get('#graph-mode').events.get('change')({target:{value:'availability'}});
  assert.match(elements.get('#view').innerHTML,/✓ Available/);
  navigate('#/tiers');
  assert.match(card(),/availability-dot yes/);
});
test('a single save shows Planetarium availability without demanding historical proof, and lists locked flags separately',async t=>{
  const {elements,upload,navigate,switchLanguage}=await app(t),bytes=Buffer.from(emptySaveBytes()),parsed=parseSave(bytes);
  bytes[parsed.layout.find(chunk=>chunk.name==='achievements').dataOffset+406]=1;
  bytes.writeUInt32LE(kageChecksum(bytes.subarray(16,-4)),bytes.length-4);
  await upload('one-slot.dat',bytes);navigate('#/graph?item=trinket:152');
  const view=()=>elements.get('#view').innerHTML;
  assert.equal(elements.get('#graph-mode').value,'availability');
  assert.match(view(),/<g class="graph-node satisfied[^\"]*" data-id="trinket:152"/);
  assert.match(view(),/<details id="graph-settings" class="graph-settings" >[\s\S]*id="graph-mode"/);
  assert.doesNotMatch(view().match(/<div class="graph-toolbar">([\s\S]*?)<\/div>/)[1],/id="graph-mode"/);
  assert.match(view(),/this file cannot identify their origin/);
  assert.match(view(),/The site does not read your Steam account/);
  assert.match(view(),/collecting three different astrology items in one run remains unverified/);
  let sidebar=elements.get('#graph-sidebar').innerHTML;
  assert.match(sidebar,/Unlocked in this save\./);
  assert.match(sidebar,/No manual confirmation is needed for availability\./);
  assert.match(sidebar,/Review the original unlock action \(optional\)/);
  assert.match(sidebar,/Unlock action in this slot: Needs verification/);
  elements.get('#graph-settings').events.get('toggle')({target:{open:true}});
  elements.get('#graph-mode').events.get('change')({target:{value:'progress'}});
  assert.match(view(),/<details id="graph-settings" class="graph-settings" open>/);
  assert.match(view(),/<g class="graph-node unknown[^\"]*" data-id="trinket:152"/);
  switchLanguage('ru');sidebar=elements.get('#graph-sidebar').innerHTML;
  assert.equal(elements.get('#graph-mode').value,'progress');
  assert.match(view(),/Данные, ограничения и настройки/);
  assert.match(view(),/Сайт не запрашивает данные вашего аккаунта Steam/);
  assert.match(view(),/Флаги открытия не учитываются/);
  assert.match(view(),/<details id="graph-settings" class="graph-settings" open>/);
  assert.match(sidebar,/Открыто в этом сохранении/);
  assert.match(sidebar,/Для определения доступности ручное подтверждение не требуется/);
  assert.doesNotMatch(sidebar,/No manual confirmation is needed for availability/);
  switchLanguage('en');navigate('#/stats');
  const stats=elements.get('#view').innerHTML;
  assert.match(stats,/Unlock availability.*1 \/ 641/);
  assert.match(stats,/data-save-secret="406" data-unlocked="true"/);
  assert.match(stats,/data-save-secret="407" data-unlocked="false"/);
  assert.equal([...stats.matchAll(/data-save-secret=/g)].length,641);
  assert.match(stats,/They are excluded from the statistics above/);
  navigate('#/graph?item=trinket:152');
  assert.equal(elements.get('#graph-mode').value,'progress');
  elements.get('#graph-mode').events.get('change')({target:{value:'availability'}});
  navigate('#/stats');assert.equal(elements.get('#view').innerHTML,stats);
  navigate('#/graph?item=trinket:152');
  elements.get('#graph-mode').events.get('change')({target:{value:'progress'}});
  await upload('another-slot.dat',bytes);navigate('#/graph?item=trinket:152');
  assert.equal(elements.get('#graph-mode').value,'availability');
  assert.match(view(),/<details id="graph-settings" class="graph-settings" >/);
});
test('actual Rebirth upload renders its own 66 marks and 20 challenges with a compatibility explanation',{skip:!fs.existsSync('context/persistentgamedata1.dat')},async t=>{
  const {elements,upload}=await app(t);await upload('persistentgamedata1.dat');
  assert.equal(location.hash,'#/stats');assert.equal(elements.get('#save-edition').textContent,'Rebirth');
  const html=elements.get('#view').innerHTML;
  assert.match(html,/Rebirth save loaded/);assert.match(html,/\/ 66/);assert.match(html,/\/ 20/);
  assert.doesNotMatch(html,/\/ 408/);assert.match(html,/Rebirth does not store a bestiary/);
});
test('initial incorrect upload keeps instructions visible and expands the file guide',async t=>{
  const {elements,upload}=await app(t);elements.get('#workspace').hidden=true;
  assert.ok(elements.get('#save-paths').innerHTML.includes('C:\\Program Files (x86)\\Steam\\userdata'));
  assert.ok(!elements.get('#save-paths').innerHTML.includes('C:\\\\Program')); 
  await upload('rep+gamestate1.dat',Buffer.concat([Buffer.from('ISAACNG_GSR0169'),Buffer.alloc(20)]));
  assert.equal(elements.get('#workspace').hidden,true);
  assert.equal(elements.get('#save-help').open,true);
  assert.match(elements.get('#upload-status').textContent,/persistent progress/);
});

test('continuing without a save opens an empty Repentance+ slot; the brand leads home and back to the same page',async t=>{
  const {elements,storage,navigate}=await app(t);
  await elements.get('#hero-empty').events.get('click')();
  assert.equal(elements.get('#save-name').textContent,'No save file');assert.equal(elements.get('#save-edition').textContent,'Repentance+');
  assert.equal(location.hash,'#/tiers');assert.equal(elements.get('#workspace').hidden,false);assert.equal(elements.get('#onboarding').hidden,true);
  assert.equal(elements.get('#reload-save').hidden,true,'an empty slot has no file to reload');
  assert.deepEqual(JSON.parse(storage.get('skill-issue-save')),{empty:true});
  assert.match(elements.get('#next-up').innerHTML,/next-card/);
  navigate('#/stats');navigate('#/');
  assert.equal(elements.get('#onboarding').hidden,false);assert.equal(elements.get('#workspace').hidden,true);
  assert.equal(elements.get('#resume-save').hidden,false);assert.equal(elements.get('#resume-name').textContent,'No save file');
  assert.equal(elements.get('#resume-link').href,'#/stats');assert.equal(elements.get('.main-nav').hidden,false);
  navigate(elements.get('#resume-link').href);
  assert.equal(elements.get('#workspace').hidden,false);assert.equal(elements.get('#resume-save').hidden,true);
  assert.match(document.title,/Statistics/);
});
test('reload rereads the chosen file in place and reports when nothing changed',async t=>{
  const {elements,navigate}=await app(t);
  let bytes=emptySaveBytes('repentance');
  const file={name:'rep_persistentgamedata1.dat',arrayBuffer:async()=>bytes.buffer};
  await elements.get('#save-input').events.get('change')({target:{files:[file]}});
  assert.equal(elements.get('#save-edition').textContent,'Repentance');assert.equal(elements.get('#reload-save').hidden,false);
  navigate('#/stats');
  await elements.get('#reload-save').events.get('click')();
  assert.equal(elements.get('#toast').textContent,'The file has not changed since it was loaded.');
  bytes=emptySaveBytes('repentance-plus');
  await elements.get('#strip-reload-save').events.get('click')();
  assert.equal(elements.get('#save-edition').textContent,'Repentance+');assert.equal(location.hash,'#/stats');
  assert.equal(elements.get('#save-name').textContent,'rep_persistentgamedata1.dat');
  assert.equal(elements.get('#toast').textContent,'Save reloaded from the file.');
  elements.get('#clear-save').events.get('click')();
  assert.equal(elements.get('#reload-save').hidden,true);assert.equal(elements.get('#resume-save').hidden,true);
});

test('English is the default; switching to Russian persists and rerenders tiers/statistics without reuploading or losing filters',{skip:!fs.existsSync('context/rep+persistentgamedata1.dat')},async t=>{
  const {elements,upload,switchLanguage,storage,navigate}=await app(t);await upload('rep+persistentgamedata1.dat');
  assert.equal(document.documentElement.lang,'en');
  assert.deepEqual([...elements.get('#view').innerHTML.matchAll(/[А-Яа-яЁё]+/g)].map(([word])=>word),[]);
  elements.get('#item-search').events.get('input')({target:{value:'Marbles'}});
  elements.get('#status-filter').events.get('change')({target:{value:'open'}});
  elements.get('#kind-filter').events.get('change')({target:{value:'collectible'}});
  const before=elements.get('#result-count').textContent;
  switchLanguage('ru');
  assert.equal(document.documentElement.lang,'ru');assert.equal(storage.get('atlas-language'),'ru');
  assert.equal(elements.get('#save-name').textContent,'rep+persistentgamedata1.dat');
  assert.match(elements.get('#view').innerHTML,/value="Marbles"/);
  assert.deepEqual(elements.get('#result-count').textContent.match(/\d+/g),before.match(/\d+/g));
  assert.equal(elements.get('#status-filter').value,'open');assert.equal(elements.get('#kind-filter').value,'collectible');
  assert.match(elements.get('#view').innerHTML,/Тирлист/);
  navigate('#/stats');assert.match(document.title,/Статистика/);
  assert.match(elements.get('#view').innerHTML,/не участвуют/);
  switchLanguage('en');assert.match(elements.get('#view').innerHTML,/do not contribute/);
  assert.deepEqual([...elements.get('#view').innerHTML.matchAll(/[А-Яа-яЁё]+/g)].map(([word])=>word),[]);
  assert.equal(storage.get('atlas-language'),'en');assert.equal(location.hash,'#/stats');
});

test('saved Russian preference localizes file errors, theme and Rebirth statistics',{skip:!fs.existsSync('context/persistentgamedata1.dat')},async t=>{
  const {elements,upload,switchLanguage}=await app(t,{savedLanguage:'ru'});
  assert.equal(document.documentElement.lang,'ru');assert.match(elements.get('#theme-toggle').getAttribute('aria-label'),/светлую|тёмную/);
  await upload('rep+gamestate2.dat',Buffer.concat([Buffer.from('ISAACNG_GSR0169'),Buffer.alloc(20)]));
  assert.match(elements.get('#upload-status').textContent,/rep\+persistentgamedata2.dat/);
  assert.match(elements.get('#upload-status').textContent,/общий прогресс/);
  switchLanguage('en');assert.match(elements.get('#upload-status').textContent,/persistent progress/);
  assert.doesNotMatch(elements.get('#upload-status').textContent,/[А-Яа-яЁё]/);
  switchLanguage('ru');await upload('persistentgamedata1.dat');
  assert.match(elements.get('#view').innerHTML,/Сохранение Rebirth прочитано/);
  assert.equal(location.hash,'#/stats');assert.match(elements.get('#save-meta').textContent,/ КБ /);
});

test('switching graph language preserves manual facts, selected node and zoom',async t=>{
  const {elements,upload,switchLanguage,navigate}=await app(t);await upload('manual-action.dat',emptySaveBytes());
  navigate('#/graph?item=collectible:538'); // Marbles, including its unrecorded five-Gulp action.
  elements.get('#graph-mode').events.get('change')({target:{value:'progress'}});
  assert.match(elements.get('#graph-sidebar').innerHTML,/Marbles/);
  const key=elements.get('#graph-sidebar').innerHTML.match(/data-manual="([^"]+)"/)[1];
  elements.get('#view').events.get('change')({target:{matches:()=>true,dataset:{manual:key},checked:true}});
  const canvas=elements.get('#graph-canvas');
  canvas.events.get('wheel')({preventDefault(){},deltaY:-80,deltaMode:0,clientX:100,clientY:100});
  const zoom=elements.get('#zoom-label').textContent;canvas.scrollLeft=25;canvas.scrollTop=70;
  switchLanguage('ru');
  assert.equal(elements.get('#zoom-label').textContent,zoom);assert.equal(canvas.scrollLeft,25);assert.equal(canvas.scrollTop,70);
  assert.match(elements.get('#graph-sidebar').innerHTML,new RegExp(`data-manual="${key}" checked`));
  assert.match(elements.get('#graph-sidebar').innerHTML,/[А-Яа-яЁё]/);
  switchLanguage('en');
  assert.match(elements.get('#graph-sidebar').innerHTML,new RegExp(`data-manual="${key}" checked`));
  assert.doesNotMatch(elements.get('#graph-sidebar').innerHTML,/[А-Яа-яЁё]/);
  assert.deepEqual([...elements.get('#view').innerHTML.matchAll(/[А-Яа-яЁё]+/g)].map(([word])=>word),[]);
  assert.match(elements.get('#graph-sidebar').innerHTML,/Use Gulp! five times/);
  elements.get('#view').events.get('click')({target:{closest:selector=>selector==='.graph-node,[data-select]'?{dataset:{select:'feature:gulp'}}:null}});
  switchLanguage('ru');assert.match(elements.get('#graph-sidebar').innerHTML,/<h2>Gulp!<\/h2>/);
  switchLanguage('en');assert.match(elements.get('#graph-sidebar').innerHTML,/<h2>Gulp!<\/h2>/);
  navigate('#/graph');assert.doesNotMatch(elements.get('#view').innerHTML,/[А-Яа-яЁё]/);
  navigate('#/graph?item=feature:dead-god');
  assert.doesNotMatch(elements.get('#graph-sidebar').innerHTML,/[А-Яа-яЁё]/);
});

test('click and keyboard selection highlight a junction and its immediate neighbors while showing its reward details',{skip:!fs.existsSync('context/rep+persistentgamedata1.dat')},async t=>{
  const {elements,upload,navigate}=await app(t);await upload('rep+persistentgamedata1.dat');
  navigate('#/graph?item=feature:dead-god');
  const markup=elements.get('#view').innerHTML;
  const nodes=[...markup.matchAll(/<g class="graph-node ([^"]*)" data-id="([^"]+)" data-owner="([^"]+)"/g)].map(([,classes,id,owner])=>{
    const element=new Element();element.dataset={id,owner};element.classes=new Set(classes.split(' '));
    element.classList.toggle=(name,enabled)=>enabled?element.classes.add(name):element.classes.delete(name);
    return element;
  });
  const edges=[...markup.matchAll(/<g class="graph-edge-group" data-edge="(\d+)" data-from="([^"]+)" data-to="([^"]+)"/g)].map(([,index,from,to])=>{
    const element=new Element();element.dataset={edge:index,from,to};element.classes=new Set();
    element.classList.toggle=(name,enabled)=>enabled?element.classes.add(name):element.classes.delete(name);
    return element;
  });
  const queryAll=document.querySelectorAll;
  document.querySelectorAll=selector=>selector==='.graph-node'?nodes:selector==='.graph-edge-group'?edges:queryAll(selector);
  const junction=nodes.find(node=>node.classes.has('gate'));
  assert.ok(junction);assert.notEqual(junction.dataset.id,junction.dataset.owner);
  const check=selected=>{
    const neighbors=new Set([selected.dataset.id]);
    for(const edge of edges)if(edge.dataset.from===selected.dataset.id||edge.dataset.to===selected.dataset.id){neighbors.add(edge.dataset.from);neighbors.add(edge.dataset.to);}
    for(const node of nodes){
      assert.equal(node.classes.has('selected'),node===selected);
      assert.equal(node.classes.has('connected'),node!==selected&&neighbors.has(node.dataset.id));
      assert.equal(node.classes.has('branch-muted'),!neighbors.has(node.dataset.id));
    }
    for(const edge of edges)assert.equal(edge.classes.has('connected'),edge.dataset.from===selected.dataset.id||edge.dataset.to===selected.dataset.id);
  };
  elements.get('#view').events.get('click')({target:{closest:selector=>selector==='.graph-node,[data-select]'?junction:null}});
  check(junction);assert.doesNotMatch(elements.get('#graph-sidebar').innerHTML,/Select a node/);
  const reward=nodes.find(node=>node.dataset.id===junction.dataset.owner);
  elements.get('#view').events.get('click')({target:{closest:selector=>selector==='.graph-node,[data-select]'?reward:null}});
  check(reward);
  elements.get('#view').events.get('keydown')({key:'Enter',preventDefault(){},target:{matches:()=>true,dataset:junction.dataset}});
  check(junction);
});
