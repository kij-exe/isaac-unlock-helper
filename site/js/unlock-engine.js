export const STATUS = {YES: 'satisfied', NO: 'missing', UNKNOWN: 'unknown'};
const LEAVES = new Set(['constant','node','counter','mark','challenge','manual','character_played','boss_defeated','collected']);
const safeUrl = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };

export function conditionReferences(condition) {
  if (!condition) return [];
  if (condition.type === 'node') return [condition.id];
  return (condition.conditions || []).flatMap(conditionReferences);
}

export function validateCatalog(data) {
  const errors = [], ids = new Set(), tiers = new Set();
  if (data?.schemaVersion !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.tiers)) return ['Неверная версия или структура каталога.'];
  for (const tier of data.tiers) {
    if (!tier.id || tiers.has(tier.id)) errors.push(`Дублирующаяся категория ${tier.id}`);
    tiers.add(tier.id);
  }
  for (const node of data.nodes) {
    if (!/^[a-z0-9][a-z0-9:._-]*$/.test(node.id) || ids.has(node.id)) errors.push(`Некорректный или повторяющийся ID: ${node.id}`);
    ids.add(node.id);
    if (!node.name || !node.kind || !node.unlock?.description) errors.push(`Неполная запись: ${node.id}`);
    if (node.tier && !tiers.has(node.tier)) errors.push(`Нет категории ${node.tier}: ${node.id}`);
    if (node.wikiUrl && !safeUrl(node.wikiUrl)) errors.push(`Небезопасная wiki URL: ${node.id}`);
    if (!Array.isArray(node.sources) || !node.sources.length || node.sources.some(url => !safeUrl(url))) errors.push(`Нет корректных источников: ${node.id}`);
    if (node.secretId != null && (!Number.isInteger(node.secretId) || node.secretId < 1 || node.secretId > 637)) errors.push(`Некорректный secretId: ${node.id}`);
    if (node.catalog && (!Number.isInteger(node.catalog.itemId) || node.catalog.itemId < 1 || !['active','passive','trinket','consumable'].includes(node.catalog.kind))) errors.push(`Некорректный игровой ID: ${node.id}`);
  }
  const validateCondition = (condition, owner, depth = 0) => {
    if (!condition || depth > 40) { errors.push(`Отсутствующее или слишком глубокое условие: ${owner}`); return; }
    if (['all','any'].includes(condition.type)) {
      if (!Array.isArray(condition.conditions) || !condition.conditions.length) errors.push(`Пустое ${condition.type}: ${owner}`);
      else condition.conditions.forEach(c => validateCondition(c, owner, depth + 1));
      return;
    }
    if (!LEAVES.has(condition.type)) errors.push(`Неизвестное условие ${condition.type}: ${owner}`);
    if (condition.type === 'node' && !ids.has(condition.id)) errors.push(`Нет зависимости ${condition.id}: ${owner}`);
    if (condition.type === 'counter' && (!Number.isInteger(condition.id) || condition.id < 0 || condition.id >= 496 || !Number.isFinite(condition.atLeast) || condition.atLeast < 1)) errors.push(`Некорректный счётчик: ${owner}`);
    if (condition.type === 'mark' && (!condition.character || !condition.target || ![1,2].includes(condition.minimum ?? 1))) errors.push(`Некорректная отметка: ${owner}`);
    if (condition.type === 'collected' && (!Number.isInteger(condition.id) || condition.id < 1 || condition.id > 732)) errors.push(`Некорректный предмет коллекции: ${owner}`);
    if (condition.type === 'challenge' && (!Number.isInteger(condition.id) || condition.id < 1 || condition.id > 45)) errors.push(`Некорректное испытание: ${owner}`);
    if (condition.type === 'manual' && (!condition.key || !condition.label)) errors.push(`Неполное ручное условие: ${owner}`);
    if (condition.type === 'constant' && typeof condition.value !== 'boolean') errors.push(`Некорректная константа: ${owner}`);
    if (condition.type === 'character_played' && !condition.character) errors.push(`Нет персонажа: ${owner}`);
    if (condition.type === 'boss_defeated' && !condition.boss) errors.push(`Нет босса: ${owner}`);
  };
  const map = new Map(data.nodes.map(n => [n.id, n]));
  for (const node of data.nodes) {
    validateCondition(node.unlock?.requirements, node.id);
    if (node.unlock?.evidence) {
      validateCondition(node.unlock.evidence, node.id);
      if (conditionReferences(node.unlock.evidence).length) errors.push(`Прямое доказательство не должно ссылаться на узлы: ${node.id}`);
    }
  }
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) { errors.push(`Цикл зависимостей: ${id}`); return; }
    if (visited.has(id) || !map.has(id)) return;
    visiting.add(id);
    conditionReferences(map.get(id).unlock?.requirements).forEach(visit);
    visiting.delete(id); visited.add(id);
  };
  data.nodes.forEach(node => visit(node.id));
  return [...new Set(errors)];
}

