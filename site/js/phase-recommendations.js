import {STATUS} from './unlock-engine.js';

export const PHASE_ITEM_RANKS=['S','A','B','C','D','F'];
const rankOrder=new Map(PHASE_ITEM_RANKS.map((rank,index)=>[rank,index]));
const itemKinds=new Set(['collectible','trinket','card','rune','pill']);
export const isPhaseUnlockItem=node=>!!node.catalog&&itemKinds.has(node.kind)&&!(node.unlock.requirements.type==='constant'&&node.unlock.requirements.value===true);
const collectionConditions=condition=>condition.type==='collected'?[condition.id]:(condition.conditions||[]).flatMap(collectionConditions);

export function validatePhaseRecommendations(profile,catalog,phaseIds){
  const errors=[],nodes=new Map(catalog.nodes.map(node=>[node.id,node]));
  if(profile?.schemaVersion!==1||!profile.phases||typeof profile.phases!=='object')return ['Invalid phase recommendation profile.'];
  if(profile.coverage!=='all-unlockable-items')errors.push('Phase recommendations must cover all unlockable items.');
  if(!Array.isArray(profile.sources)||!profile.sources.length||profile.sources.some(source=>{try{return new URL(source).protocol!=='https:';}catch{return true;}}))errors.push('Missing phase recommendation sources.');
  for(const id of phaseIds)if(!profile.phases[id])errors.push(`Missing phase recommendations: ${id}`);
  for(const [id,phase] of Object.entries(profile.phases)){
    if(!phaseIds.includes(id))errors.push(`Unknown recommendation phase: ${id}`);
    if(!phase.description||/[\u0400-\u04ff]/.test(phase.description)||!['unlocks','collection'].includes(phase.mode)||!Array.isArray(phase.entries)||!phase.entries.length){errors.push(`Invalid phase recommendation group: ${id}`);continue;}
    if((id==='dead-god')!==(phase.mode==='collection'))errors.push(`Invalid collection recommendation phase: ${id}`);
    const ids=new Set(),positions=new Set();
    for(const item of phase.entries){
      if(!item||typeof item!=='object'){errors.push(`Invalid recommended item: ${id}`);continue;}
      const node=nodes.get(item.nodeId),position=`${item.rank}:${item.order}`;
      if(!node||!itemKinds.has(node.kind)||!node.catalog)errors.push(`Unknown recommended item: ${id} / ${item.nodeId}`);
      if(node&&phase.mode==='unlocks'&&!isPhaseUnlockItem(node))errors.push(`Default item in unlock recommendations: ${id} / ${item.nodeId}`);
      if(phase.mode==='collection'&&node?.kind!=='collectible')errors.push(`Non-collectible in collection priorities: ${item.nodeId}`);
      if(!rankOrder.has(item.rank)||!Number.isInteger(item.order)||item.order<0||positions.has(position))errors.push(`Invalid phase item placement: ${id} / ${item.nodeId}`);
      if(ids.has(item.nodeId))errors.push(`Duplicate phase recommendation: ${id} / ${item.nodeId}`);
      ids.add(item.nodeId);positions.add(position);
    }
  }
  const covered=new Set(Object.values(profile.phases).filter(phase=>phase?.mode==='unlocks').flatMap(phase=>(phase.entries||[]).map(item=>item?.nodeId)));
  for(const node of catalog.nodes.filter(isPhaseUnlockItem))if(!covered.has(node.id))errors.push(`Missing phase item: ${node.id}`);
  const required=new Set(collectionConditions(nodes.get('feature:dead-god-collection')?.unlock.requirements||{}).map(id=>`collectible:${id}`));
  const collection=new Set((profile.phases['dead-god']?.entries||[]).map(item=>item?.nodeId));
  for(const id of required)if(!collection.has(id))errors.push(`Missing phase collection item: ${id}`);
  for(const id of collection)if(!required.has(id))errors.push(`Unexpected phase collection item: ${id}`);
  return errors;
}

export function recommendationsForPhase(profile,id,evaluator,automatic,collectionIds=[]){
  const phase=profile?.phases[id];
  if(!phase)return {description:'',mode:'unlocks',items:[],done:0,total:0,remaining:0};
  let placements=phase.entries;
  if(phase.mode==='collection'){
    const priorities=new Map(placements.map(item=>[item.nodeId,item]));
    // Include the entire authoritative collection. The view's obtained filter
    // can hide pickups without changing the checklist or its local priorities.
    placements=collectionIds.map((itemId,index)=>priorities.get(`collectible:${itemId}`)||{nodeId:`collectible:${itemId}`,rank:'C',order:phase.entries.length+index});
  }
  const ordered=[...placements].sort((a,b)=>rankOrder.get(a.rank)-rankOrder.get(b.rank)||a.order-b.order||a.nodeId.localeCompare(b.nodeId));
  const items=ordered.flatMap(placement=>{
    const node=evaluator.nodes.get(placement.nodeId);
    if(!node)return [];
    const earned=evaluator.earned(node.id),collected=evaluator.collected(node),auto=automatic.earned(node.id);
    return [{...placement,name:node.name,kind:node.kind,description:node.unlock.description,
      earned,collected,manual:earned===STATUS.YES&&auto!==STATUS.YES,
      obtained:phase.mode==='collection'?collected===true:collected===true||earned===STATUS.YES}];
  });
  const total=phase.mode==='collection'?collectionIds.length:items.length;
  const done=items.filter(item=>item.obtained).length;
  return {description:phase.description,mode:phase.mode,items,done,total,remaining:total-done};
}
