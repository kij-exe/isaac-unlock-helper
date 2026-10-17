import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseSave,kageChecksum,slotProgress,SaveError} from '../site/js/save-parser.js';
import {RANKS,rankFor,rankEntries,moveEntry,layoutOf,applyLayout} from '../site/js/tier-ranks.js';
import {edgeGeometry,zoomAnchor,clampZoom} from '../site/js/graph-view.js';
import {validateCatalog,createEvaluator,buildGraph,layoutGraph,STATUS} from '../site/js/unlock-engine.js';

const readJson = path => JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=readJson('../site/data/unlocks.json'), catalog=readJson('../site/data/game-catalog.json');
const hasFixtures=fs.existsSync(new URL('../context/rep_persistentgamedata1.dat',import.meta.url));
const fixture = id => parseSave(fs.readFileSync(new URL(`../context/rep_persistentgamedata${id}.dat`,import.meta.url)));

function syntheticEmptyBytes() {
  const uints=(...values)=>{const bytes=Buffer.alloc(values.length*4);values.forEach((value,index)=>bytes.writeUInt32LE(value,index*4));return bytes;};
  const counts=[0,638,496,14,733,7,104,46,27,2,80];
  const parts=[Buffer.from('ISAACNGSAVE09R  '),uints(0)];
  for(let id=1;id<=10;id++){
    const width=[2,3,8,9].includes(id)?4:1;
    parts.push(uints(id,counts[id]*(id===1?1:4),counts[id]),Buffer.alloc(counts[id]*width));
  }
  parts.push(uints(11,0,4),uints(4,0,2,0,3,0,1,0),uints(6));
  const payload=Buffer.concat(parts);return Buffer.concat([payload,uints(kageChecksum(payload.subarray(16)))]);
}

test('synthetic pristine Repentance save parses without private fixtures',()=>{
  const save=parseSave(syntheticEmptyBytes()),progress=slotProgress(save,catalog);
  assert.equal(save.checksum.computed,0x01558f80);
  assert.deepEqual(progress.summary,{marks:0,challenges:0,collected:0,unknownCollectionFlags:[],bestiary:0});
});

test('published catalog has unique IDs, valid references and an acyclic graph',()=>{
  assert.deepEqual(validateCatalog(data),[]);
  assert.equal('tiers' in data,false);
  assert.ok(data.nodes.filter(n=>n.rank).length>=188);
});
test('invalid or cyclic dependencies fail validation',()=>{
  const sample=structuredClone(data);
  sample.nodes[0].unlock.requirements={type:'node',id:sample.nodes[0].id};
  assert.ok(validateCatalog(sample).some(e=>e.includes('Цикл')));
  sample.nodes[0].unlock.requirements={type:'node',id:'does:not-exist'};
  assert.ok(validateCatalog(sample).some(e=>e.includes('Нет зависимости')));
});
test('secret flags are not a supported evidence condition',()=>{
  const sample=structuredClone(data);
  sample.nodes[0].unlock.evidence={type:'achievement',id:1};
  assert.ok(validateCatalog(sample).some(e=>e.includes('Неизвестное условие')));
});

test('collected items infer the unlock result only when save evidence inference is enabled',()=>{
  const sample={nodes:[
    {id:'item',kind:'collectible',secretId:1,catalog:{kind:'passive',itemId:7},unlock:{description:'Manual action',requirements:manual('item')}},
    {id:'challenge',kind:'challenge',secretId:2,unlock:{description:'Complete challenge',requirements:{type:'challenge',id:1}}},
  ]};
  const save=blankSave();save.chunks.collection[7]=1;save.chunks.challenges[1]=1;
  const evaluator=createEvaluator(sample,save,blankProgress());
  assert.equal(evaluator.availability('item').status,STATUS.NO);
  assert.deepEqual(evaluator.availability('item',{inferSlotEvidence:true}),{status:STATUS.YES,source:'collection'});
  assert.equal(evaluator.earned('item'),STATUS.UNKNOWN);
  const inferred=createEvaluator(sample,save,blankProgress(),{}, {inferCollectedUnlocks:true});
  assert.equal(inferred.earned('item'),STATUS.YES);
  assert.equal(inferred.evaluate(manual('item')),STATUS.UNKNOWN);
  const graph=buildGraph(sample,inferred,{targetId:'item'});
  assert.equal(graph.nodes.find(node=>node.id==='item').status,STATUS.YES);
  assert.deepEqual(graph.edges,[]);
  assert.equal(evaluator.availability('challenge').status,STATUS.NO);
  assert.deepEqual(evaluator.availability('challenge',{inferSlotEvidence:true}),{status:STATUS.YES,source:'slot_evidence'});
});