export function createEvaluator(data, save, progress, manual = {}, {inferCollectedUnlocks = false} = {}) {
  const nodes = new Map(data.nodes.map(n => [n.id, n]));
  const memo = new Map(), active = new Set();
  const yesNo = value => value == null ? STATUS.UNKNOWN : value ? STATUS.YES : STATUS.NO;
  const marks = new Map(progress.characters.map(c => [c.name, c.marks]));
  const bossCounters = {'Mom’s Heart / It Lives!':1, "Mom's Heart":1, 'Mom’s Heart':1,
    Isaac:11, Satan:13, '???':24, 'The Lamb':25, 'Mega Satan':26, Hush:158, Delirium:187, Mother:491, 'The Beast':492, 'Boss Rush':111};
  function evaluate(condition) {
    if (!condition) return STATUS.UNKNOWN;
    switch (condition.type) {
      case 'constant': return yesNo(condition.value);
      case 'all': {
        const results = condition.conditions.map(evaluate);
        return results.includes(STATUS.NO) ? STATUS.NO : results.includes(STATUS.UNKNOWN) ? STATUS.UNKNOWN : STATUS.YES;
      }
      case 'any': {
        const results = condition.conditions.map(evaluate);
        return results.includes(STATUS.YES) ? STATUS.YES : results.includes(STATUS.UNKNOWN) ? STATUS.UNKNOWN : STATUS.NO;
      }
      case 'node': return earned(condition.id);
      case 'counter': return yesNo(progress.counters[condition.id] == null ? null : progress.counters[condition.id] >= condition.atLeast);
      case 'mark': return yesNo(marks.get(condition.character)?.[condition.target] == null ? null : marks.get(condition.character)[condition.target].value >= (condition.minimum ?? 1));
      case 'collected': return yesNo(save.chunks.collection[condition.id] == null ? null : !!save.chunks.collection[condition.id]);
      case 'challenge': return yesNo(save.chunks.challenges[condition.id] == null ? null : !!save.chunks.challenges[condition.id]);
      case 'manual': return yesNo(manual[condition.key]);
      case 'character_played': return yesNo(marks.has(condition.character) ? Object.values(marks.get(condition.character)).some(mark => mark.value > 0) : null);
      case 'boss_defeated': {
        const counter = bossCounters[condition.boss];
        if (counter != null && progress.counters[counter] > 0) return STATUS.YES;
        const target = condition.boss === "Mom's Heart" ? 'Mom’s Heart / It Lives!' : condition.boss;
        if ([...marks.values()].some(character => character[target]?.value > 0)) return STATUS.YES;
        return counter != null ? STATUS.NO : STATUS.UNKNOWN;
      }
      default: return STATUS.UNKNOWN;
    }
  }
  function earned(id) {
    if (memo.has(id)) return memo.get(id);
    if (active.has(id) || !nodes.has(id)) return STATUS.UNKNOWN;
    if (inferCollectedUnlocks && collected(nodes.get(id)) === true) {
      memo.set(id, STATUS.YES);
      return STATUS.YES;
    }
    active.add(id);
    const unlock = nodes.get(id).unlock;
    const state = unlock.evidence && evaluate(unlock.evidence) === STATUS.YES ? STATUS.YES : evaluate(unlock.requirements);
    active.delete(id); memo.set(id, state);
    return state;
  }
  function collected(node) {
    if (!node || !['active','passive'].includes(node.catalog?.kind)) return null;
    const value = save.chunks.collection[node.catalog.itemId];
    return value == null ? null : !!value;
  }
  function availability(id, {inferSlotEvidence = false} = {}) {
    const node = nodes.get(id);
    if (!node) return {status: STATUS.UNKNOWN, source: 'unknown'};
    if (inferSlotEvidence) {
      if (collected(node) === true) return {status: STATUS.YES, source: 'collection'};
      if (node.secretId != null && earned(id) === STATUS.YES) return {status: STATUS.YES, source: 'slot_evidence'};
    }
    if (node.secretId != null) return {status: yesNo(save.chunks.achievements[node.secretId] == null ? null : !!save.chunks.achievements[node.secretId]), source:'save_secret'};
    if (node.unlock.requirements.type === 'constant') return {status:yesNo(node.unlock.requirements.value), source:'default'};
    if (earned(id) === STATUS.YES) return {status:STATUS.YES, source:'slot_condition'};
    return {status:STATUS.UNKNOWN, source:'unknown'};
  }
  return {evaluate, earned, availability, nodes, collected};
}

