import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateCatalog} from '../site/js/unlock-engine.js';
import {PHASES,BRANCHES} from '../site/js/progression.js';
import {validatePhaseRecommendations} from '../site/js/phase-recommendations.js';
import {applyAvailabilityMappings} from './availability-catalog.mjs';
import {isDeepStrictEqual} from 'node:util';
const file=process.argv[2]||'site/data/unlocks.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const errors=validateCatalog(data);
try{
  const profile=JSON.parse(fs.readFileSync('data/unlock-availability-repentance.json','utf8'));
  if(!isDeepStrictEqual(applyAvailabilityMappings(data,profile),data))errors.push('Availability mappings differ from the pinned game profile. Run node tools/build-dead-god.mjs.');
}catch(error){errors.push(error.message);}
const phaseRecommendations=JSON.parse(fs.readFileSync('site/data/phase-recommendations.json','utf8'));
errors.push(...validatePhaseRecommendations(phaseRecommendations,data,[...PHASES,...BRANCHES].map(phase=>phase.id)));
// Mark and character conditions must name a character exactly as the save parser reports it.
const characters=new Set(JSON.parse(fs.readFileSync('site/data/game-catalog.json','utf8')).characters.map(character=>character.name));
const checkCharacters=(condition,owner)=>{
  if(!condition)return;
  if(['mark','character_played'].includes(condition.type)&&!characters.has(condition.character))errors.push(`Unknown character "${condition.character}": ${owner}`);
  (condition.conditions||[]).forEach(child=>checkCharacters(child,owner));
};
for(const node of data.nodes){checkCharacters(node.unlock.requirements,node.id);checkCharacters(node.unlock.evidence,node.id);}
const manifest=JSON.parse(fs.readFileSync('site/assets/icons/manifest.json','utf8'));
const icons=new Map();
for(const entry of manifest.icons){
  if(icons.has(entry.nodeId))errors.push(`Duplicate icon: ${entry.nodeId}`);
  icons.set(entry.nodeId,entry);
}
for(const node of data.nodes){
  const entry=icons.get(node.id);
  if(!entry||!['downloaded','designed'].includes(entry.status)||!entry.path)errors.push(`Missing local icon: ${node.id}`);
  if(node.icon&&!fs.existsSync(path.join('site',node.icon)))errors.push(`Missing icon file ${node.icon}`);
}
const root=path.resolve('site/assets/icons');
let png=0,svg=0;
for(const entry of icons.values()){
  if(!['downloaded','designed'].includes(entry.status))continue;
  if(!entry.path?.startsWith('assets/icons/')||!path.resolve('site',entry.path).startsWith(root+path.sep)){
    errors.push(`Invalid icon path: ${entry.nodeId}`);continue;
  }
  const filename=path.resolve('site',entry.path);
  if(!fs.existsSync(filename)){errors.push(`Missing file ${entry.path}`);continue;}
  const bytes=fs.readFileSync(filename);
  if(entry.status==='downloaded'){
    if(path.extname(filename)!=='.png'||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')errors.push(`Invalid PNG: ${entry.path}`);
    png++;
  }else{
    if(path.extname(filename)!=='.svg'||!bytes.toString().includes('<svg xmlns="http://www.w3.org/2000/svg"'))errors.push(`Invalid SVG: ${entry.path}`);
    svg++;
  }
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)errors.push(`Icon checksum mismatch: ${entry.path}`);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Catalog OK: ${data.nodes.length} nodes, ${data.nodes.filter(n=>n.rank).length} ranked entries, ${png+svg} local icons (${png} PNG, ${svg} SVG).`);
