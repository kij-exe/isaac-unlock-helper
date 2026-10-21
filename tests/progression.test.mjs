import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptySaveBytes,parseSave,slotProgress} from '../site/js/save-parser.js';
import {catalogForSave} from '../site/js/catalog-profile.js';
import {PHASES,BRANCHES,progressionForSave,cleanPhaseConfirmations} from '../site/js/progression.js';
import {progressionMarkup} from '../site/js/progression-view.js';
import {translate} from '../site/js/i18n.js';

const data=JSON.parse(fs.readFileSync('site/data/unlocks.json'));
const catalog=JSON.parse(fs.readFileSync('site/data/game-catalog.json'));
function sample(){
  const save=parseSave(emptySaveBytes());
  const progress=slotProgress(save,catalog),profile=catalogForSave(data,save);
  return {save,progress,model:(manual={},confirmations={})=>progressionForSave(profile,save,progress,manual,confirmations)};
}
const phase=(model,id)=>model.phases.find(phase=>phase.id===id);
const branch=(model,id)=>model.branches.find(branch=>branch.id===id);

test('all secrets on an empty slot leave every phase and branch unchanged',()=>{
  const {save,model}=sample(),before=model();
  save.chunks.achievements.fill(1);
  assert.deepEqual(model(),before);
  assert.equal(before.completed,0);assert.equal(before.current.id,'mom');
  assert.equal(phase(before,'mom').status,'unknown');
});
test('heart, photograph and Hush thresholds use credited counters without inventing earlier wins',()=>{
  const {progress,model}=sample();
  progress.counters[1]=10;
  assert.equal(phase(model(),'heart').status,'missing');assert.equal(model().current.id,'heart');
  progress.counters[1]=11;
  assert.equal(model().current.id,'photographs');
  progress.counters[11]=4;progress.counters[13]=5;
  assert.equal(phase(model(),'photographs').status,'missing');
  progress.counters[11]=5;
  assert.equal(phase(model(),'photographs').status,'satisfied');
  for(const wins of [1,2]){progress.counters[158]=wins;assert.equal(model().current.id,'hush');assert.equal(phase(model(),'hush').status,'missing');}
  progress.counters[158]=3;
  assert.equal(model().current.id,'mother');assert.equal(phase(model(),'hush').status,'satisfied');
  progress.counters[11]=0;
  assert.equal(model().current.id,'mother');assert.equal(phase(model(),'photographs').status,'missing');
});
test('fog follows route entry gates and keeps parallel Hush access visible before photographs',()=>{
  const {progress,model}=sample();
  const initial=model();
  assert.equal(phase(initial,'mom').locked,false);
  assert.equal(phase(initial,'heart').locked,true);
  assert.equal(phase(initial,'hush').locked,true);
  progress.counters[1]=10;
  const ten=model();
  assert.equal(phase(ten,'heart').current,true);
  assert.equal(phase(ten,'hush').locked,false);
  assert.equal(phase(ten,'photographs').locked,true);
  progress.counters[1]=11;
  assert.equal(phase(model(),'photographs').locked,false);
  assert.equal(phase(model(),'mother').locked,true);
  progress.counters[158]=3;
  assert.equal(phase(model(),'mother').locked,false);
  assert.equal(phase(model(),'beast').locked,true);
  progress.characters[0].marks['The Beast'].value=1;
  assert.equal(phase(model(),'beast').locked,false);
  assert.equal(phase(model(),'routes').current,true);
});
test('late marks and Tainted progress advance the frontier without backfilling gates',()=>{
  const {progress,model}=sample();
  progress.characters.find(character=>character.name==='Tainted Isaac').marks.Isaac.value=1;
  assert.equal(model().current.id,'beast');
  assert.equal(phase(model(),'mother').status,'missing');assert.equal(phase(model(),'beast').status,'missing');
  progress.characters[0].marks['The Beast'].value=1;
  assert.equal(model().current.id,'routes');assert.equal(phase(model(),'beast').status,'satisfied');
  assert.equal(phase(model(),'hush').status,'missing');
});
test('collection and bestiary sightings do not prove repeat thresholds or boss victories',()=>{
  const {save,progress,model}=sample();
  save.chunks.collection[327]=1;save.chunks.collection[628]=1;
  progress.bestiary.push({type:407,variant:0,kills:0,encounters:1,deaths:1});
  assert.equal(phase(model(),'photographs').status,'missing');
  assert.equal(phase(model(),'marks').status,'missing');
  assert.equal(phase(model(),'hush').status,'missing');
});
test('Greedier requires its harder mark and donation history can be confirmed independently',()=>{
  const {progress,model}=sample();
  progress.characters[0].marks['Greed / Greedier'].value=1;
  assert.equal(branch(model(),'greed').status,'satisfied');
  assert.equal(branch(model(),'greedier').status,'unknown');
  progress.characters[0].marks['Greed / Greedier'].value=2;
  assert.equal(branch(model(),'greedier').status,'satisfied');
  progress.counters[115]=879;
  assert.equal(branch(model(),'lost').status,'satisfied');assert.equal(branch(model(),'keeper').status,'unknown');
  const confirmed=model({}, {'phase:keeper':true});
  assert.equal(branch(confirmed,'keeper').status,'satisfied');assert.equal(branch(confirmed,'keeper').manual,true);
  assert.equal(confirmed.current.id,model().current.id);
});
test('manual evidence is distinct and revocable; arbitrary confirmation keys are ignored',()=>{
  const {model}=sample();
  const confirmed=model({}, {'defeat-mom':true});
  assert.equal(phase(confirmed,'mom').status,'satisfied');assert.equal(phase(confirmed,'mom').manual,true);
  assert.equal(confirmed.current.id,'heart');assert.equal(model().current.id,'mom');
  assert.deepEqual(cleanPhaseConfirmations({'defeat-mom':true,'phase:keeper':false,'phase:dead-god':true}),{'defeat-mom':true});
});
test('all hard marks advance to other conditions without crediting challenges or Dead God',()=>{
  const {progress,model}=sample();
  for(const character of progress.characters)for(const mark of Object.values(character.marks))mark.value=2;
  const result=model();
  assert.equal(phase(result,'marks').status,'satisfied');assert.equal(result.current.id,'conditions');
  assert.equal(phase(result,'conditions').status,'missing');assert.equal(result.finished,false);
  assert.equal(phase(result,'conditions').goals[1].total,640);
  assert.equal(phase(result,'dead-god').goals.at(-1).total,717);
});
test('the roadmap and side paths translate their descriptive text and keep all phases visible',()=>{
  for(const entry of [...PHASES,...BRANCHES])for(const field of ['title','subtitle','note']){
    if(entry[field]&&entry[field]!=='Dead God'&&entry[field]!=='Greedier')assert.notEqual(translate(entry[field],'ru'),entry[field],entry[field]);
  }
  const {model}=sample();
  const markup=progressionMarkup(model(),{t:text=>translate(text,'ru'),icons:new Map()});
  assert.equal((markup.match(/data-phase="/g)||[]).length,14);
  assert.ok(markup.indexOf('data-phase="mom"')<markup.indexOf('data-phase="dead-god"'));
  assert.match(markup,/Первая концовка/);assert.match(markup,/Ветка Greed/);
  assert.doesNotMatch(markup,/Current focus|View requirements|The heart cycle/);
});
