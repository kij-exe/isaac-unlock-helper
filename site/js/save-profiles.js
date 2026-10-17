// Exact layouts verified against the local research samples; names never select a profile.
export const SAVE_PROFILES = [
  {id:'rebirth',label:'Rebirth',header:'ISAACNGSAVE06R  ',counts:[179,95,12,347,7,57,21,21,1],characters:11,marksPerCharacter:6,challenges:20,planner:false},
  {id:'repentance',label:'Repentance',header:'ISAACNGSAVE09R  ',counts:[638,496,14,733,7,104,46,27,2,80,4],characters:34,marksPerCharacter:12,challenges:45,planner:true},
  {id:'repentance-plus',label:'Repentance+',header:'ISAACNGSAVE09R  ',counts:[642,523,14,733,7,104,46,27,2,80,4],characters:34,marksPerCharacter:12,challenges:45,planner:true},
];
export function matchingProfile(header,layout) {
  return SAVE_PROFILES.find(profile=>profile.header===header&&profile.counts.every((count,index)=>layout[index]?.count===count)&&layout.length===profile.counts.length);
}
export function decodeCompletion(raw,edition) {
  if(!Number.isInteger(raw)||raw<0)throw new Error('Invalid completion mark.');
  if(edition==='repentance-plus') {
    if(raw>15)throw new Error(`Unknown Repentance+ completion mark bits: ${raw}.`);
    const offline=raw&2?2:raw&1?1:0,online=raw&8?2:raw&4?1:0;
    return {value:Math.max(offline,online),rawValue:raw,offline,online};
  }
  if(raw>2)throw new Error(`Unknown completion mark state: ${raw}.`);
  return {value:raw};
}
