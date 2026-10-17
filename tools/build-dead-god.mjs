// Offline, reproducible authoring of the Repentance completion goal.
// Never interprets achievement flags as evidence. Text is mapped only by exact,
// reviewed patterns; every other action remains an explicit manual condition.
import fs from 'node:fs';
import {addChallengePaths,linkChallengeCompletions} from './challenge-catalog.mjs';
const file='site/data/unlocks.json';
const reference=JSON.parse(fs.readFileSync('data/catalog.json'));
const challengeProfile=JSON.parse(fs.readFileSync('data/challenges-repentance.json'));
const data=addChallengePaths(JSON.parse(fs.readFileSync(file)),reference,challengeProfile);
const collection=JSON.parse(fs.readFileSync('site/data/dead-god-collection.json'));
const goalIds=new Set(['feature:dead-god','feature:dead-god-conditions','feature:dead-god-collection','feature:dead-god-challenges']);
data.nodes=data.nodes.filter(node=>!goalIds.has(node.id));
const bySecret=new Map();
for(const node of data.nodes)if(node.secretId&&!bySecret.has(node.secretId))bySecret.set(node.secretId,node);
const chars=reference.characters.map(character=>character.name);
const charName=name=>({'Jacob and Esau':'Jacob & Esau','Tainted Forgotten':'Tainted The Forgotten','Tainted Lost':'Tainted The Lost'}[name]||name);
const ref=id=>({type:'node',id});
const all=(conditions,label)=>({type:'all',...(label?{label}:{}),conditions});
const mark=(character,target,minimum=1)=>({type:'mark',character,target,minimum});
const targets=['Mom’s Heart / It Lives!','Isaac','Satan','Boss Rush','???','The Lamb','Mega Satan','Hush','Greed / Greedier','Delirium','Mother','The Beast'];
function mapAction(text){
  const normalized=text.replace(/\u00a0/g,' ');
  let match;
  if((match=normalized.match(/^Complete .+ \(challenge #(\d+)\)$/)))return {type:'challenge',id:Number(match[1])};
  if((match=normalized.match(/^Defeat Mom's Heart or It Lives! on Hard mode as (.+)$/))){const c=charName(match[1]);if(chars.includes(c))return mark(c,targets[0],2);}
  if((match=normalized.match(/^Earn all Hard mode Completion Marks as (.+)$/))){const c=charName(match[1]);if(chars.includes(c))return all(targets.map(target=>mark(c,target,2)));}
  if((match=normalized.match(/^Complete the Boss Rush as (.+)$/))){const c=charName(match[1]);if(chars.includes(c))return mark(c,'Boss Rush');}
  if((match=normalized.match(/^Defeat (.+) as (.+)$/))){
    const c=charName(match[2]);if(!chars.includes(c))return null;
    if(match[1]==='Isaac, ???, Satan, and The Lamb')return all(['Isaac','???','Satan','The Lamb'].map(target=>mark(c,target)));
    if(match[1]==='Hush and Boss Rush')return all(['Hush','Boss Rush'].map(target=>mark(c,target)));
    if(match[1]==='Ultra Greed')return mark(c,'Greed / Greedier',1);
    if(match[1]==='Ultra Greedier')return mark(c,'Greed / Greedier',2);
    if(targets.includes(match[1]))return mark(c,match[1]);
  }
  const patterns=[[/^Defeat Mom's Heart(?:\/It Lives!)? (\d+) times$/,1],[/^Destroy (\d+) Tinted Rocks$/,3],[/^Destroy (\d+) rocks$/,2],[/^Destroy (\d+) Poops$/,5],[/^Visit (\d+) Arcades$/,9],[/^Defeat Isaac (\d+) times$/,11],[/^Donate (\d+) [Cc]oins to the Donation Machine$/,20],[/^Donate (\d+) Coins to the Greed Donation Machine$/,115],[/^Participate in (\d+) Daily Challenges$/,190],[/^Destroy (\d+) rainbow poops$/,194],[/^Use Cards and Runes (\d+) times$/,196],[/^Sleep in (\d+) beds$/,202]];
  for(const [pattern,id]of patterns)if((match=normalized.match(pattern)))return {type:'counter',id,atLeast:Number(match[1])};
  if(['Defeat Hush','Defeat The Lamb','Defeat Mother'].includes(normalized))return {type:'boss_defeated',boss:normalized.slice(7)};
  if(normalized==='Defeat Delirium for the 1st time')return {type:'boss_defeated',boss:'Delirium'};
  return null;
}
const ranges=[[1,178,'Rebirth · requirements 1–178'],[179,276,'Afterbirth · requirements 179–276'],[277,403,'Afterbirth+ · requirements 277–403'],[404,636,'Repentance · requirements 404–636']];
const conditions=ranges.map(([start,end,label])=>all(Array.from({length:end-start+1},(_,index)=>{
  const id=start+index,entry=reference.achievements[id],existing=bySecret.get(id);
  const action=existing?ref(existing.id):mapAction(entry.condition)||{type:'manual',key:`dead-god:condition:${id}`,
    reason:'The save does not contain enough independent evidence of this action. An unlocked secret does not prove it was performed in this slot.'};
  return {...linkChallengeCompletions(action),goalSecretId:id,label:`#${id} · ${entry.name}: ${entry.condition}`};
}),label));
const sources=['https://bindingofisaacrebirth.wiki.gg/wiki/Achievements',collection.source,reference.sources.find(source=>source.url.includes('deadgod.yeeterie.org')).url];
const goalNode=(id,name,description,requirements,extra={})=>({id,kind:'feature',name,wikiUrl:'https://bindingofisaacrebirth.wiki.gg/wiki/Achievements',unlock:{description,requirements},sources,...extra});
const collectorGroups=[];
for(let offset=0;offset<collection.requiredItems.length;offset+=50){
  const items=collection.requiredItems.slice(offset,offset+50);
  collectorGroups.push(all(items.map(item=>({type:'collected',id:item.id,itemName:item.name,label:`Collect ${item.name} (#${item.id})`})),`Items ${offset+1}–${offset+items.length}`));
}
data.nodes.push(
  goalNode('feature:dead-god-conditions','All 636 unlock requirements','Meet the requirements of all other Repentance secrets (1–636). Secret flags do not count as evidence: known prerequisites, marks and counters are used; other actions require manual confirmation.',all(conditions,'All unlock requirements'),{goal:{type:'secret_conditions',requiredCount:636}}),
  goalNode('feature:dead-god-collection','All 717 collection items','Collect all 717 visible Repentance collection items, including Death Certificate, Broken Glass Cannon and quest pieces. Hidden items and missing IDs are not required.',all(collectorGroups,'Full collection'),{goal:{type:'collection',requiredCount:717},sourceNote:'The list is pinned to Repentance 1.7.9b.J835 items.xml; Recall, Hold and the hidden Book of Belial and Damocles effects are excluded.'}),
  goalNode('feature:dead-god-challenges','All 45 challenges','Complete all 45 Repentance challenges, including Ultra Hard and DELETE THIS. Each challenge’s completed flag is checked individually.',all(Array.from({length:45},(_,i)=>ref(`challenge-complete:${i+1}`)),'All challenges'),{goal:{type:'challenges',requiredCount:45}}),
  goalNode('feature:dead-god','Dead God','Meet all 636 other unlock requirements and collect all 717 Repentance collection items. This includes 408 Hard / Greedier marks, 45 challenges, daily runs and other actions.',all([ref('collectible:628'),ref('feature:dead-god-challenges'),ref('feature:dead-god-conditions'),ref('feature:dead-god-collection')],'Everything for Dead God'),{rank:'DEAD GOD',order:0,secretId:637,goal:{type:'dead_god',gameVersion:collection.gameVersion}})
);
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
let manual=0,automatic=0,reused=0;
for(const range of conditions)for(const condition of range.conditions)if(condition.type==='manual')manual++;else if(condition.type==='node')reused++;else automatic++;
console.log({goal:'Dead God',conditions:636,collection:collection.requiredItems.length,reused,automatic,manual});
