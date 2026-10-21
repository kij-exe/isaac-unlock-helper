import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSave,emptySaveBytes,slotProgress} from '../site/js/save-parser.js';
import {catalogForSave} from '../site/js/catalog-profile.js';
import {PHASES,BRANCHES,progressionForSave} from '../site/js/progression.js';
import {validatePhaseRecommendations} from '../site/js/phase-recommendations.js';
import {progressionMarkup} from '../site/js/progression-view.js';
import {translate} from '../site/js/i18n.js';
import {moveEntry} from '../site/js/tier-ranks.js';

const read=file=>JSON.parse(fs.readFileSync(file));
const base=read('site/data/unlocks.json'),game=read('site/data/game-catalog.json');
const profile=read('site/data/phase-recommendations.json');
const phaseIds=[...PHASES,...BRANCHES].map(phase=>phase.id);
function sample(){
  const data=structuredClone(base),save=parseSave(emptySaveBytes()),progress=slotProgress(save,game);
  return {data,save,progress,model:(priorities=profile)=>progressionForSave(catalogForSave(data,save),save,progress,{}, {},priorities)};
}
const phase=(model,id)=>[...model.phases,...model.branches].find(phase=>phase.id===id);
const item=(model,phaseId,id)=>phase(model,phaseId).recommendations.find(item=>item.nodeId===id);

test('curated phase references, local placements, translations and artwork are complete',()=>{
  assert.deepEqual(validatePhaseRecommendations(profile,base,phaseIds),[]);
  const icons=new Set(read('site/assets/icons/manifest.json').icons.map(icon=>icon.nodeId));
  for(const group of Object.values(profile.phases)){
    assert.notEqual(translate(group.description,'ru'),group.description);
    for(const placement of group.entries)assert.ok(icons.has(placement.nodeId),placement.nodeId);
  }
  assert.doesNotMatch(JSON.stringify(profile),/[\u0400-\u04ff]/);
  const invalid=structuredClone(profile);
  invalid.phases.mom.entries.push({...invalid.phases.mom.entries[0]});
  invalid.phases.mom.entries[1].nodeId='collectible:9999';
  invalid.phases.mom.entries[2].rank='OPEN';
  const errors=validatePhaseRecommendations(invalid,base,phaseIds).join('\n');
  assert.match(errors,/Duplicate phase recommendation/);assert.match(errors,/Unknown recommended item/);assert.match(errors,/Invalid phase item placement/);
});
test('all secret flags leave recommendation results, collection suggestions and phase completion unchanged',()=>{
  const {save,model}=sample(),before=model();
  save.chunks.achievements.fill(1);
  assert.deepEqual(model(),before);
  assert.equal(item(model(),'photographs','collectible:114').obtained,false);
});
test('a collection pickup is distinct from proving the unlock action or completing a phase',()=>{
  const {save,model}=sample();
  const before=phase(model(),'photographs');
  save.chunks.collection[114]=1;
  const after=model(),knife=item(after,'photographs','collectible:114');
  assert.equal(knife.collected,true);assert.equal(knife.obtained,true);assert.equal(knife.earned,'missing');
  assert.deepEqual(phase(after,'photographs').goals,before.goals);
  assert.equal(phase(after,'photographs').status,before.status);
});
test('a directly recorded character mark verifies its reward without requiring a pickup',()=>{
  const {progress,model}=sample();
  progress.characters.find(character=>character.name==='???').marks.Isaac.value=1;
  const d6=item(model(),'photographs','collectible:105');
  assert.equal(d6.earned,'satisfied');assert.equal(d6.obtained,true);assert.equal(d6.collected,false);
});
test('phase-local ranks stay independent of global tier edits and cannot change phase goals',()=>{
  const {data,model}=sample(),original=JSON.stringify(profile),before=model();
  moveEntry([data],'collectible:105','F');
  assert.equal(data.nodes.find(node=>node.id==='collectible:105').rank,'F');
  assert.equal(item(model(),'photographs','collectible:105').rank,'S');
  const alternative=structuredClone(profile);alternative.phases.photographs.entries[0].rank='C';
  const edited=model(alternative);
  assert.equal(item(edited,'photographs','collectible:105').rank,'C');
  assert.deepEqual(phase(edited,'photographs').goals,phase(before,'photographs').goals);
  assert.equal(phase(edited,'photographs').status,phase(before,'photographs').status);
  assert.equal(JSON.stringify(profile),original);
});
test('final collection suggestions rotate only through missing required pickups',()=>{
  const {save,model}=sample();
  const initial=phase(model(),'dead-god');
  assert.equal(initial.recommendations.length,12);assert.equal(initial.recommendationSummary.remaining,717);
  assert.equal(initial.recommendations[0].nodeId,'collectible:628');
  save.chunks.collection[628]=1;
  const next=phase(model(),'dead-god');
  assert.equal(next.recommendations.length,12);assert.equal(next.recommendationSummary.remaining,716);
  assert.equal(next.recommendations.some(item=>item.nodeId==='collectible:628'),false);
  const required=read('site/data/dead-god-collection.json').requiredItems;
  for(const entry of required)save.chunks.collection[entry.id]=1;
  save.chunks.collection[474]=0;
  const last=phase(model(),'dead-god');
  assert.equal(last.recommendationSummary.remaining,1);
  assert.deepEqual(last.recommendations.map(item=>item.nodeId),['collectible:474']);
  save.chunks.collection[474]=1;
  assert.deepEqual(phase(model(),'dead-god').recommendations,[]);
  assert.equal(phase(model(),'dead-god').status,'missing');
});
test('obtained filtering changes only item tiles, retaining all phases, gaps and local ranks',()=>{
  const {save,model}=sample();save.chunks.collection[119]=1;
  const options={t:text=>translate(text,'ru'),icons:new Map()};
  const all=progressionMarkup(model(),options),filtered=progressionMarkup(model(),{...options,hideObtained:true});
  assert.match(all,/data-phase-item="collectible:119"/);
  assert.doesNotMatch(filtered,/data-phase-item="collectible:119"/);
  assert.equal((filtered.match(/data-phase="/g)||[]).length,14);
  assert.match(filtered,/ЧТО ОТКРЫТЬ В ЭТОЙ ФАЗЕ/);
  assert.match(filtered,/СЛЕДУЮЩИЕ ПРЕДМЕТЫ В КОЛЛЕКЦИЮ/);
  assert.doesNotMatch(filtered,/RECOMMENDED UNLOCKS|Condition verified|Hide obtained recommendations/);
});
