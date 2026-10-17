import test from 'node:test';
import assert from 'node:assert/strict';
import {prerequisitesReady, roulettePool, buildReel, reelEasing} from '../site/js/roulette.js';

const entry = (id, rank, requirements={type:'manual',key:id}) => ({id, rank, unlock:{description:id, requirements}});
const nodes = [
  entry('open', 'OPEN'), entry('goal', 'DEAD GOD'),
  entry('s-blocked', 'S', {type:'all', conditions:[{type:'node', id:'route'}, {type:'manual', key:'x'}]}),
  entry('s-done', 'S'),
  entry('a-ready', 'A', {type:'any', conditions:[{type:'node', id:'route'}, {type:'node', id:'char'}]}),
  entry('a-ready-2', 'A'), entry('c-locked', 'C'),
];
const unlocked = new Set(['open', 'goal', 's-done', 'char']);
const options = mode => ({mode, isLocked:node=>!unlocked.has(node.id), isAvailable:id=>unlocked.has(id)});

test('node prerequisites follow AND/OR over available dependencies', () => {
  const available = id => id === 'char';
  assert.equal(prerequisitesReady({type:'node', id:'route'}, available), false);
  assert.equal(prerequisitesReady({type:'any', conditions:[{type:'node', id:'route'}, {type:'node', id:'char'}]}, available), true);
  assert.equal(prerequisitesReady({type:'all', conditions:[{type:'node', id:'char'}, {type:'mark', character:'Isaac', target:'Satan'}]}, available), true);
  assert.equal(prerequisitesReady({type:'constant', value:false}, available), false);
});

test('full random draws every locked S–F entry, never default or goal rows', () => {
  const pool = roulettePool(nodes, options('full'));
  assert.deepEqual(pool.nodes.map(node=>node.id).sort(), ['a-ready', 'a-ready-2', 'c-locked', 's-blocked']);
});

test('best next draws the highest tier that has a ready entry', () => {
  const pool = roulettePool(nodes, options('best'));
  assert.equal(pool.rank, 'A');assert.equal(pool.ready, true);
  assert.deepEqual(pool.nodes.map(node=>node.id).sort(), ['a-ready', 'a-ready-2']);
});

test('best next falls back to the highest locked tier when nothing is ready', () => {
  const blocked = nodes.filter(node=>!['a-ready', 'a-ready-2', 'c-locked'].includes(node.id));
  const pool = roulettePool(blocked, options('best'));
  assert.deepEqual([pool.rank, pool.ready, pool.nodes.map(node=>node.id)], ['S', false, ['s-blocked']]);
  assert.deepEqual(roulettePool([], options('best')).nodes, []);
});

test('the reel places the winner at its index and the easing settles exactly', () => {
  const reel = buildReel([nodes[2], nodes[4]], nodes[6], {length:10, winnerIndex:7, random:()=>0});
  assert.equal(reel.length, 10);assert.equal(reel[7], nodes[6]);assert.equal(reel[0], nodes[2]);
  assert.equal(reelEasing(0), 0);assert.equal(reelEasing(1), 1);assert.ok(reelEasing(.5) > .9);
});
