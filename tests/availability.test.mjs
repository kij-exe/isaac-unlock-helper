import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyAvailabilityMappings} from '../tools/availability-catalog.mjs';
import {createEvaluator,validateCatalog,STATUS,buildGraph} from '../site/js/unlock-engine.js';
import {parseSave,emptySaveBytes,slotProgress,kageChecksum} from '../site/js/save-parser.js';
const read=file=>JSON.parse(fs.readFileSync(file));
const data=read('site/data/unlocks.json'),profile=read('data/unlock-availability-repentance.json'),game=read('site/data/game-catalog.json');
const sample=edition=>{const save=parseSave(emptySaveBytes(edition));return {save,progress:slotProgress(save,game),engine:()=>createEvaluator(data,save,slotProgress(save,game))};};

test('all 1,004 item and 34 character availability mappings are pinned, complete and reproducible',()=>{
  const expected=data.nodes.filter(node=>node.catalog||node.kind==='character').map(node=>node.id).sort();
  assert.equal(expected.length,1038);assert.deepEqual(Object.keys(profile.entries).sort(),expected);
  assert.deepEqual(applyAvailabilityMappings(data,profile),data);
  assert.deepEqual(validateCatalog(data),[]);
  assert.ok(profile.sources.every(source=>source.url.startsWith('https://raw.githubusercontent.com/')&&/^[a-f0-9]{64}$/.test(source.sha256)));
  for(const [id,entry]of Object.entries(profile.entries)){
    const node=data.nodes.find(node=>node.id===id),gate=entry.secretId??profile.retainedGates[id]?.secretId;
    assert.equal(node.secretId,gate,id);
  }
  const wrong=structuredClone(data);wrong.nodes.find(node=>node.id==='trinket:152').secretId=407;
  assert.throws(()=>applyAvailabilityMappings(wrong,profile),/Conflicting availability gate/);
});

test('every item and character has a definite availability from a single supported save, without earning manual actions',()=>{
  for(const edition of ['repentance','repentance-plus']){
    const {save,engine}=sample(edition),before=slotProgress(save,game);
    for(const id of Object.keys(profile.entries))assert.notEqual(engine().availability(id).status,STATUS.UNKNOWN,id);
    save.chunks.achievements.fill(1);const e=engine();
    for(const id of Object.keys(profile.entries))assert.equal(e.availability(id).status,STATUS.YES,id);
    assert.deepEqual(slotProgress(save,game),before);
    assert.equal(e.earned('feature:planetarium'),STATUS.UNKNOWN);
    assert.equal(e.earned('trinket:152'),STATUS.UNKNOWN);
    assert.notEqual(e.earned('feature:dead-god'),STATUS.YES);
  }
});

test('one Planetarium flag opens both the feature and Telescope Lens, independent of their shared historical condition',()=>{
  const bytes=emptySaveBytes(),layout=parseSave(bytes).layout,view=new DataView(bytes.buffer);
  bytes[layout.find(chunk=>chunk.id===1).dataOffset+406]=1;
  view.setUint32(bytes.length-4,kageChecksum(bytes.subarray(16,bytes.length-4)),true);
  const save=parseSave(bytes),progress=slotProgress(save,game),e=createEvaluator(data,save,progress);
  for(const id of ['feature:planetarium','trinket:152'])assert.deepEqual(e.availability(id),{status:STATUS.YES,source:'save_secret'});
  assert.equal(e.earned('trinket:152'),STATUS.UNKNOWN);assert.equal(progress.summary.marks,0);
  assert.deepEqual(data.nodes.find(node=>node.id==='trinket:152').unlock.requirements,{type:'node',id:'feature:planetarium'});
  const graph=buildGraph(data,e,{targetId:'trinket:152',mode:'progress'});
  assert.ok(graph.nodes.some(node=>node.id==='feature:planetarium'));
  assert.ok(graph.nodes.some(node=>node.id==='trinket:152'&&node.status===STATUS.UNKNOWN));
});

test('all ten previously missing gates control only their own shared content',()=>{
  const entries={'collectible:207':6,'collectible:414':135,'trinket:120':358,'trinket:121':359,'trinket:122':360,'trinket:123':370,'trinket:125':381,'trinket:152':406,'consumable:53':362,'consumable:78':415};
  const {save,engine}=sample();
  for(const [id,gate]of Object.entries(entries)){
    save.chunks.achievements.fill(0);assert.equal(engine().availability(id).status,STATUS.NO,id);
    save.chunks.achievements[gate]=1;assert.equal(engine().availability(id).status,STATUS.YES,id);
    save.chunks.achievements[gate]=0;save.chunks.achievements[gate===406?407:406]=1;
    assert.equal(engine().availability(id).status,STATUS.NO,id);
  }
  save.chunks.achievements.fill(0);save.chunks.achievements[415]=1;
  const e=engine();assert.equal(e.availability('collectible:580').status,STATUS.YES);assert.equal(e.availability('consumable:78').status,STATUS.YES);
  assert.deepEqual(data.nodes.find(node=>node.id==='consumable:78').unlock.requirements,{type:'node',id:'collectible:580'});
});

