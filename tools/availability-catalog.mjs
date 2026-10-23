// Apply reviewed availability facts without using secret flags as slot evidence.
const ref=id=>({type:'node',id});
const counter=(id,atLeast,label)=>({type:'counter',id,atLeast,label});
const manual=(key,label)=>({type:'manual',key,label,reason:'The save does not store a verified history of this action.'});

export function applyAvailabilityMappings(input,profile){
  const data=structuredClone(input),nodes=new Map(data.nodes.map(node=>[node.id,node]));
  if(profile.schemaVersion!==1)throw new Error('Unsupported availability profile.');
  const corrections={
    'collectible:207':{description:'Defeat Mom to unlock the Harbinger item rewards.',requirements:ref('collectible:73')},
    'collectible:414':{description:'Donate 50 coins to the Donation Machine.',requirements:ref('collectible:249')},
    'trinket:120':{description:'Collect 20 batteries.',requirements:counter(195,20,'Collect 20 batteries')},
    'trinket:121':{description:'Sleep in a bed.',requirements:counter(202,1,'Sleep in a bed')},
    'trinket:122':{description:'Complete two Victory Laps by defeating The Lamb.',requirements:manual('trinket:122:unlock','Complete two Victory Laps by defeating The Lamb')},
    'trinket:123':{description:'Collect both Key Pieces from the angels in one run.',requirements:ref('collectible:175')},
    'trinket:125':{description:'Collect The Battery, 9 Volt and Car Battery in this slot.',requirements:{type:'all',conditions:[63,116,356].map(id=>({type:'collected',id}))}},
    'trinket:152':{description:'Unlock the Planetarium by collecting three different items with the stars tag in one run.',requirements:ref('feature:planetarium')},
    'consumable:53':{description:'Use cards and runes 20 times.',requirements:counter(196,20,'Use cards and runes 20 times')},
    'consumable:78':{description:'Open Mom’s Chest in Home to unlock Red Key and Cracked Key.',requirements:ref('collectible:580')},
  };
  for(const [id,entry] of Object.entries(profile.entries)){
    const node=nodes.get(id);
    if(!node)throw new Error(`Missing availability node: ${id}`);
    const ungated=profile.ungatedCorrections?.[id];
    if(ungated){
      if(node.secretId!=null&&node.secretId!==ungated.previousSecretId)throw new Error(`Unexpected previous item gate: ${id}`);
      delete node.secretId;
      node.unlock={description:'Available from the start; there is no separate unlock requirement.',requirements:{type:'constant',value:true},
        ...(node.unlock.evidence?.type==='collected'?{evidence:node.unlock.evidence}:{})};
      node.sourceNote='This item has no separate unlock gate. Its acquisition method is distinct from content availability.';
      node.sources=[...new Set([...node.sources,...ungated.sources])];
    }
    const gate=entry.secretId??profile.retainedGates?.[id]?.secretId;
    if(gate!=null){
      if(node.secretId!=null&&node.secretId!==gate)throw new Error(`Conflicting availability gate: ${id}`);
      node.secretId=gate;
    }else if(node.secretId!=null)throw new Error(`Unreviewed availability gate: ${id}`);
    if(node.catalog&&entry.kind)node.catalog.kind=entry.kind;
    if(corrections[id]){
      const evidence=node.unlock.evidence?.type==='collected'?node.unlock.evidence:undefined;
      node.unlock={...corrections[id],...(evidence?{evidence}:{})};
      const source=profile.sources.find(source=>source.url.endsWith('/'+entry.source));
      node.sources=[...new Set([...node.sources,source.url])];
    }
  }
  // This is a state of Glass Cannon, with no independent secret. Obtaining the
  // broken state and having access to the item are separate questions.
  nodes.get('collectible:474').availability=ref('collectible:352');
  data.availabilityProfile={gameVersion:profile.gameVersion,sources:profile.sources};
  return data;
}
