// One-off migration: replace the guide's categories (`tier`) with the stored
// tier-list row (`rank`). Ranks are derived exactly as the old interface did it:
// node.rank, then the editorial table, then the category table, then C.
// Afterwards `order` is renumbered 0..n-1 inside each rank in the old visual order.
import fs from 'node:fs';
const file=process.argv[2]||'site/data/unlocks.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
if(!Array.isArray(data.tiers)){console.error(`${file} has no tiers: already migrated.`);process.exit(1);}

const rankIds=['DEAD GOD','S','A','B','C','D','F','OPEN'];
const categoryRanks={'good-1':'S','good-2':'A','good-3':'A','good-4':'B','before-1':'B','before-2':'C','avoid-1':'D','avoid-2':'F','avoid-3':'F','default-open':'OPEN'};
const editorialRanks={'consumable:33':'S','consumable:37':'S','consumable:39':'A','collectible:263':'A','collectible:389':'B','consumable:36':'B','consumable:35':'B','consumable:40':'C','consumable:34':'C',
  'collectible:105':'S','collectible:619':'S','collectible:678':'S','collectible:698':'S','collectible:689':'S','collectible:723':'S',
  'collectible:562':'A','collectible:716':'A','collectible:643':'A','collectible:232':'A','collectible:700':'A',
  'collectible:283':'B','collectible:470':'C','collectible:475':'C','consumable:38':'C'};
const legacyRank=node=>node.tier==='dead-god'?'DEAD GOD':rankIds.includes(node.rank)?node.rank:editorialRanks[node.id]||categoryRanks[node.tier]||'C';

const byRank=new Map(rankIds.map(id=>[id,[]]));
for(const node of data.nodes){
  if(!node.tier){delete node.rank;continue;}
  const rank=legacyRank(node);
  delete node.tier;delete node.rank;node.rank=rank;
  byRank.get(rank).push(node);
}
// Array.prototype.sort is stable, so equal guide positions keep file order, as before.
for(const nodes of byRank.values())nodes.sort((a,b)=>(a.order??0)-(b.order??0)).forEach((node,index)=>{node.order=index;});
delete data.tiers;
delete data.source.withdrawnAvoid;
data.source.scope='Initial S–F ranks were derived from the categories and order of this Repentance+ guide; from then on ranks are stored and edited independently of it. The site reads only Repentance ISAACNGSAVE09R (638 secret slots / 496 counters), not Repentance+ with its extended chunks. Check version-dependent requirements on the wiki.';
data.source.note='Initial priorities are the guide author’s opinion. Secrets are shown separately and do not confirm game progress in this slot.';

fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log(Object.fromEntries([...byRank].map(([id,nodes])=>[id,nodes.length])));