test('browser parser agrees with game checksums and recorded slot progress',{skip:!hasFixtures},()=>{
  const first=fixture(1),second=fixture(2),p=slotProgress(first,catalog),empty=slotProgress(second,catalog);
  assert.equal(first.checksum.computed,0xe5440238);assert.equal(second.checksum.computed,0x01558f80);
  assert.deepEqual(p.summary,{marks:3,challenges:1,collected:144,unknownCollectionFlags:[43,61],bestiary:231});
  assert.deepEqual(empty.summary,{marks:0,challenges:0,collected:0,unknownCollectionFlags:[],bestiary:0});
  const azazel=p.characters.find(c=>c.name==='Azazel');
  assert.deepEqual(Object.entries(azazel.marks).filter(([,m])=>m.value).map(([name])=>name).sort(),['Mom’s Heart / It Lives!','Satan','Boss Rush'].sort());
});
test('short, corrupt and trailing save data are rejected',{skip:!hasFixtures},()=>{
  const bytes=fs.readFileSync(new URL('../context/rep_persistentgamedata1.dat',import.meta.url));
  for(const length of [0,15,31,2000,bytes.length-1])assert.throws(()=>parseSave(bytes.subarray(0,length)),SaveError);
  const corrupt=Buffer.from(bytes);corrupt[0x2aa+8]^=1;assert.throws(()=>parseSave(corrupt),/сумма/);
  assert.throws(()=>parseSave(Buffer.concat([bytes,Buffer.from('extra')])),/лишние/);
});
test('all 637 secrets on an empty slot create no gameplay or progress graph',()=>{
  const bytes=syntheticEmptyBytes();
  const original=parseSave(bytes),p=slotProgress(original,catalog);
  bytes.fill(1,33,670);bytes.writeUInt32LE(kageChecksum(bytes.subarray(16,-4)),bytes.length-4);
  const imported=parseSave(bytes),importedProgress=slotProgress(imported,catalog);
  assert.deepEqual(importedProgress,p);
  const before=createEvaluator(data,original,p),after=createEvaluator(data,imported,importedProgress);
  assert.deepEqual(buildGraph(data,before),buildGraph(data,after));
  assert.equal(after.availability('collectible:114').status,STATUS.YES);
  assert.notEqual(after.earned('collectible:114'),STATUS.YES);
});
test('Hush encounter and death do not count as defeating Hush',{skip:!hasFixtures},()=>{
  const save=fixture(1),p=slotProgress(save,catalog),hush=p.bestiary.find(e=>e.type===407&&e.variant===0);
  assert.equal(hush.kills,0);assert.equal(hush.deaths,1);
  assert.equal(createEvaluator(data,save,p).evaluate({type:'boss_defeated',boss:'Hush'}),STATUS.NO);
});

const manual = key => ({type:'manual',key,label:key,reason:'not retained'});
const ref = id => ({type:'node',id});
const all = (...conditions) => ({type:'all',conditions});
function synthetic() {
  const nodes=[
    {id:'b',name:'B',kind:'character',secretId:1,unlock:{description:'B action',requirements:manual('b')}},
    {id:'a',name:'A',kind:'collectible',rank:'S',order:0,secretId:2,unlock:{description:'A action',requirements:all(ref('b'),manual('a'))}},
    {id:'c',name:'C',kind:'collectible',rank:'S',order:1,secretId:3,unlock:{description:'C action',requirements:all(ref('b'),manual('c'))}},
  ];
  return {schemaVersion:1,nodes:nodes.map(n=>({...n,sources:['https://example.com']}))};
}
const blankSave=()=>({chunks:{achievements:[0,0,0,0],challenges:Array(46).fill(0),collection:Array(733).fill(0)}});
const blankProgress=()=>({characters:[{name:'Isaac',marks:{Satan:{value:0}}}],counters:Array(496).fill(0)});

