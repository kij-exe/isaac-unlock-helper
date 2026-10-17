import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createI18n,translate,translateHTML,localizeCatalog} from '../site/js/i18n.js';
import {catalogForSave} from '../site/js/catalog-profile.js';
import {createEvaluator,buildGraph,validateCatalog} from '../site/js/unlock-engine.js';
const source=fs.readFileSync('site/data/unlocks.json','utf8'),base=JSON.parse(source);
const cyrillic=/[А-Яа-яЁё]/;
const displayFields=new Set(['name','label','description','reason','sourceNote']);
function logic(value){
  if(Array.isArray(value))return value.map(logic);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!displayFields.has(key)).map(([key,child])=>[key,logic(child)]));
  return value;
}
function presentation(value,field){
  if(!value||typeof value!=='object')return [];
  return Object.entries(value).flatMap(([key,child])=>displayFields.has(key)&&typeof child==='string'?[[key,child]]:presentation(child));
}

test('the canonical catalog is English and every description, manual reason and note has a Russian translation without changing logic',()=>{
  assert.equal(cyrillic.test(source),false);
  for(const id of ['repentance','repentance-plus']){
    const data=catalogForSave(base,{profile:{id}}),snapshot=structuredClone(data),russian=localizeCatalog(data,'ru');
    assert.deepEqual(data,snapshot);assert.deepEqual(validateCatalog(russian),[]);
    assert.deepEqual(logic(data),logic(russian));assert.equal(localizeCatalog(data,'en'),data);
    assert.deepEqual(presentation(data).filter(([,text])=>cyrillic.test(text)),[]);
    assert.deepEqual(presentation(russian).filter(([key,text])=>['description','reason','sourceNote'].includes(key)&&!cyrillic.test(text)),[]);
    const save={chunks:{achievements:Array(642).fill(1),collection:Array(733).fill(0),challenges:Array(46).fill(0)}};
    const progress={characters:[],counters:Array(523).fill(0)},manual={'gulp-five':true};
    const en=createEvaluator(data,save,progress,manual),ru=createEvaluator(russian,save,progress,manual);
    for(const node of data.nodes){
      assert.equal(ru.earned(node.id),en.earned(node.id));assert.deepEqual(ru.availability(node.id),en.availability(node.id));
      assert.equal(ru.collected(ru.nodes.get(node.id)),en.collected(node));
    }
    for(const mode of ['progress','availability']){
      const a=buildGraph(data,en,{mode}),b=buildGraph(russian,ru,{mode});
      assert.deepEqual(a.nodes.map(n=>[n.id,n.status]),b.nodes.map(n=>[n.id,n.status]));
      assert.deepEqual(a.edges.map(e=>[e.from,e.to]),b.edges.map(e=>[e.from,e.to]));
    }
  }
});

test('HTML localization preserves URLs, input values, IDs and escaped item names',()=>{
  const en='<a href="#/graph?item=collectible:15" data-id="Item" title="Open wiki" aria-label="Wiki: &lt;3">Item</a><input value="Defeat Hush" placeholder="Find an item…">';
  const ru=translateHTML(en,'ru');
  assert.match(ru,/href="#\/graph\?item=collectible:15"/);assert.match(ru,/data-id="Item"/);
  assert.match(ru,/title="Открыть вики"/);assert.match(ru,/aria-label="Вики: &lt;3"/);assert.match(ru,/>Предмет</);
  assert.match(ru,/value="Defeat Hush"/);assert.match(ru,/placeholder="Найти предмет…"/);
  assert.equal(translateHTML(en,'en'),en);
  const html=fs.readFileSync('site/index.html','utf8');
  const remaining=html.split('\n').filter(line=>cyrillic.test(line));
  assert.equal(remaining.length,1);assert.match(remaining[0],/Language \/ Язык/);assert.match(remaining[0],/aria-label="Русский"/);
  const index=translateHTML(html,'ru');
  assert.match(index,/Что открыть <em>дальше\?<\/em>/);assert.match(index,/Перетащите persistentgamedata сюда/);
});

test('English is the default; the Russian preference persists and blocked or invalid storage falls back safely',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const i18n=createI18n(storage);assert.equal(i18n.language,'en');assert.equal(i18n.t('Unlocked'),'Unlocked');
  i18n.setLanguage('ru');assert.equal(createI18n(storage).language,'ru');assert.equal(i18n.t('Unlocked'),'Открыт');
  i18n.setLanguage('de');assert.equal(i18n.language,'en');
  const blocked=createI18n({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(blocked.language,'en');blocked.setLanguage('ru');assert.equal(blocked.t('Locked'),'Закрыт');
});

test('static DOM localization restores English without replacing inline elements or their state',()=>{
  const text=content=>({nodeType:3,textContent:content});
  const element=(children,attrs={})=>({nodeType:1,childNodes:children,hasAttribute:key=>Object.hasOwn(attrs,key),getAttribute:key=>attrs[key],setAttribute:(key,value)=>attrs[key]=value});
  const emphasis=element([text('next?')]),heading=element([text('What to unlock '),emphasis],{'aria-label':'Tier list'});
  const status={textContent:''},i18n=createI18n(null);
  i18n.text(status,'Save loaded.');i18n.localizeDOM(heading);
  i18n.setLanguage('ru');i18n.localizeDOM(heading);i18n.refreshMessages();
  assert.equal(heading.childNodes[0].textContent,'Что открыть ');assert.equal(emphasis.childNodes[0].textContent,'дальше?');
  assert.equal(heading.getAttribute('aria-label'),'Тирлист');assert.equal(status.textContent,'Сохранение прочитано.');
  i18n.setLanguage('en');i18n.localizeDOM(heading);i18n.refreshMessages();
  assert.equal(heading.childNodes[1],emphasis);assert.equal(heading.childNodes[0].textContent,'What to unlock ');
  assert.equal(emphasis.childNodes[0].textContent,'next?');assert.equal(status.textContent,'Save loaded.');
});

test('parameterized errors and progress labels retain filenames and numbers',()=>{
  assert.equal(translate('3 additional unknown flags','ru'),'Ещё 3 неизвестных флага');
  assert.equal(translate('The Beast · online mark present (raw value 4): Normal','ru'),'The Beast · есть онлайн-отметка (сырое значение 4): Normal');
  assert.match(translate('This gamestate stores the current run, rather than persistent progress. Choose rep+persistentgamedata3.dat in the same folder. A gamestate file is not needed for the tier list or overall statistics.','ru'),/Выберите в той же папке rep\+persistentgamedata3.dat/);
  assert.equal(translate('Invalid size in chunk 7.','ru'),'Некорректный размер блока 7.');
  assert.equal(translate('Defeat The Lamb','ru'),'Победить The Lamb');
  assert.equal(translate('Counter #3 ≥ 10 or Defeat Hush','ru'),'Счётчик #3 ≥ 10 или Победить Hush');
});

test('untranslated English source text is never partially translated',()=>{
  for(const text of ['#1 · Magdalene: Have 7 or more Red Heart Containers at one time','Defeat The Lamb as The Lost','Marbles','rep+persistentgamedata1.dat'])
    assert.equal(translate(text,'ru'),text);
});
