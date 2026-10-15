import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createI18n,translate,translateHTML,localizeCatalog} from '../site/js/i18n.js';
import {catalogForSave} from '../site/js/catalog-profile.js';
import {createEvaluator,buildGraph,validateCatalog} from '../site/js/unlock-engine.js';
const base=JSON.parse(fs.readFileSync('site/data/unlocks.json'));
const displayFields=new Set(['name','label','description','reason','sourceNote']);
function logic(value){
  if(Array.isArray(value))return value.map(logic);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!displayFields.has(key)).map(([key,child])=>[key,logic(child)]));
  return value;
}
function presentation(value){
  if(!value||typeof value!=='object')return [];
  return Object.entries(value).flatMap(([key,child])=>displayFields.has(key)&&typeof child==='string'?[child]:presentation(child));
}

test('all unlock descriptions, manual actions and Dead God conditions translate without changing logic',()=>{
  for(const id of ['repentance','repentance-plus']){
    const data=catalogForSave(base,{profile:{id}}),snapshot=structuredClone(data),english=localizeCatalog(data,'en');
    assert.deepEqual(data,snapshot);assert.deepEqual(validateCatalog(english),[]);
    assert.deepEqual(logic(data),logic(english));assert.equal(localizeCatalog(data,'ru'),data);
    assert.deepEqual(presentation(english).filter(text=>/[А-Яа-яЁё]/.test(text)),[]);
    const save={chunks:{achievements:Array(642).fill(1),collection:Array(733).fill(0),challenges:Array(46).fill(0)}};
    const progress={characters:[],counters:Array(523).fill(0)},manual={'gulp-five':true};
    const ru=createEvaluator(data,save,progress,manual),en=createEvaluator(english,save,progress,manual);
    for(const node of data.nodes){
      assert.equal(en.earned(node.id),ru.earned(node.id));assert.deepEqual(en.availability(node.id),ru.availability(node.id));
      assert.equal(en.collected(en.nodes.get(node.id)),ru.collected(node));
    }
    for(const mode of ['progress','availability']){
      const a=buildGraph(data,ru,{mode}),b=buildGraph(english,en,{mode});
      assert.deepEqual(a.nodes.map(n=>[n.id,n.status]),b.nodes.map(n=>[n.id,n.status]));
      assert.deepEqual(a.edges.map(e=>[e.from,e.to]),b.edges.map(e=>[e.from,e.to]));
    }
  }
});

test('HTML localization preserves URLs, input values, IDs and escaped item names',()=>{
  const ru='<a href="#/graph?item=collectible:15" data-id="Предмет" title="Открыть вики" aria-label="Вики: &lt;3">Предмет</a><input value="Победить Hush" placeholder="Найти предмет…">';
  const en=translateHTML(ru,'en');
  assert.match(en,/href="#\/graph\?item=collectible:15"/);assert.match(en,/data-id="Предмет"/);
  assert.match(en,/title="Open wiki"/);assert.match(en,/aria-label="Wiki: &lt;3"/);
  assert.match(en,/value="Победить Hush"/);assert.match(en,/placeholder="Find an item…"/);
  assert.equal(translateHTML(ru,'ru'),ru);
  const index=translateHTML(fs.readFileSync('site/index.html','utf8'),'en');
  const remaining=index.split('\n').filter(line=>/[А-Яа-яЁё]/.test(line));
  assert.equal(remaining.length,1);assert.match(remaining[0],/Язык \/ Language/);assert.match(remaining[0],/aria-label="Русский"/);
});

test('English preference persists and blocked or invalid storage falls back safely',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const i18n=createI18n(storage);assert.equal(i18n.language,'ru');i18n.setLanguage('en');
  assert.equal(createI18n(storage).language,'en');assert.equal(i18n.t('Открыт'),'Unlocked');
  i18n.setLanguage('de');assert.equal(i18n.language,'ru');
  const blocked=createI18n({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(blocked.language,'ru');blocked.setLanguage('en');assert.equal(blocked.t('Закрыт'),'Locked');
});

test('static DOM localization restores Russian without replacing inline elements or their state',()=>{
  const text=content=>({nodeType:3,textContent:content});
  const element=(children,attrs={})=>({nodeType:1,childNodes:children,hasAttribute:key=>Object.hasOwn(attrs,key),getAttribute:key=>attrs[key],setAttribute:(key,value)=>attrs[key]=value});
  const emphasis=element([text('дальше?')]),heading=element([text('Что открыть '),emphasis],{'aria-label':'Тирлист'});
  const status={textContent:''},i18n=createI18n(null);
  i18n.text(status,'Сохранение прочитано.');i18n.localizeDOM(heading);
  i18n.setLanguage('en');i18n.localizeDOM(heading);i18n.refreshMessages();
  assert.equal(heading.childNodes[0].textContent,'What to unlock ');assert.equal(emphasis.childNodes[0].textContent,'next?');
  assert.equal(heading.getAttribute('aria-label'),'Tier list');assert.equal(status.textContent,'Save loaded.');
  i18n.setLanguage('ru');i18n.localizeDOM(heading);i18n.refreshMessages();
  assert.equal(heading.childNodes[1],emphasis);assert.equal(heading.childNodes[0].textContent,'Что открыть ');
  assert.equal(emphasis.childNodes[0].textContent,'дальше?');assert.equal(status.textContent,'Сохранение прочитано.');
});

test('parameterized errors and progress labels retain filenames and numbers',()=>{
  assert.equal(translate('Ещё 3 неизвестных флага','en'),'3 additional unknown flags');
  assert.equal(translate('The Beast · есть онлайн-отметка (сырое значение 4): Normal','en'),'The Beast · online mark present (raw value 4): Normal');
  assert.match(translate('Это gamestate — состояние текущего забега, а не общий прогресс. Выберите в той же папке rep+persistentgamedata3.dat. Файл gamestate для тирлиста и общей статистики не нужен.','en'),/Choose rep\+persistentgamedata3.dat/);
  assert.equal(translate('Некорректный размер блока 7.','en'),'Invalid size in chunk 7.');
});