test('closed shared prerequisite B is one node pointing to both A and C',()=>{
  const sample=synthetic(),graph=buildGraph(sample,createEvaluator(sample,blankSave(),blankProgress()));
  assert.equal(graph.nodes.filter(n=>n.id==='b').length,1);
  assert.deepEqual(graph.edges.map(e=>[e.from,e.to]).sort(),[['b','a'],['b','c']]);
});
test('completed shared B disappears and A/C become independent nodes',()=>{
  const sample=synthetic(),graph=buildGraph(sample,createEvaluator(sample,blankSave(),blankProgress(),{b:true}));
  assert.deepEqual(graph.nodes.map(n=>n.id).sort(),['a','c']);assert.deepEqual(graph.edges,[]);
});
test('availability mode prunes available B without crediting its action in progress mode',()=>{
  const sample=synthetic(),save=blankSave();save.chunks.achievements[1]=1;
  const evaluator=createEvaluator(sample,save,blankProgress());
  assert.notEqual(evaluator.earned('b'),STATUS.YES);
  assert.ok(buildGraph(sample,evaluator).nodes.some(n=>n.id==='b'));
  assert.deepEqual(buildGraph(sample,evaluator,{mode:'availability'}).nodes.map(n=>n.id).sort(),['a','c']);
});
test('three-state AND / OR preserve uncertainty and confirmed alternatives',()=>{
  const sample=synthetic(),e=createEvaluator(sample,blankSave(),blankProgress());
  assert.equal(e.evaluate(all({type:'constant',value:false},manual('x'))),STATUS.NO);
  assert.equal(e.evaluate({type:'any',conditions:[{type:'constant',value:true},manual('x')]}),STATUS.YES);
  assert.equal(e.evaluate(all({type:'constant',value:true},manual('x'))),STATUS.UNKNOWN);
});
test('satisfied OR alternative drops all remaining alternatives while another action is pending',()=>{
  const sample=synthetic();
  sample.nodes[1].unlock.requirements=all({type:'any',conditions:[ref('b'),ref('c')]},manual('a'));
  sample.nodes[2].unlock.requirements=manual('c');
  const e=createEvaluator(sample,blankSave(),blankProgress(),{b:true});
  const graph=buildGraph(sample,e,{targetId:'a'});
  assert.deepEqual(graph.nodes.map(n=>n.id),['a']);assert.deepEqual(graph.edges,[]);
  const save=blankSave();save.chunks.achievements[1]=1;
  const availabilityGraph=buildGraph(sample,createEvaluator(sample,save,blankProgress()),{targetId:'a',mode:'availability'});
  assert.deepEqual(availabilityGraph.nodes.map(n=>n.id),['a']);
});
test('a directly recorded mark proves a reward even if earlier prerequisites are unknown',()=>{
  const sample=synthetic(),progress=blankProgress();progress.characters[0].marks.Satan.value=2;
  sample.nodes[1].unlock.evidence={type:'mark',character:'Isaac',target:'Satan',minimum:1};
  const e=createEvaluator(sample,blankSave(),progress);
  assert.equal(e.earned('a'),STATUS.YES);assert.notEqual(e.earned('b'),STATUS.YES);
});
test('focusing a target retains its unopened ancestry, but not unrelated rewards',()=>{
  const sample=synthetic(),graph=buildGraph(sample,createEvaluator(sample,blankSave(),blankProgress()),{targetId:'a'});
  assert.deepEqual(graph.nodes.map(n=>n.id).sort(),['a','b']);
});
test('vertical layout separates every node and keeps every dependency below its parent',()=>{
  const e=createEvaluator(data,parseSave(syntheticEmptyBytes()),slotProgress(parseSave(syntheticEmptyBytes()),catalog));
  for(const graph of [buildGraph(synthetic(),createEvaluator(synthetic(),blankSave(),blankProgress())),buildGraph(data,e)]){
    const layout=layoutGraph(graph), map=new Map(layout.nodes.map(n=>[n.id,n]));
    for(const edge of layout.edges)assert.ok(map.get(edge.from).y+map.get(edge.from).height<map.get(edge.to).y);
    for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++){
      const a=layout.nodes[i],b=layout.nodes[j];
      assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${a.id} overlaps ${b.id}`);
    }
    assert.equal(layout.nodes.length,graph.nodes.length,'routing passages do not duplicate shared dependencies');
    for(const node of layout.nodes)assert.ok(node.x>=0&&node.x+node.width<=layout.width&&node.y+node.height<=layout.height);
  }
});
test('wheel zoom preserves the point under the cursor and respects scale limits',()=>{
  const scroll=180,cursor=120,before=.8,after=1.2;
  const next=zoomAnchor(scroll,cursor,before,after);
  assert.equal((next+cursor)/after,(scroll+cursor)/before);
  assert.equal(clampZoom(.01),.025);assert.equal(clampZoom(10),2.5);
});
test('edges connect the bottom of a parent to the top of its child, including after dragging',()=>{
  const a={x:20,y:30,width:220,height:78},b={x:288,y:250,width:220,height:78};
  assert.match(edgeGeometry(a,b).path,/^M 130 108 C /);
  assert.ok(edgeGeometry(a,b).path.endsWith('398 250'));
  const moved=edgeGeometry({...a,x:70,y:50},b);
  assert.match(moved.path,/^M 180 128 C /);assert.equal(moved.x,289);
});
test('tier-list entries store only a rank and a unique position inside it',()=>{
  const ids=RANKS.map(rank=>rank.id),entries=data.nodes.filter(node=>node.rank);
  assert.deepEqual(ids,['DEAD GOD','S','A','B','C','D','F','OPEN']);
  for(const node of data.nodes)assert.equal('tier' in node,false,node.id);
  for(const node of entries)assert.ok(ids.includes(rankFor(node)),node.id);
  for(const id of ids)assert.deepEqual(rankEntries(entries,id).map(node=>node.order),Array.from({length:rankEntries(entries,id).length},(_,i)=>i),id);
  assert.equal(rankFor({id:'support'}),null);
  assert.equal(rankFor({id:'unknown',rank:'Z'}),null);
  const sample=structuredClone(data);sample.nodes.find(node=>node.rank).rank='Z';
  assert.match(validateCatalog(sample).join('\n'),/Некорректный rank/);
  sample.nodes.find(node=>node.rank==='S').tier='good-1';
  assert.match(validateCatalog(sample).join('\n'),/Устаревшее поле tier/);
});
test('dragging an entry moves it between ranks, renumbers both rows and can be restored',()=>{
  const base=structuredClone(data),copy=structuredClone(data),repo=layoutOf(base);
  const [first,second]=rankEntries(base.nodes,'S'),target=rankEntries(base.nodes,'F')[1];
  assert.ok(moveEntry([base,copy],first.id,'F',target.id));
  for(const catalog of [base,copy]){
    const f=rankEntries(catalog.nodes,'F'),s=rankEntries(catalog.nodes,'S');
    assert.equal(f[1].id,first.id);assert.equal(f[2].id,target.id);assert.equal(s[0].id,second.id);
    for(const row of [f,s])assert.deepEqual(row.map(node=>node.order),row.map((_,i)=>i));
  }
  assert.ok(moveEntry([base],first.id,'F'));assert.equal(rankEntries(base.nodes,'F').at(-1).id,first.id);
  assert.equal(moveEntry([base],'feature:dead-god','S'),false);
  assert.equal(moveEntry([base],first.id,'DEAD GOD'),false);
  const saved=JSON.parse(JSON.stringify(layoutOf(base))),fresh=structuredClone(data);
  assert.ok(applyLayout(fresh,saved)>0);assert.deepEqual(layoutOf(fresh),layoutOf(base));
  applyLayout(base,repo);assert.deepEqual(base,data);
  assert.equal(applyLayout(fresh,{'feature:dead-god':['S',0],[second.id]:['Z',0],'missing':['S',0]}),0);
});
test('every provided local sprite is an actual PNG in the static site',()=>{
  const manifest=readJson('../site/assets/icons/manifest.json');
  for(const entry of manifest.icons.filter(e=>e.status==='downloaded')){
    assert.ok(entry.path.startsWith('assets/icons/'));
    const bytes=fs.readFileSync(new URL('../site/'+entry.path,import.meta.url));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  }
});

test('challenge and group icons use Isaac artwork instead of handmade SVGs',()=>{
  const manifest=readJson('../site/assets/icons/manifest.json');
  const entries=new Map(manifest.icons.map(entry=>[entry.nodeId,entry]));
  const challengeRewards=readJson('../data/catalog.json').challenges;
  assert.equal(manifest.icons.filter(entry=>entry.status==='designed').length,0);
  for(const node of data.nodes.filter(entry=>entry.challenge)){
    const icon=entries.get(node.id),reward=challengeRewards[String(node.challenge.id)];
    assert.equal(icon.status,'downloaded',node.id);
    assert.equal(icon.imageKind,'game-unlock-notification',node.id);
    assert.equal(icon.artworkId,reward.achievement_id,node.id);
  }
  for(const icon of manifest.icons.filter(entry=>entry.sourceNodeId)){
    const source=entries.get(icon.sourceNodeId);
    assert.ok(source,`Missing source sprite ${icon.sourceNodeId}`);
    assert.equal(icon.path,source.path,icon.nodeId);
    assert.equal(icon.sha256,source.sha256,icon.nodeId);
  }
});

test('every unlock and prerequisite has a packaged local image with a matching digest',()=>{
  const manifest=readJson('../site/assets/icons/manifest.json');
  const entries=new Map(manifest.icons.map(entry=>[entry.nodeId,entry]));
  assert.equal(entries.size,manifest.icons.length);
  for(const node of data.nodes){
    const entry=entries.get(node.id);
    assert.ok(entry,`No icon for ${node.id}`);
    assert.ok(['downloaded','designed'].includes(entry.status),node.id);
    assert.ok(entry.path.startsWith('assets/icons/')&&!entry.path.includes('..'));
    const bytes=fs.readFileSync(new URL('../site/'+entry.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,node.id);
    if(entry.status==='designed'){
      assert.ok(entry.path.endsWith('.svg'));assert.match(bytes.toString(),/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      assert.match(bytes.toString(),/<title>.+<\/title>/);
    }else{
      assert.equal(bytes.readUInt32BE(16),entry.dimensions[0]);assert.equal(bytes.readUInt32BE(20),entry.dimensions[1]);
    }
  }
});
test('Charged Key availability reads its own secret, separate from Greed’s Gullet and slot evidence',()=>{
  const save=parseSave(syntheticEmptyBytes()),p=slotProgress(save,catalog);
  save.chunks.achievements[335]=1;
  const wrong=createEvaluator(data,save,p);
  assert.equal(wrong.availability('feature:charged-key').status,STATUS.NO);
  save.chunks.achievements[333]=1;
  const correct=createEvaluator(data,save,p);
  assert.equal(correct.availability('feature:charged-key').status,STATUS.YES);
  assert.notEqual(correct.earned('feature:charged-key'),STATUS.YES);
});

test('Dead God is the single goal in a tier above S, with every other Repentance condition exactly once',()=>{
  assert.equal(RANKS[0].id,'DEAD GOD');
  assert.deepEqual(data.nodes.filter(node=>node.rank==='DEAD GOD').map(node=>node.id),['feature:dead-god']);
  const conditions=data.nodes.find(node=>node.id==='feature:dead-god-conditions').unlock.requirements.conditions.flatMap(group=>group.conditions);
  assert.equal(conditions.length,636);
  assert.deepEqual(conditions.map(condition=>condition.goalSecretId),Array.from({length:636},(_,i)=>i+1));
  assert.ok(conditions.some(condition=>condition.type==='manual'));
  assert.ok(conditions.some(condition=>condition.type==='mark'));
  assert.ok(conditions.some(condition=>condition.type==='node'));
  const pong=conditions.find(condition=>condition.goalSecretId===335);assert.equal(pong.type,'node');assert.equal(pong.id,'challenge-complete:35');
});
test('Dead God collection requires all 717 visible items, including quest parts, and excludes hidden effects and nonexistent IDs',()=>{
  const condition=data.nodes.find(node=>node.id==='feature:dead-god-collection').unlock.requirements;
  const ids=condition.conditions.flatMap(group=>group.conditions.map(item=>item.id));
  assert.equal(ids.length,717);assert.equal(new Set(ids).size,717);
  for(const id of [474,550,551,552,626,627,628,633,668])assert.ok(ids.includes(id),`Required item ${id}`);
  for(const id of [43,59,61,235,587,613,620,630,648,656,662,666,714,715,718])assert.ok(!ids.includes(id),`Excluded item ${id}`);
  const save=parseSave(syntheticEmptyBytes()),progress=slotProgress(save,catalog);
  save.chunks.achievements.fill(1);
  assert.equal(createEvaluator(data,save,progress).earned('feature:dead-god-collection'),STATUS.NO);
  for(const id of ids)save.chunks.collection[id]=1;
  assert.equal(createEvaluator(data,save,progress).earned('feature:dead-god-collection'),STATUS.YES);
  save.chunks.collection[474]=0;
  assert.equal(createEvaluator(data,save,progress).earned('feature:dead-god-collection'),STATUS.NO);
});
test('Dead God requires gameplay facts and explicit unrecorded actions, even when its save secret is set',()=>{
  const save=parseSave(syntheticEmptyBytes()),progress=slotProgress(save,catalog),manual={};
  save.chunks.achievements.fill(1);
  let evaluator=createEvaluator(data,save,progress);
  assert.equal(evaluator.availability('feature:dead-god').status,STATUS.YES);
  assert.equal(evaluator.earned('feature:dead-god'),STATUS.NO);
  const walk=condition=>{if(condition.type==='manual')manual[condition.key]=true;for(const child of condition.conditions||[])walk(child);};
  data.nodes.forEach(node=>walk(node.unlock.requirements));
  progress.counters.fill(10000);
  for(const character of progress.characters)for(const mark of Object.values(character.marks))mark.value=2;
  save.chunks.challenges.fill(1);save.chunks.collection.fill(1);save.chunks.achievements.fill(0);
  evaluator=createEvaluator(data,save,progress,manual);
  assert.equal(evaluator.earned('feature:dead-god'),STATUS.YES);
  assert.equal(evaluator.availability('feature:dead-god').status,STATUS.NO);
  save.chunks.challenges[45]=0;
  assert.equal(createEvaluator(data,save,progress,manual).earned('feature:dead-god'),STATUS.NO);
  save.chunks.challenges[45]=1;
  manual['dead-god:condition:69']=false;
  assert.notEqual(createEvaluator(data,save,progress,manual).earned('feature:dead-god'),STATUS.YES);
});
test('collection conditions preserve unknown bytes and reject invalid item IDs',()=>{
  const e=createEvaluator(synthetic(),blankSave(),blankProgress());
  assert.equal(e.evaluate({type:'collected',id:1}),STATUS.NO);
  assert.equal(e.evaluate({type:'collected',id:733}),STATUS.UNKNOWN);
  const broken=synthetic();broken.nodes[0].unlock.requirements={type:'collected',id:733};
  assert.ok(validateCatalog(broken).some(error=>error.includes('Некорректный предмет коллекции')));
});
