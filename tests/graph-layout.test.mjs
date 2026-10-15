import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutGraph} from '../site/js/unlock-engine.js';
import {edgeGeometry,graphNeighborhood} from '../site/js/graph-view.js';

const node=(id,kind='collectible')=>({id,kind});
const edge=(from,to)=>({from,to});
const center=node=>node.x+node.width/2;

test('sibling subtrees occupy separate sides and their junction stays between them',()=>{
  const graph={nodes:['goal','right-2','left-1','right','left-2','left','right-1'].map(id=>node(id)).concat(node('join','gate')),
    edges:[edge('left-1','left'),edge('left-2','left'),edge('right-1','right'),edge('right-2','right'),edge('left','join'),edge('right','join'),edge('join','goal')]};
  const snapshot=structuredClone(graph),layout=layoutGraph(graph),map=new Map(layout.nodes.map(n=>[n.id,n]));
  const left=['left','left-1','left-2'].map(id=>map.get(id)),right=['right','right-1','right-2'].map(id=>map.get(id));
  assert.ok(Math.max(...left.map(n=>n.x+n.width))<Math.min(...right.map(n=>n.x)));
  assert.ok(center(map.get('join'))>center(map.get('left'))&&center(map.get('join'))<center(map.get('right')));
  assert.equal(map.get('join').height,28);assert.ok(map.get('join').width<map.get('goal').width);
  assert.deepEqual(graph,snapshot);assert.deepEqual(layoutGraph(graph),layout);
});

test('long dependencies reserve passages beside intervening cards and follow dragged endpoints',()=>{
  const graph={nodes:['a','b','c','d'].map(id=>node(id)),edges:[edge('a','b'),edge('b','c'),edge('c','d'),edge('a','d')]};
  const layout=layoutGraph(graph),map=new Map(layout.nodes.map(n=>[n.id,n])),long=layout.edges.find(e=>e.from==='a'&&e.to==='d');
  assert.ok(long.via.length>2);
  for(const point of long.via)for(const n of layout.nodes) {
    assert.ok(point.x<n.x||point.x>n.x+n.width||point.y<n.y||point.y>n.y+n.height,`passage intersects ${n.id}`);
  }
  const a=map.get('a'),d=map.get('d'),before=edgeGeometry(a,d,long.via),after=edgeGeometry({...a,x:a.x+40},d,long.via);
  assert.notEqual(before.path,after.path);assert.ok(after.path.endsWith(`${center(d)} ${d.y}`));
  for(const point of long.via)assert.ok(after.path.includes(`${point.x} ${point.y}`));
  // Sample the actual cubic curves, not just their guide points: bends must
  // remain outside every unrelated card, even on very long horizontal runs.
  for(const e of layout.edges) {
    const a=map.get(e.from),b=map.get(e.to),points=[{x:center(a),y:a.y+a.height},...e.via,{x:center(b),y:b.y}];
    for(let i=1;i<points.length;i++)for(let step=1;step<40;step++) {
      const t=step/40,u=1-t,from=points[i-1],to=points[i],middle=(from.y+to.y)/2;
      const x=(u*u*u+3*u*u*t)*from.x+(3*u*t*t+t*t*t)*to.x;
      const y=u*u*u*from.y+3*u*t*middle+t*t*t*to.y;
      for(const n of layout.nodes.filter(n=>n.id!==e.from&&n.id!==e.to))assert.ok(x<=n.x||x>=n.x+n.width||y<=n.y||y>=n.y+n.height,`${e.from} → ${e.to} clips ${n.id}`);
    }
  }
});

test('large fans stagger before their junction and preserve every shared dependency',()=>{
  const leaves=Array.from({length:40},(_,i)=>node(`leaf-${i}`));
  const graph={nodes:[node('goal'),node('join','gate'),...leaves],edges:[edge('join','goal'),...leaves.map(n=>edge(n.id,'join'))]};
  const layout=layoutGraph(graph),map=new Map(layout.nodes.map(n=>[n.id,n]));
  assert.equal(layout.nodes.length,graph.nodes.length);assert.equal(layout.edges.length,graph.edges.length);
  assert.ok(layout.width<4000,'large fans use several routed levels instead of one enormous row');
  assert.ok(new Set(leaves.map(n=>map.get(n.id).y)).size>1);
  for(const e of layout.edges)assert.ok(map.get(e.from).y+map.get(e.from).height<map.get(e.to).y);
});

test('independent components have separate lanes and cycles still fail explicitly',()=>{
  const layout=layoutGraph({nodes:['a','b','c','d'].map(id=>node(id)),edges:[edge('a','b'),edge('c','d')]}),map=new Map(layout.nodes.map(n=>[n.id,n]));
  assert.ok(map.get('a').x+map.get('a').width<map.get('c').x);
  assert.equal(map.get('a').x,map.get('b').x);assert.equal(map.get('c').x,map.get('d').x);
  assert.throws(()=>layoutGraph({nodes:[node('a'),node('b')],edges:[edge('a','b'),edge('b','a')]}),/Цикл/);
  assert.deepEqual(layoutGraph({nodes:[],edges:[]}),{nodes:[],edges:[],width:620,height:520});
});

test('selection highlights only incoming and outgoing neighbors and incident edges',()=>{
  const graph={nodes:['root','selected','sibling','join','goal','other-root'].map(id=>node(id)),
    edges:[edge('root','selected'),edge('root','sibling'),edge('selected','join'),edge('other-root','join'),edge('join','goal')]};
  const branch=graphNeighborhood(graph,'selected');
  assert.deepEqual([...branch.nodes].sort(),['join','root','selected']);
  assert.deepEqual([...branch.edges].sort(),[0,2]);
  assert.equal(graphNeighborhood(graph,'absent').nodes.size,0);
});
