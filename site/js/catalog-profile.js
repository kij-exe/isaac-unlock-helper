// Edition-specific goal requirements; no achievement flag is ever a condition.
export function catalogForSave(base,save){
  if(save.profile?.id!=='repentance-plus')return base;
  const data=structuredClone(base),conditions=data.nodes.find(node=>node.id==='feature:dead-god-conditions'),goal=data.nodes.find(node=>node.id==='feature:dead-god');
  if(!conditions||!goal)return data;
  const actions=[
    [638,'Play Online','Сыграть онлайн-забег.'],
    [639,'Win Online','Выиграть онлайн-забег.'],
    [640,'Win Online Daily','Выиграть ежедневный забег онлайн.'],
    [641,'Item Descriptions','Победить Mom в версии с функцией описаний предметов (Repentance+).'],
  ];
  conditions.unlock.requirements.conditions.push({type:'all',label:'Repentance+ · ещё четыре условия',conditions:actions.map(([id,name,label])=>({type:'manual',key:`dead-god:condition:${id}`,goalSecretId:id,label:`#${id} · ${name}: ${label}`,reason:'Отдельный флаг секрета не доказывает выполнение этого действия в слоте. Здесь требуется ручная проверка.'}))});
  conditions.name='Все 640 условий открытия';conditions.goal.requiredCount=640;
  conditions.unlock.description='Все остальные условия Repentance+ (1–636 и638–641). Секрет637 — сама цель. Четыре дополнительных действия проверяются вручную, без зачёта флагов секретов.';
  goal.goal.gameVersion='Repentance+';goal.unlock.description=goal.unlock.description.replaceAll('636','640').replaceAll('Repentance.','Repentance+.');
  return data;
}
