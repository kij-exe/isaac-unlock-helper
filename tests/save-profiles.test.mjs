import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parseSave,slotProgress,kageChecksum,rebirthChecksum,SaveError} from '../site/js/save-parser.js';
import {SAVE_PROFILES,decodeCompletion} from '../site/js/save-profiles.js';
import {catalogForSave} from '../site/js/catalog-profile.js';
import {createEvaluator,buildGraph,validateCatalog,STATUS} from '../site/js/unlock-engine.js';
const catalog=JSON.parse(fs.readFileSync('site/data/game-catalog.json')),data=JSON.parse(fs.readFileSync('site/data/unlocks.json'));
const sample=name=>fs.readFileSync('context/'+name),exists=name=>fs.existsSync('context/'+name);
function synthetic(profile,{allSecrets=false}={}){
  const uints=(...values)=>{const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;};
  const chunks=[null,['achievements',1],['eventCounters',4],['levels',4],['collection',1],['mini',1],['bosses',1],['challenges',1],['cutscenes',4],['settings',4],['seeds',1]],parts=[Buffer.from(profile.header),uints(0)],layout=[];let position=20;
  profile.counts.forEach((count,index)=>{
    const id=index+1;
    if(id===11){parts.push(uints(11,0,4),uints(4,0,2,0,3,0,1,0));return;}
    const width=chunks[id][1],sizeWritten=count*(id===1?1:4),body=Buffer.alloc(count*width,id===1&&allSecrets?1:0);
    parts.push(uints(id,sizeWritten,count),body);layout.push({id,count,sizeWritten,dataOffset:position+12});position+=12+body.length;
  });
  parts.push(uints(6));const payload=Buffer.concat(parts);
  const checksum=profile.id==='rebirth'?rebirthChecksum(payload,layout,0,6):kageChecksum(payload.subarray(16));
  return Buffer.concat([payload,uints(checksum)]);
}

