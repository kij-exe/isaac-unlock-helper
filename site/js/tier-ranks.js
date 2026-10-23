// Tier-list rows. Each tier-list entry in unlocks.json stores its row in `rank`
// and its position inside that row in `order`; nodes without `rank` are graph-only.
export const RANKS = [
  {id:'DEAD GOD',label:'Complete Repentance',color:'#c7b48a'},
  {id:'S',label:'Unlock first',color:'#f39eaa'},
  {id:'A',label:'High priority',color:'#eec18a'},
  {id:'B',label:'Useful additions',color:'#e5d988'},
  {id:'C',label:'After the main unlocks',color:'#a8cfb1'},
  {id:'D',label:'Low priority',color:'#9cbfda'},
  {id:'F',label:'Can wait',color:'#b9a5d5'},
  {id:'OPEN',label:'Other catalog items',color:'#9aa6a0'},
];
export const RANK_IDS = new Set(RANKS.map(rank=>rank.id));
// The completion goal stays alone above S; it cannot be dragged and nothing can be dropped there.
export const LOCKED_RANK = 'DEAD GOD';

export const rankFor = node => RANK_IDS.has(node.rank) ? node.rank : null;
export const rankEntries = (nodes, rank) => nodes.filter(node=>node.rank===rank).toSorted((a,b)=>(a.order??0)-(b.order??0));

// Moves one entry into `rank` before `beforeId` (or to the end) and renumbers the
// affected rows 0..n-1. Applies the same placement to every catalog copy given.
export function moveEntry(catalogs, id, rank, beforeId=null) {
  const [primary,...copies]=catalogs, node=primary.nodes.find(entry=>entry.id===id);
  if (!node || !RANK_IDS.has(rank) || rank===LOCKED_RANK || node.rank===LOCKED_RANK || id===beforeId) return false;
  const from=node.rank, row=rankEntries(primary.nodes,rank).filter(entry=>entry.id!==id);
  const index=beforeId==null?-1:row.findIndex(entry=>entry.id===beforeId);
  row.splice(index<0?row.length:index,0,node);
  node.rank=rank;
  const placements=new Map(row.map((entry,order)=>[entry.id,{rank,order}]));
  if (from!==rank) rankEntries(primary.nodes,from).forEach((entry,order)=>placements.set(entry.id,{rank:from,order}));
  for (const catalog of new Set(catalogs)) for (const entry of catalog.nodes) {
    const placement=placements.get(entry.id);
    if (placement) Object.assign(entry,placement);
  }
  return true;
}

// Per-browser tier layout: {id: [rank, order]} for every ranked entry.
export const layoutOf = catalog => Object.fromEntries(catalog.nodes.filter(node=>RANK_IDS.has(node.rank)).map(node=>[node.id,[node.rank,node.order]]));
export function applyLayout(catalog, layout) {
  if (!layout || typeof layout!=='object') return 0;
  let changed=0;
  for (const node of catalog.nodes) {
    const placement=layout[node.id];
    if (!RANK_IDS.has(node.rank) || node.rank===LOCKED_RANK || !Array.isArray(placement)) continue;
    const [rank,order]=placement;
    if (!RANK_IDS.has(rank) || rank===LOCKED_RANK || !Number.isFinite(order)) continue;
    if (node.rank!==rank || node.order!==order) changed++;
    node.rank=rank; node.order=order;
  }
  return changed;
}
