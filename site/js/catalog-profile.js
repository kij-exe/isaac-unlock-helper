// Edition-specific goal requirements; no achievement flag is ever a condition.
export function catalogForSave(base,save){
  if(save.profile?.id!=='repentance-plus')return base;
  const data=structuredClone(base),conditions=data.nodes.find(node=>node.id==='feature:dead-god-conditions'),goal=data.nodes.find(node=>node.id==='feature:dead-god');
  if(!conditions||!goal)return data;
  const actions=[
    [638,'Play Online','Play an online run.'],
    [639,'Win Online','Win an online run.'],
    [640,'Win Online Daily','Win an online daily run.'],
    [641,'Item Descriptions','Defeat Mom in the edition with item descriptions (Repentance+).'],
  ];
  conditions.unlock.requirements.conditions.push({type:'all',label:'Repentance+ · four additional requirements',conditions:actions.map(([id,name,label])=>({type:'manual',key:`dead-god:condition:${id}`,goalSecretId:id,label:`#${id} · ${name}: ${label}`,reason:'A secret flag alone does not prove this action was performed in the slot. Manual verification is required here.'}))});
  conditions.name='All 640 unlock requirements';conditions.goal.requiredCount=640;
  conditions.unlock.description='All other Repentance+ requirements (1–636 and 638–641). Secret 637 is the goal itself. The four additional actions require manual verification; secret flags do not count.';
  goal.goal.gameVersion='Repentance+';goal.unlock.description=goal.unlock.description.replaceAll('636','640').replaceAll('Repentance collection','Repentance+ collection');
  return data;
}