export function conditionLabel(condition) {
  if (!condition) return 'Нет данных';
  if (condition.label) return condition.label;
  switch (condition.type) {
    case 'all': return condition.conditions.filter(c => c.type !== 'node').map(conditionLabel).filter(Boolean).join(' + ') || 'Все зависимости';
    case 'any': return condition.conditions.map(conditionLabel).join(' или ');
    case 'node': return '';
    case 'mark': return `${condition.character}: ${condition.target}${condition.minimum === 2 ? ' на Hard / Greedier' : ''}`;
    case 'counter': return `Счётчик #${condition.id} ≥ ${condition.atLeast}`;
    case 'collected': return `Подобрать предмет #${condition.id}`;
    case 'challenge': return `Пройти испытание #${condition.id}`;
    case 'character_played': return `Отметка персонажа ${condition.character}`;
    case 'boss_defeated': return `Победить ${condition.boss}`;
    case 'constant': return condition.value ? 'Доступно изначально' : 'Не выполнено';
    default: return 'Проверить условие';
  }
}

// Shared content nodes have stable IDs. Satisfied prerequisites are removed together
// with their ancestry, rather than copied separately for each dependent reward.
export function buildGraph(data, evaluator, {targetId = null, mode = 'progress', showOpened = false} = {}) {
  const map = evaluator.nodes, graphNodes = new Map(), edges = new Map(), visited = new Set();
  const status = id => mode === 'availability' ? evaluator.availability(id).status : evaluator.earned(id);
  const conditionStatus = condition => {
    if (condition.type === 'node') return status(condition.id);
    if (['all','any'].includes(condition.type)) {
      const states=condition.conditions.map(conditionStatus);
      if (condition.type==='all') return states.includes(STATUS.NO)?STATUS.NO:states.includes(STATUS.UNKNOWN)?STATUS.UNKNOWN:STATUS.YES;
      return states.includes(STATUS.YES)?STATUS.YES:states.includes(STATUS.UNKNOWN)?STATUS.UNKNOWN:STATUS.NO;
    }
    return evaluator.evaluate(condition);
  };
  const edge = (from, to, label) => edges.set(`${from}>${to}`, {from, to, label});
  const conditionEndpoint = (condition, owner, path) => {
    // A satisfied OR group needs no other alternative, even while the target's
    // separate action remains undone. Use the selected graph basis consistently.
    if (!showOpened && conditionStatus(condition) === STATUS.YES) return null;
    if (condition.type === 'node') {
      if (!showOpened && status(condition.id) === STATUS.YES) return null;
      visit(condition.id, false); return condition.id;
    }
    if (!['all','any'].includes(condition.type)) return null;
    const endpoints = condition.conditions.map((child, index) => ({child, endpoint: conditionEndpoint(child, owner, `${path}.${index}`), index}));
    // A node-free alternative is a real route, not an extra mandatory dependency.
    if (condition.type === 'any' && endpoints.some(branch => branch.endpoint)) {
      for (const branch of endpoints) if (!branch.endpoint && !conditionReferences(branch.child).length) {
        if (!showOpened && conditionStatus(branch.child) === STATUS.YES) continue;
        branch.endpoint = `action:${owner.id}:${path}.${branch.index}`;
        graphNodes.set(branch.endpoint, {id:branch.endpoint, name:conditionLabel(branch.child), kind:'condition', ownerId:owner.id, status:evaluator.evaluate(branch.child)});
      }
    }
    const remaining = endpoints.filter(branch => branch.endpoint);
    if (!remaining.length) return null;
    if (remaining.length === 1) return remaining[0].endpoint;
    const id = `gate:${owner.id}:${path}`;
    graphNodes.set(id, {id, kind:'gate', operator:condition.type, name:condition.type === 'all' ? 'ВСЕ УСЛОВИЯ' : 'ЛЮБОЕ УСЛОВИЕ', ownerId:owner.id, status:conditionStatus(condition)});
    for (const branch of remaining) edge(branch.endpoint, id, conditionLabel(branch.child));
    return id;
  };
  function visit(id, force) {
    if (visited.has(id) || !map.has(id)) return;
    visited.add(id);
    const node = map.get(id), state = status(id);
    if (!force && !showOpened && state === STATUS.YES) return;
    graphNodes.set(id, {...node, status:state});
    if (!showOpened && state === STATUS.YES) return;
    const endpoint = conditionEndpoint(node.unlock.requirements, node, 'root');
    if (endpoint) edge(endpoint, id, conditionLabel(node.unlock.requirements) || node.unlock.description);
  }
  const roots = targetId ? [targetId] : data.nodes.filter(node => node.tier).map(node => node.id);
  roots.forEach(id => visit(id, !!targetId));
  return {nodes:[...graphNodes.values()], edges:[...edges.values()].filter(e => graphNodes.has(e.from) && graphNodes.has(e.to)), mode, targetId};
}