test('each supported edition parses a synthetic empty slot, independent of all its secret flags',()=>{
  for(const profile of SAVE_PROFILES){
    const before=parseSave(synthetic(profile)),after=parseSave(synthetic(profile,{allSecrets:true}));
    assert.equal(before.profile.id,profile.id);assert.equal(before.checksum.valid,true);
    const a=slotProgress(before,catalog),b=slotProgress(after,catalog);assert.deepEqual(b,a);
    assert.equal(a.summary.marks,0);assert.equal(a.summary.challenges,0);assert.equal(a.summary.collected,0);
    assert.equal(a.characters.length,profile.characters);assert.equal(a.capabilities.marks,profile.characters*profile.marksPerCharacter);
    if(profile.planner){const adapted=catalogForSave(data,before);assert.deepEqual(buildGraph(adapted,createEvaluator(adapted,before,a)),buildGraph(adapted,createEvaluator(adapted,after,b)));}
  }
});
test('Repentance+ decodes every offline/online combination without treating online Normal as Hard',()=>{
  for(let raw=0;raw<16;raw++){
    const result=decodeCompletion(raw,'repentance-plus');
    assert.equal(result.value,raw&10?2:raw&5?1:0);assert.equal(result.rawValue,raw);
    assert.equal(result.online,raw&8?2:raw&4?1:0);
  }
  assert.equal(decodeCompletion(4,'repentance-plus').value,1);
  assert.equal(decodeCompletion(3,'repentance-plus').value,2);
  assert.equal(decodeCompletion(15,'repentance-plus').value,2);
  assert.throws(()=>decodeCompletion(16,'repentance-plus'));assert.throws(()=>decodeCompletion(3,'repentance'));
});
test('Repentance+ Dead God adds four actions, never four achievement conditions, without mutating the base catalog',()=>{
  const save=parseSave(synthetic(SAVE_PROFILES.find(p=>p.id==='repentance-plus'))),adapted=catalogForSave(data,save);
  assert.deepEqual(validateCatalog(adapted),[]);
  const goal=adapted.nodes.find(n=>n.id==='feature:dead-god-conditions'),conditions=goal.unlock.requirements.conditions.flatMap(g=>g.conditions);
  assert.equal(conditions.length,640);assert.deepEqual(conditions.slice(-4).map(c=>c.goalSecretId),[638,639,640,641]);
  assert.ok(conditions.slice(-4).every(c=>c.type==='manual'));
  assert.equal(data.nodes.find(n=>n.id===goal.id).goal.requiredCount,636);
  save.chunks.achievements.fill(1);
  assert.notEqual(createEvaluator(adapted,save,slotProgress(save,catalog)).earned('feature:dead-god'),STATUS.YES);
});
test('synthetic Rebirth and Repentance+ reject corruption, unknown schemas and trailing bytes',()=>{
  for(const profile of SAVE_PROFILES){
    const b=synthetic(profile),broken=Buffer.from(b);broken[40]^=1;
    assert.throws(()=>parseSave(broken),SaveError);assert.throws(()=>parseSave(b.subarray(0,-1)),SaveError);
    assert.throws(()=>parseSave(Buffer.concat([b,Buffer.from('extra')])),/Unexpected data/);
  }
  const unknown={...SAVE_PROFILES[2],counts:[643,...SAVE_PROFILES[2].counts.slice(1)]};
  assert.throws(()=>parseSave(synthetic(unknown)),error=>error.code==='unsupported_layout'&&error.message.includes('643'));
});
test('gamestate is recognized by content and the error names the correct sibling file for its slot',()=>{
  const bytes=Buffer.concat([Buffer.from('ISAACNG_GSR0169'),Buffer.alloc(20)]);
  assert.throws(()=>parseSave(bytes,{fileName:'20261015.rep+gamestate2.dat'}),error=>error.code==='run_state'&&error.message.includes('rep+persistentgamedata2.dat'));
  assert.throws(()=>parseSave(bytes,{fileName:'renamed.dat'}),error=>error.code==='run_state');
});
test('new real fixtures match independent Python parsing and checksums without modifying any input',{skip:!exists('rep+persistentgamedata1.dat')||!exists('persistentgamedata1.dat')},()=>{
  const names=['persistentgamedata1.dat','rep+persistentgamedata1.dat','rep+persistentgamedata2.dat','rep_persistentgamedata1.dat','rep_persistentgamedata2.dat'];
  const result=spawnSync('python3',['-c','import json,sys; from pathlib import Path; from isaac_save import parse_bytes; print(json.dumps([parse_bytes(Path(p).read_bytes()) for p in sys.argv[1:]]))',...names.map(n=>'context/'+n)],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const python=JSON.parse(result.stdout);
  names.forEach((name,index)=>{
    const bytes=sample(name),parsed=parseSave(bytes),other=python[index];
    assert.equal(parsed.checksum.computed,other.checksum.computed);assert.equal(parsed.checksum.valid,true);
    assert.deepEqual(parsed.layout.map(e=>[e.id,e.count,e.actualSize]),other.layout.map(e=>[e.id,e.count,e.actual_size]));
    assert.deepEqual(parsed.chunks.eventCounters,other.chunks.event_counters);assert.deepEqual(parsed.chunks.achievements,other.chunks.achievements);
    assert.deepEqual(parsed.chunks.collection,other.chunks.collection);assert.deepEqual(parsed.chunks.challenges,other.chunks.challenges);
    assert.deepEqual(sample(name),bytes);
  });
  const full=parseSave(sample(names[1])),empty=parseSave(sample(names[2])),legacy=slotProgress(parseSave(sample(names[0])),catalog),p=slotProgress(full,catalog);
  assert.equal(full.checksum.computed,0x04adfd70);assert.equal(empty.checksum.computed,0xf9cacd7e);
  assert.equal(p.summary.marks,408);assert.equal(p.summary.challenges,44);assert.equal(p.summary.collected,714);assert.equal(p.summary.bestiary,470);
  assert.equal(slotProgress(empty,catalog).summary.marks,0);
  assert.equal(legacy.summary.marks,7);assert.equal(legacy.characters.find(c=>c.name==='Azazel').marks.Satan.value,2);
  assert.equal(legacy.counters[10],145);assert.equal(legacy.counters[111],3);assert.equal(legacy.counters[158],null);
});
