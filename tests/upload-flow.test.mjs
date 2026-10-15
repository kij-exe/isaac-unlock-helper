import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  const elements=new Map([...ids,'.brand','.main-nav','meta[name="theme-color"]','#item-search','#status-filter','#kind-filter','#tier-rows','#result-count', '#graph-mode','#graph-focus','#show-opened','#fit-graph','#reset-layout','#graph-sidebar','#graph-canvas','#unlock-svg','#zoom-label'].map(id=>[id,new Element()]));
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
  await upload('rep+gamestate2.dat',Buffer.concat([Buffer.from('ISAACNG_GSR0169'),Buffer.alloc(20)]));
  assert.equal(elements.get('#file-error').hidden,false);
  assert.match(elements.get('#file-error').textContent,/rep\+persistentgamedata2.dat/);
  assert.equal(elements.get('#save-name').textContent,'rep+persistentgamedata1.dat');
});
test('actual Rebirth upload renders its own 66 marks and 20 challenges with a compatibility explanation',{skip:!fs.existsSync('context/persistentgamedata1.dat')},async t=>{
  const {elements,upload}=await app(t);await upload('persistentgamedata1.dat');
  assert.equal(location.hash,'#/stats');assert.equal(elements.get('#save-edition').textContent,'Rebirth');
  const html=elements.get('#view').innerHTML;
  assert.match(html,/Сохранение Rebirth прочитано/);assert.match(html,/\/ 66/);assert.match(html,/\/ 20/);
  assert.doesNotMatch(html,/\/ 408/);assert.match(html,/Rebirth не хранит бестиарий/);
});
test('initial incorrect upload keeps instructions visible and expands the file guide',async t=>{
  const {elements,upload}=await app(t);elements.get('#workspace').hidden=true;
  assert.ok(elements.get('#save-paths').innerHTML.includes('C:\\Program Files (x86)\\Steam\\userdata'));
  assert.ok(!elements.get('#save-paths').innerHTML.includes('C:\\\\Program')); 
  await upload('rep+gamestate1.dat',Buffer.concat([Buffer.from('ISAACNG_GSR0169'),Buffer.alloc(20)]));
  assert.equal(elements.get('#workspace').hidden,true);
  assert.equal(elements.get('#save-help').open,true);
  assert.match(elements.get('#upload-status').textContent,/общий прогресс/);
});

test('language switch persists English and rerenders tiers/statistics without reuploading or losing filters',{skip:!fs.existsSync('context/rep+persistentgamedata1.dat')},async t=>{
  const {elements,upload,switchLanguage,storage,navigate}=await app(t);await upload('rep+persistentgamedata1.dat');
  elements.get('#item-search').events.get('input')({target:{value:'Marbles'}});
  elements.get('#status-filter').events.get('change')({target:{value:'open'}});
  elements.get('#kind-filter').events.get('change')({target:{value:'collectible'}});
  const before=elements.get('#result-count').textContent;
  switchLanguage('en');
  assert.equal(document.documentElement.lang,'en');assert.equal(storage.get('atlas-language'),'en');
  assert.equal(elements.get('#save-name').textContent,'rep+persistentgamedata1.dat');
  assert.match(elements.get('#view').innerHTML,/value="Marbles"/);
  assert.equal(elements.get('#result-count').textContent,before);
  assert.equal(elements.get('#status-filter').value,'open');assert.equal(elements.get('#kind-filter').value,'collectible');
  assert.doesNotMatch(elements.get('#view').innerHTML,/[А-Яа-яЁё]/);
  assert.doesNotMatch(elements.get('#tier-rows').innerHTML,/[А-Яа-яЁё]/);
  navigate('#/stats');assert.match(document.title,/Statistics/);
  assert.doesNotMatch(elements.get('#view').innerHTML,/[А-Яа-яЁё]/);
  assert.match(elements.get('#view').innerHTML,/do not contribute/);
  switchLanguage('ru');assert.match(elements.get('#view').innerHTML,/Статистика/);
  assert.equal(storage.get('atlas-language'),'ru');assert.equal(location.hash,'#/stats');
});

test('saved English preference localizes file errors, theme and Rebirth statistics',{skip:!fs.existsSync('context/persistentgamedata1.dat')},async t=>{
  const {elements,upload,switchLanguage}=await app(t,{savedLanguage:'en'});
  assert.equal(document.documentElement.lang,'en');assert.match(elements.get('#theme-toggle').getAttribute('aria-label'),/light|dark/);
  await upload('rep+gamestate2.dat',Buffer.concat([Buffer.from('ISAACNG_GSR0169'),Buffer.alloc(20)]));
  assert.match(elements.get('#upload-status').textContent,/rep\+persistentgamedata2.dat/);
  assert.doesNotMatch(elements.get('#upload-status').textContent,/[А-Яа-яЁё]/);
  switchLanguage('ru');assert.match(elements.get('#upload-status').textContent,/общий прогресс/);
  switchLanguage('en');await upload('persistentgamedata1.dat');
  assert.match(elements.get('#view').innerHTML,/Rebirth save loaded/);
  assert.doesNotMatch(elements.get('#view').innerHTML,/[А-Яа-яЁё]/);
  assert.equal(location.hash,'#/stats');assert.match(elements.get('#save-meta').textContent,/ KB /);
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
  switchLanguage('en');
  assert.equal(elements.get('#zoom-label').textContent,zoom);assert.equal(canvas.scrollLeft,25);assert.equal(canvas.scrollTop,70);
  assert.match(elements.get('#graph-sidebar').innerHTML,new RegExp(`data-manual="${key}" checked`));
  assert.doesNotMatch(elements.get('#graph-sidebar').innerHTML,/[А-Яа-яЁё]/);
  assert.doesNotMatch(elements.get('#view').innerHTML,/[А-Яа-яЁё]/);
  assert.match(elements.get('#graph-sidebar').innerHTML,/Use Gulp! five times/);
  elements.get('#view').events.get('click')({target:{closest:selector=>selector==='.graph-node,[data-select]'?{dataset:{select:'feature:gulp'}}:null}});
  switchLanguage('ru');assert.match(elements.get('#graph-sidebar').innerHTML,/<h2>Gulp!<\/h2>/);
  switchLanguage('en');assert.match(elements.get('#graph-sidebar').innerHTML,/<h2>Gulp!<\/h2>/);
  navigate('#/graph');assert.doesNotMatch(elements.get('#view').innerHTML,/[А-Яа-яЁё]/);
  navigate('#/graph?item=feature:dead-god');
  assert.doesNotMatch(elements.get('#graph-sidebar').innerHTML,/[А-Яа-яЁё]/);
});
