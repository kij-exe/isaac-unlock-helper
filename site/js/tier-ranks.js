// Presentation only: the guide's original categories remain in unlocks.json.
export const RANKS = [
  {id:'S',label:'Открыть в первую очередь',color:'#f39eaa'},
  {id:'A',label:'Высокий приоритет',color:'#eec18a'},
  {id:'B',label:'Полезное пополнение',color:'#e5d988'},
  {id:'C',label:'После основных анлоков',color:'#a8cfb1'},
  {id:'D',label:'Низкий приоритет',color:'#9cbfda'},
  {id:'F',label:'Можно отложить',color:'#b9a5d5'},
];
const categoryRanks = {'good-1':'S','good-2':'A','good-3':'A','good-4':'B','before-1':'B','before-2':'C','avoid-1':'D','avoid-2':'F','avoid-3':'F'};
const editorialRanks = {'consumable:33':'S','consumable:37':'S','consumable:39':'A','collectible:263':'A','collectible:389':'B','consumable:36':'B','consumable:35':'B','consumable:40':'C','consumable:34':'C',
  'collectible:105':'S','collectible:619':'S','collectible:678':'S','collectible:698':'S','collectible:689':'S','collectible:723':'S',
  'collectible:562':'A','collectible:716':'A','collectible:643':'A','collectible:232':'A','collectible:700':'A',
  // These recommendations were withdrawn in the source's later notes.
  'collectible:283':'B','collectible:470':'C','collectible:475':'C','consumable:38':'C'};
export function rankFor(node) {
  if (!node.tier) return null;
  if (RANKS.some(rank=>rank.id===node.rank)) return node.rank;
  return editorialRanks[node.id] || categoryRanks[node.tier] || 'C';
}
