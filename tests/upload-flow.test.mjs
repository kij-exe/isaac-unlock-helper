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
async function app(t,{savedLanguage=null}={}){
  const ids=[...fs.readFileSync('site/index.html','utf8').matchAll(/id="([^"]+)"/g)].map(m=>'#'+m[1]);
  const elements=new Map([...ids,'.brand','.main-nav','meta[name="theme-color"]','#item-search','#status-filter','#kind-filter','#show-default-open','#infer-save-evidence','#tier-rows','#result-count','#next-up', '#graph-mode','#graph-focus','#show-opened','#fit-graph','#reset-layout','#graph-sidebar','#graph-canvas','#unlock-svg','#zoom-label'].map(id=>[id,new Element()]));
  const nav=['tiers','stats','graph'].map(page=>{const element=new Element();element.dataset.page=page;return element;});
  const os=['windows','mac','linux'].map(value=>{const element=new Element();element.dataset.os=value;return element;});
  const languages=['ru','en'].map(value=>{const element=new Element();element.dataset.language=value;return element;});
  const storage=new Map(savedLanguage?[['atlas-language',savedLanguage]]:[]),windowEvents=new Map();
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
test('collected items override a false secret flag and satisfy their unlock when save evidence inference is enabled',{skip:!fs.existsSync('context/rep+persistentgamedata1.dat')},async t=>{
  const {elements,upload,navigate,switchLanguage}=await app(t);
  const bytes=Buffer.from(fs.readFileSync('context/rep+persistentgamedata1.dat'));
  const parsed=parseSave(bytes,{fileName:'rep+persistentgamedata1.dat'});
  const secrets=parsed.layout.find(chunk=>chunk.name==='achievements');
  bytes[secrets.dataOffset+386]=0; // Marbles, already present in this save's collection.
  bytes.writeUInt32LE(kageChecksum(bytes.subarray(16,bytes.length-4)),bytes.length-4);
  await upload('rep+persistentgamedata1.dat',bytes);
  const card=()=>elements.get('#tier-rows').innerHTML.match(/<article class="item-card[^>]*data-node="collectible:538">([\s\S]*?)<\/article>/)?.[1]||'';
  assert.match(card(),/availability-dot no/);
  elements.get('#infer-save-evidence').events.get('change')({target:{checked:true}});
  assert.match(card(),/availability-dot yes/);
  assert.match(card(),/Collected in this save, so considered unlocked/);
  elements.get('#status-filter').events.get('change')({target:{value:'open'}});
  assert.match(elements.get('#tier-rows').innerHTML,/data-node="collectible:538"/);
  navigate('#/graph?item=collectible:538');
  elements.get('#graph-mode').events.get('change')({target:{value:'availability'}});
  assert.match(elements.get('#view').innerHTML,/id="infer-save-evidence"[^>]*checked/);
  assert.match(elements.get('#view').innerHTML,/evidence-tooltip/);
  assert.match(elements.get('#view').innerHTML,/● Availability includes slot data/);
  assert.match(elements.get('#view').innerHTML,/✓ Available/);
  elements.get('#graph-mode').events.get('change')({target:{value:'progress'}});
  assert.match(elements.get('#view').innerHTML,/● This slot’s progress includes collection data/);
  assert.match(elements.get('#view').innerHTML,/✓ Unlocked by collection/);
  const sidebar=()=>elements.get('#graph-sidebar').innerHTML;
  assert.match(sidebar(),/Unlock confirmed by collection/);
  assert.match(sidebar(),/No manual confirmation is needed/);
  assert.doesNotMatch(sidebar(),/data-manual=/);
  assert.deepEqual([...elements.get('#view').innerHTML.matchAll(/[А-Яа-яЁё]+/g)].map(([word])=>word),[]);
  switchLanguage('ru');
  assert.match(sidebar(),/Ручное подтверждение условия не требуется/);
  assert.match(elements.get('#view').innerHTML,/✓ Открыт по коллекции/);
  switchLanguage('en');
  elements.get('#infer-save-evidence').events.get('change')({target:{checked:false}});
  assert.match(elements.get('#view').innerHTML,/\? Needs verification/);
  assert.match(sidebar(),/data-manual=/);
  elements.get('#graph-mode').events.get('change')({target:{value:'availability'}});
  assert.match(elements.get('#view').innerHTML,/● Availability from secret flags/);
  assert.match(elements.get('#view').innerHTML,/○ Locked/);
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
  assert.equal(elements.get('#result-count').textContent,before);
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

test('switching graph language preserves manual facts, selected node and zoom',{skip:!fs.existsSync('context/rep+persistentgamedata1.dat')},async t=>{
  const {elements,upload,switchLanguage,navigate}=await app(t);await upload('rep+persistentgamedata1.dat');
  navigate('#/graph?item=collectible:538'); // Marbles, including its unrecorded five-Gulp action.
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
