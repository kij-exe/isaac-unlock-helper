// Compile the pinned game challenge definitions into shared access/completion paths.
// requiredUnlockIds describe game rules only; no player secret flag is evaluated.
const ref=id=>({type:'node',id});
const all=conditions=>({type:'all',conditions});
const mark=(character,target)=>({type:'mark',character,target,minimum:1});
const counter=(id,atLeast,label)=>({type:'counter',id,atLeast,label});
const manual=(key,label)=>({type:'manual',key,label,reason:'The save does not store a verified history of this action.'});

export function linkChallengeCompletions(condition){
  if(!condition)return condition;
  if(condition.type==='challenge'){
    const {type,id,...metadata}=condition;
    return {...metadata,type:'node',id:`challenge-complete:${id}`};
  }
  if(!condition.conditions)return condition;
  let children=condition.conditions.map(linkChallengeCompletions);
  if(condition.type==='all'){
    // Completion already depends on access. Avoid parallel access → reward edges.
    const completed=new Set(children.filter(child=>child.type==='node'&&child.id.startsWith('challenge-complete:')).map(child=>child.id.split(':')[1]));
    children=children.filter(child=>!(child.type==='node'&&child.id.startsWith('challenge:')&&completed.has(child.id.split(':')[1])));
  }
  return {...condition,conditions:children};
}

export function addChallengePaths(input,reference,profile){
  const data=structuredClone(input),nodes=new Map(data.nodes.map(node=>[node.id,node]));
  const put=node=>{
    const existing=nodes.get(node.id);
    if(existing)Object.assign(existing,node);else {data.nodes.push(node);nodes.set(node.id,node);}
    return nodes.get(node.id);
  };
  const source=profile.source.url;
  const wiki=name=>`https://bindingofisaacrebirth.wiki.gg/wiki/${encodeURIComponent(name.replaceAll(' ','_'))}`;
  const prerequisites=[
    [11,counter(1,9,'Defeat Mom’s Heart / It Lives! 9 times')],
    [15,manual('defeat-lokii','Defeat Lokii')],
    [21,all([ref('character:cain'),ref('feature:cathedral'),mark('Cain','Isaac')]),mark('Cain','Isaac')],
    [28,counter(3,10,'Destroy 10 Tinted Rocks')],
    [58,manual('both-key-pieces','Collect both Key Pieces from angels in one run')],
    [65,manual('guppy-transform','Transform into Guppy in one run')],
    [71,all([ref('character:magdalene'),ref('feature:dark-room'),mark('Magdalene','The Lamb')]),mark('Magdalene','The Lamb')],
    [415,all([ref('feature:home'),manual('open-moms-chest-home','Open Mom’s Chest in Home')])],
    [418,all([ref('character:bethany'),ref('feature:sheol'),mark('Bethany','Satan')]),mark('Bethany','Satan')],
  ];
  for(const [secretId,requirements,evidence] of prerequisites){
    if(data.nodes.some(node=>node.secretId===secretId))continue;
    const item=reference.items.find(item=>item.achievement_id===secretId);
    if(!item)throw new Error(`Missing challenge prerequisite definition ${secretId}`);
    const kind=item.kind==='trinket'?'trinket':'collectible',id=`${kind}:${item.item_id}`;
    put({id,kind,name:item.name,secretId,catalog:{kind:item.kind,itemId:item.item_id},wikiUrl:wiki(item.name),
      unlock:{description:reference.achievements[secretId].condition,requirements,...(evidence?{evidence}:{})},
      sources:[source,wiki(item.name),...reference.sources.filter(row=>row.url.includes('deadgod.yeeterie.org')).map(row=>row.url)]});
  }
  const byUnlock=new Map(data.nodes.filter(node=>node.secretId).map(node=>[node.secretId,node]));
  for(const entry of profile.challenges){
    const id=`challenge:${entry.id}`,old=nodes.get(id),name=`#${entry.id} ${entry.name}`;
    const dependencies=entry.requiredUnlockIds.map(unlockId=>{
      const prerequisite=byUnlock.get(unlockId);
      if(!prerequisite)throw new Error(`Missing unlock ${unlockId} for challenge ${entry.id}`);
      return ref(prerequisite.id);
    });
    const access=dependencies.length===0?{type:'constant',value:true}:dependencies.length===1?dependencies[0]:all(dependencies);
    const completed={type:'challenge',id:entry.id,label:`Complete challenge #${entry.id}: ${entry.name}`};
    const wikiUrl=old?.wikiUrl||wiki(entry.name);
    put({...old,id,kind:'challenge',name,wikiUrl,challenge:{id:entry.id,role:'access'},
      unlock:{description:`Unlock challenge #${entry.id}: ${entry.name}.`,requirements:access,evidence:completed},
      sources:[...new Set([...(old?.sources||[]),source,wikiUrl])]});
    put({id:`challenge-complete:${entry.id}`,kind:'challenge',name:`Complete challenge #${entry.id}: ${entry.name}`,wikiUrl,
      challenge:{id:entry.id,role:'completion'},
      unlock:{description:`Complete challenge #${entry.id}: ${entry.name} and collect its trophy.`,
        requirements:all([ref(id),completed]),evidence:completed},sources:[source,wikiUrl]});
  }
  // Only requirements are linked. Direct evidence always remains a raw slot fact.
  for(const node of data.nodes)if(node.challenge?.role!=='completion')node.unlock.requirements=linkChallengeCompletions(node.unlock.requirements);
  return data;
}