export function layoutGraph(graph) {
  const nodes = new Map(graph.nodes.map(node => [node.id, {...node, depth:0,
    width:node.kind==='gate'?88:220, height:node.kind==='gate'?28:78}]));
  const incoming = new Map(graph.nodes.map(n => [n.id, []])), outgoing = new Map(graph.nodes.map(n => [n.id, []]));
  for (const edge of graph.edges) { incoming.get(edge.to).push(edge.from); outgoing.get(edge.from).push(edge.to); }
  const indegree = new Map([...incoming].map(([id, parents]) => [id, parents.length]));
  const queue = [...nodes.keys()].filter(id => !indegree.get(id));
  for (let i=0; i<queue.length; i++) for (const child of outgoing.get(queue[i])) {
    nodes.get(child).depth=Math.max(nodes.get(child).depth,nodes.get(queue[i]).depth+1);
    indegree.set(child,indegree.get(child)-1);
    if (!indegree.get(child)) queue.push(child);
  }
  if (queue.length!==nodes.size) throw new Error('Цикл в графе разблокировок.');

  // Pack independent components in separate lanes. Within a component, place
  // prerequisites near their rewards instead of forcing every leaf into row 0.
  const components=[], seen=new Set();
  for (const id of nodes.keys()) {
    if (seen.has(id)) continue;
    const component=[id]; seen.add(id);
    for (let i=0; i<component.length; i++) for (const next of [...incoming.get(component[i]),...outgoing.get(component[i])]) {
      if (!seen.has(next)) { seen.add(next); component.push(next); }
    }
    components.push(component);
  }
  let left=48, height=520;
  const routes=new Map();
  for (const component of components) {
    const ids=new Set(component), order=queue.filter(id=>ids.has(id));
    const occupied=new Map();
    for (const id of order.toReversed()) {
      const children=outgoing.get(id);
      let depth=children.length?Math.min(...children.map(child=>nodes.get(child).depth))-1:0;
      // Schedule a large fan over several levels before routing it. Unlike row
      // wrapping, every long link reserves a passage through those levels.
      while((occupied.get(depth)||0)>=8)depth--;
      nodes.get(id).depth=depth;occupied.set(depth,(occupied.get(depth)||0)+1);
    }
    const minDepth=Math.min(...component.map(id=>nodes.get(id).depth));
    const vertices=component.map(id=>{
      const node=nodes.get(id); node.depth-=minDepth;
      return {node,depth:node.depth,width:node.width,parents:[],children:[],cx:0};
    });
    const byId=new Map(vertices.map(vertex=>[vertex.node.id,vertex]));
    // A long edge owns a narrow passage through each intervening layer. These
    // virtual vertices take part in ordering but never become catalog nodes.
    const passages=new Map();
    const link=(from,to)=>{
      if(!from.children.includes(to))from.children.push(to);
      if(!to.parents.includes(from))to.parents.push(from);
    };
    for (const edge of graph.edges.filter(edge=>ids.has(edge.from))) {
      const source=byId.get(edge.from), target=byId.get(edge.to), chain=[source];
      let previous=source;
      for (let depth=source.depth+1; depth<target.depth; depth++) {
        const key=`${edge.to}:${depth}`;
        if(!passages.has(key)) {
          const vertex={depth,width:16,parents:[],children:[],cx:0};
          passages.set(key,vertex);vertices.push(vertex);
        }
        const vertex=passages.get(key);chain.push(vertex);link(previous,vertex);previous=vertex;
      }
      link(previous,target);chain.push(target);routes.set(edge,chain);
    }
    const layers=Array.from({length:Math.max(...vertices.map(vertex=>vertex.depth))+1},()=>[]);
    // Start with depth-first branch order, so sibling prerequisites stay together.
    const visited=new Set();
    function branch(vertex) {
      if (visited.has(vertex)) return;
      visited.add(vertex);vertex.parents.forEach(branch);layers[vertex.depth].push(vertex);
    }
    vertices.filter(vertex=>!vertex.children.length).forEach(branch);
    const median=values=>{
      const sorted=values.toSorted((a,b)=>a-b), middle=Math.floor(sorted.length/2);
      return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
    };
    // Alternating median sweeps reduce crossings, including long-edge passages.
    for (let pass=0; pass<8; pass++) {
      const down=pass%2===0, ranks=down?layers:layers.toReversed();
      const positions=new Map(layers.flatMap(layer=>layer.map((vertex,index)=>[vertex,index])));
      for (const layer of ranks) {
        const scores=new Map(layer.map(vertex=>{
          const neighbors=down?vertex.parents:vertex.children;
          return [vertex,neighbors.length?median(neighbors.map(other=>positions.get(other))):positions.get(vertex)];
        }));
        layer.sort((a,b)=>scores.get(a)-scores.get(b));
        layer.forEach((vertex,index)=>positions.set(vertex,index));
      }
    }
    const gap=(a,b)=>a.node&&b.node?56:24;
    for (const layer of layers) {
      let cursor=0;
      layer.forEach((vertex,index)=>{if(index)cursor+=gap(layer[index-1],vertex);vertex.cx=cursor+vertex.width/2;cursor+=vertex.width;});
    }
    // Compact each layer toward its neighbors without changing branch order or
    // allowing overlaps. Pool adjacent conflicting blocks to keep fans centered.
    for (let pass=0; pass<12; pass++) {
      const down=pass%2===0;
      for (const layer of down?layers:layers.toReversed()) {
        let offset=0;const blocks=[], offsets=[];
        layer.forEach((vertex,index)=>{
          if(index)offset+=(layer[index-1].width+vertex.width)/2+gap(layer[index-1],vertex);
          offsets.push(offset);
          const neighbors=down?vertex.parents:vertex.children;
          const desired=neighbors.length?median(neighbors.map(other=>other.cx)):vertex.cx;
          blocks.push({start:index,end:index,sum:desired-offset,count:1});
          while(blocks.length>1) {
            const b=blocks.at(-1),a=blocks.at(-2);
            if(a.sum/a.count<=b.sum/b.count)break;
            blocks.splice(-2,2,{start:a.start,end:b.end,sum:a.sum+b.sum,count:a.count+b.count});
          }
        });
        for (const block of blocks) for(let index=block.start;index<=block.end;index++)layer[index].cx=block.sum/block.count+offsets[index];
      }
    }
    const minX=Math.min(...vertices.map(vertex=>vertex.cx-vertex.width/2));
    const maxX=Math.max(...vertices.map(vertex=>vertex.cx+vertex.width/2));
    let top=48;
    for (const layer of layers) {
      const layerHeight=Math.max(...layer.map(vertex=>vertex.node?.height||0));
      for (const vertex of layer) {
        vertex.cx+=left-minX;vertex.y=top+layerHeight/2;vertex.top=top;vertex.bottom=top+layerHeight;
        if(vertex.node)Object.assign(vertex.node,{x:vertex.cx-vertex.width/2,y:vertex.y-vertex.node.height/2});
      }
      top+=layerHeight+76;
    }
    height=Math.max(height,top-76+48);left+=maxX-minX+120;
  }
  const width=Math.max(620,left-120+48);
  const edges=graph.edges.map(edge=>{
    const chain=routes.get(edge),source=chain[0],target=chain.at(-1);
    // Turn only in the gaps between layers, and run vertically through the
    // reserved passages. Curving at a passage's center could clip nearby cards.
    const via=[{x:source.cx,y:source.bottom+12},...chain.slice(1,-1).flatMap(vertex=>[
      {x:vertex.cx,y:vertex.top-12},{x:vertex.cx,y:vertex.bottom+12}]),{x:target.cx,y:target.top-12}];
    return {...edge,via};
  });
  return {nodes:[...nodes.values()],edges,width,height};
}
