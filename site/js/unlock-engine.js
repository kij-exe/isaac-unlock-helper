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

export function createEvaluator(data, save, progress, manual = {}) {
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
    active.add(id);
    const unlock = nodes.get(id).unlock;
    const state = unlock.evidence && evaluate(unlock.evidence) === STATUS.YES ? STATUS.YES : evaluate(unlock.requirements);
    active.delete(id); memo.set(id, state);
    return state;
  }
  function availability(id) {
    const node = nodes.get(id);
    if (!node) return {status: STATUS.UNKNOWN, source: 'unknown'};
    if (node.secretId != null) return {status: yesNo(save.chunks.achievements[node.secretId] == null ? null : !!save.chunks.achievements[node.secretId]), source:'save_secret'};
    if (node.unlock.requirements.type === 'constant') return {status:yesNo(node.unlock.requirements.value), source:'default'};
    if (earned(id) === STATUS.YES) return {status:STATUS.YES, source:'slot_condition'};
    return {status:STATUS.UNKNOWN, source:'unknown'};
  }
  return {evaluate, earned, availability, nodes,
    collected(node) {
      if (!['active','passive'].includes(node.catalog?.kind)) return null;
      const value = save.chunks.collection[node.catalog.itemId];
      return value == null ? null : !!value;
    }};
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
    graphNodes.set(id, {id, kind:'gate', name:condition.type === 'all' ? 'ВСЕ УСЛОВИЯ' : 'ЛЮБОЕ УСЛОВИЕ', ownerId:owner.id, status:conditionStatus(condition)});
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
  const nodes = new Map(graph.nodes.map(node => [node.id, {...node, depth:0}]));
  const indegree = new Map(graph.nodes.map(n => [n.id, 0])), outgoing = new Map(graph.nodes.map(n => [n.id, []]));
  for (const edge of graph.edges) { indegree.set(edge.to, indegree.get(edge.to) + 1); outgoing.get(edge.from).push(edge.to); }
  const queue = [...nodes.keys()].filter(id => !indegree.get(id));
  for (let i = 0; i < queue.length; i++) for (const child of outgoing.get(queue[i])) {
    nodes.get(child).depth = Math.max(nodes.get(child).depth, nodes.get(queue[i]).depth + 1);
    indegree.set(child, indegree.get(child) - 1);
    if (!indegree.get(child)) queue.push(child);
  }
  if (queue.length !== nodes.size) throw new Error('Цикл в графе разблокировок.');
  const layers = new Map();
  for (const node of nodes.values()) {
    if (!layers.has(node.depth)) layers.set(node.depth, []);
    layers.get(node.depth).push(node);
  }
  // Wrap wide layers; each entire layer finishes above the next dependency level.
  const maxColumns = 4, cardWidth = 220, cardHeight = 78, gapX = 48, gapY = 68;
  const columns = Math.min(maxColumns, Math.max(1, ...[...layers.values()].map(layer => layer.length)));
  const width = Math.max(620, 80 + columns * (cardWidth + gapX) - gapX);
  let top = 48;
  for (const [, layer] of [...layers].sort(([a], [b]) => a - b)) {
    for (let index = 0; index < layer.length; index++) {
      const row = Math.floor(index / columns), rowCount = Math.min(columns, layer.length - row * columns);
      Object.assign(layer[index], {x:(width - (rowCount * (cardWidth + gapX) - gapX)) / 2 + (index % columns) * (cardWidth + gapX),
        y:top + row * (cardHeight + gapY), width:cardWidth, height:cardHeight});
    }
    top += Math.ceil(layer.length / columns) * (cardHeight + gapY) + 50;
  }
  return {nodes:[...nodes.values()], edges:graph.edges, width, height:Math.max(520, top + 32)};
}
