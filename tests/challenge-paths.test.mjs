import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEvaluator,buildGraph,STATUS,conditionReferences} from '../site/js/unlock-engine.js';
import {addChallengePaths} from '../tools/challenge-catalog.mjs';
const read=file=>JSON.parse(fs.readFileSync(file));
const data=read('site/data/unlocks.json'),reference=read('data/catalog.json'),profile=read('data/challenges-repentance.json');
const nodes=new Map(data.nodes.map(node=>[node.id,node]));
function fixture(){
  return {save:{chunks:{achievements:Array(642).fill(0),collection:Array(733).fill(0),challenges:Array(46).fill(0)}},
    progress:{characters:[],counters:Array(523).fill(0)}};
}
function reaches(graph,from,to){
  const seen=new Set(),queue=[from];
  while(queue.length){const id=queue.shift();if(id===to)return true;if(seen.has(id))continue;seen.add(id);queue.push(...graph.edges.filter(edge=>edge.from===id).map(edge=>edge.to));}
  return false;
}

test('the Dead God checklist links all 45 shared completion nodes, each with its actual access prerequisites',()=>{
  const required=nodes.get('feature:dead-god-challenges').unlock.requirements.conditions;
  assert.deepEqual(required.map(c=>c.id),Array.from({length:45},(_,i)=>`challenge-complete:${i+1}`));
  for(const entry of profile.challenges){
    const access=nodes.get(`challenge:${entry.id}`),completion=nodes.get(`challenge-complete:${entry.id}`);
    assert.equal(access.challenge.role,'access');assert.equal(completion.challenge.role,'completion');
    assert.equal(completion.unlock.evidence.type,'challenge');assert.equal(completion.unlock.evidence.id,entry.id);
    assert.ok(conditionReferences(completion.unlock.requirements).includes(access.id));
    const prerequisites=conditionReferences(access.unlock.requirements).map(id=>nodes.get(id).secretId).sort((a,b)=>a-b);
    assert.deepEqual(prerequisites,[...entry.requiredUnlockIds].sort((a,b)=>a-b));
  }
  assert.deepEqual(conditionReferences(nodes.get('challenge:45').unlock.requirements),['character:tainted-eden']);
  assert.deepEqual(conditionReferences(nodes.get('challenge:9').unlock.requirements),['collectible:52']);
  assert.deepEqual(conditionReferences(nodes.get('challenge:39').unlock.requirements),['character:jacob-esau']);
});

test('unlocking a challenge never completes it; completing it bypasses unavailable historical access proof',()=>{
  const {save,progress}=fixture();let e=createEvaluator(data,save,progress);
  assert.equal(e.earned('challenge:1'),STATUS.YES);assert.equal(e.earned('challenge-complete:1'),STATUS.NO);
  assert.equal(e.earned('feature:dead-god-challenges'),STATUS.NO);
  save.chunks.challenges.fill(1);e=createEvaluator(data,save,progress);
  assert.equal(e.earned('challenge-complete:45'),STATUS.YES);assert.equal(e.earned('feature:dead-god-challenges'),STATUS.YES);
  save.chunks.challenges[45]=0;save.chunks.achievements.fill(1);e=createEvaluator(data,save,progress);
  assert.equal(e.earned('challenge-complete:45'),STATUS.NO);assert.equal(e.earned('feature:dead-god-challenges'),STATUS.NO);
  save.chunks.challenges[1]=undefined;assert.equal(createEvaluator(data,save,progress).earned('challenge-complete:1'),STATUS.UNKNOWN);
});

test('all uncompleted challenges connect to Dead God, including already accessible challenges',()=>{
  const {save,progress}=fixture();
  for(const mode of ['progress','availability']){
    const graph=buildGraph(data,createEvaluator(data,save,progress),{targetId:'feature:dead-god',mode});
    for(let id=1;id<=45;id++){
      assert.equal(graph.nodes.filter(n=>n.id===`challenge-complete:${id}`).length,1);
      assert.ok(reaches(graph,`challenge-complete:${id}`,'feature:dead-god-challenges'));
      assert.ok(reaches(graph,`challenge-complete:${id}`,'feature:dead-god'));
    }
    assert.ok(!graph.nodes.some(n=>n.id==='challenge:1')); // Open by default; still needs completing.
    assert.ok(reaches(graph,'character:tainted-eden','challenge:45'));
    assert.ok(reaches(graph,'challenge:45','challenge-complete:45'));
  }
});

test('a challenge completion is shared with its reward; completed branches disappear, leaving the next concrete task',()=>{
  const {save,progress}=fixture(),reward=data.nodes.find(n=>n.name==='Rune of Perthro');
  let graph=buildGraph(data,createEvaluator(data,save,progress),{targetId:'feature:dead-god'});
  assert.ok(reaches(graph,'collectible:20','challenge:6'));
  assert.ok(reaches(graph,'challenge:6','challenge-complete:6'));
  assert.ok(reaches(graph,'challenge-complete:6',reward.id));
  assert.ok(reaches(graph,'challenge-complete:6','feature:dead-god-challenges'));
  assert.equal(graph.nodes.filter(n=>n.id==='challenge-complete:6').length,1);
  save.chunks.challenges.fill(1);save.chunks.challenges[34]=0;
  graph=buildGraph(data,createEvaluator(data,save,progress),{targetId:'feature:dead-god-challenges'});
  assert.deepEqual(graph.nodes.filter(n=>n.challenge?.role==='completion').map(n=>n.id),['challenge-complete:34']);
  assert.ok(reaches(graph,'challenge-complete:34','feature:dead-god-challenges'));
  const shown=buildGraph(data,createEvaluator(data,save,progress),{targetId:'feature:dead-god-challenges',showOpened:true});
  assert.equal(shown.nodes.filter(n=>n.challenge?.role==='completion').length,45);
});

test('challenge authoring is reproducible, preserves the guide ranks and never changes direct evidence into node references',()=>{
  const before=structuredClone(data),updated=addChallengePaths(data,reference,profile);
  assert.deepEqual(data,before);assert.deepEqual(updated,data);
  const guide=input=>input.nodes.filter(n=>n.tier).map(n=>[n.id,n.tier,n.order]);assert.deepEqual(guide(updated),guide(data));
  for(const node of updated.nodes)assert.equal(conditionReferences(node.unlock.evidence).length,0);
});