test('unrelated boss and challenge names cannot lock default items or prove their conditions',()=>{
  const {save,engine}=sample();
  for(const [id,oldGate]of Object.entries({'collectible:50':16,'collectible:352':164,'collectible:380':268,'collectible:503':346})){
    const node=data.nodes.find(node=>node.id===id);assert.equal(node.secretId,undefined);
    assert.equal(engine().availability(id).status,STATUS.YES);
    const goal=data.nodes.find(node=>node.id==='feature:dead-god-conditions').unlock.requirements.conditions.flatMap(group=>group.conditions).find(condition=>condition.goalSecretId===oldGate);
    const before=engine().evaluate(goal);save.chunks.achievements[oldGate]=1;
    assert.equal(engine().evaluate(goal),before);assert.notEqual(before,STATUS.YES);
  }
  assert.equal(engine().availability('collectible:474').status,STATUS.YES);
  assert.equal(engine().earned('collectible:474'),STATUS.UNKNOWN);
  assert.equal(data.nodes.find(node=>node.id==='collectible:474').catalog.kind,'active');
  assert.equal(engine().availability('collectible:130').status,STATUS.NO);
  assert.equal(engine().availability('collectible:181').status,STATUS.NO);
});

test('saved counters and the specific collection entries replace only conditions they actually record',()=>{
  const {save,engine}=sample();
  save.chunks.eventCounters[196]=19;assert.equal(engine().earned('consumable:53'),STATUS.NO);
  save.chunks.eventCounters[196]=20;assert.equal(engine().earned('consumable:53'),STATUS.YES);
  save.chunks.eventCounters[195]=20;assert.equal(engine().earned('trinket:120'),STATUS.YES);
  save.chunks.eventCounters[202]=1;assert.equal(engine().earned('trinket:121'),STATUS.YES);
  save.chunks.collection[63]=save.chunks.collection[116]=1;assert.equal(engine().earned('trinket:125'),STATUS.NO);
  save.chunks.collection[356]=1;assert.equal(engine().earned('trinket:125'),STATUS.YES);
  assert.equal(engine().earned('trinket:122'),STATUS.UNKNOWN);
  assert.equal(engine().availability('consumable:53').status,STATUS.NO);
  assert.equal(engine().availability('consumable:53',{inferSlotEvidence:true}).status,STATUS.YES);
});

test('challenge access uses available prerequisites, while completion still requires the completed flag',()=>{
  const {save,engine}=sample();
  assert.equal(engine().availability('challenge:45').status,STATUS.NO);
  save.chunks.achievements[483]=1;
  assert.equal(engine().availability('challenge:45').status,STATUS.YES);
  assert.notEqual(engine().earned('challenge:45'),STATUS.YES);
  assert.equal(engine().earned('challenge-complete:45'),STATUS.NO);
  save.chunks.achievements.fill(1);
  for(let id=1;id<=45;id++){
    assert.equal(engine().availability('challenge:'+id).status,STATUS.YES);
    assert.equal(engine().earned('challenge-complete:'+id),STATUS.NO);
  }
  const requirements=read('data/challenges-repentance.json').challenges.find(entry=>entry.id===11).requiredUnlockIds;
  save.chunks.achievements[requirements[0]]=0;assert.equal(engine().availability('challenge:11').status,STATUS.NO);
  save.chunks.challenges[11]=1;assert.equal(engine().availability('challenge:11').status,STATUS.YES);
});

test('availability rules preserve unknowns, AND/OR and reject invalid or cyclic references',()=>{
  const manual={type:'manual',key:'test',label:'Test'};
  const node=(id,rule)=>({id,kind:'feature',name:id,sources:['https://example.com/'],unlock:{description:'Test',requirements:manual},availability:rule});
  const input={schemaVersion:1,nodes:[node('a',{type:'any',conditions:[{type:'node',id:'b'},{type:'constant',value:true}]}),node('b',{type:'node',id:'unknown'})]};
  const {save,progress}=sample();assert.equal(createEvaluator(input,save,progress).availability('a').status,STATUS.YES);
  input.nodes[0].availability.type='all';assert.equal(createEvaluator(input,save,progress).availability('a').status,STATUS.UNKNOWN);
  assert.ok(validateCatalog(input).some(error=>error.includes('Missing dependency')));
  input.nodes[1].availability={type:'node',id:'a'};assert.ok(validateCatalog(input).some(error=>error.includes('cycle')));
  assert.equal(createEvaluator(input,save,progress).availability('a').status,STATUS.UNKNOWN);
  input.nodes[1].availability={type:'achievement',id:406};assert.ok(validateCatalog(input).some(error=>error.includes('Invalid availability condition')));
});
