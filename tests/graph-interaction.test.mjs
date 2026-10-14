import test from 'node:test';
import assert from 'node:assert/strict';
import {createGraphView} from '../site/js/graph-view.js';

// A small event-target double exercises our handlers without launching a browser.
class Element {
  constructor(dataset={}){this.dataset=dataset;this.attributes={};this.classes=new Set();this.listeners=new Map();this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,handler,options){this.listeners.set(name,{handler,options});}
  removeEventListener(name){this.listeners.delete(name);}
  fire(name,properties={}){const event={type:name,button:0,pointerId:1,clientX:100,clientY:100,target:this,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...properties};this.listeners.get(name)?.handler(event);return event;}
  closest(){return this.dataset.id?this:null;}
  getBoundingClientRect(){return {left:10,top:20};}
  setPointerCapture(id){this.captured=id;}
  hasPointerCapture(id){return this.captured===id;}
  releasePointerCapture(){this.captured=null;}
  scrollTo(x,y){this.scrollLeft=x;this.scrollTop=y;}
}
function fixture(t) {
  const originals={matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  const frames=new Map();let frameId=0;
  globalThis.matchMedia=()=>({matches:false});globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  t.after(()=>{for(const [key,value]of Object.entries(originals))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
  const canvas=new Element(),svg=new Element(),a=new Element({id:'a',owner:'a'}),b=new Element({id:'b',owner:'b'});
  Object.assign(canvas,{clientWidth:652,clientHeight:460,scrollLeft:0,scrollTop:0});
  const hit=new Element(),path=new Element(),label=new Element(),edge=new Element({edge:'0'});
  edge.querySelectorAll=()=>[hit,path];edge.querySelector=()=>label;
  svg.querySelectorAll=selector=>selector==='.graph-node'?[a,b]:[edge];
  const layout={width:620,height:12000,nodes:[{id:'a',x:40,y:50,width:220,height:78},{id:'b',x:40,y:250,width:220,height:78}],edges:[{from:'a',to:'b'}]};
  const selected=[],positions=new Map();let reportedZoom;
  const view=createGraphView({canvas,svg,layout,positions,onSelect:id=>selected.push(id),onZoom:value=>reportedZoom=value});
  return {canvas,svg,a,b,hit,path,label,layout,positions,view,selected,frames,get reportedZoom(){return reportedZoom;}};
}

test('real wheel handler cancels page scrolling, increases zoom and anchors the cursor',t=>{
  const f=fixture(t);f.canvas.scrollLeft=180;f.canvas.scrollTop=220;
  const oldScale=f.view.zoom;
  assert.equal(f.canvas.listeners.get('wheel').options.passive,false);
  const event=f.canvas.fire('wheel',{deltaY:-80,deltaMode:0,clientX:110,clientY:140});
  assert.equal(event.prevented,true);assert.ok(f.view.zoom>oldScale);
  assert.ok(Math.abs((f.canvas.scrollLeft+100)/f.view.zoom-(180+100)/oldScale)<1e-9);
  assert.equal(f.reportedZoom,f.view.zoom);assert.equal(f.svg.attributes.width,620*f.view.zoom);
});
test('dragging a block moves both visible and hit-test edges and does not select it',t=>{
  const f=fixture(t),before=f.path.attributes.d;
  f.canvas.fire('pointerdown',{target:f.a});f.canvas.fire('pointermove',{clientX:170,clientY:150});
  assert.equal(f.a.attributes.transform,'translate(110,100)');assert.notEqual(f.path.attributes.d,before);
  assert.equal(f.hit.attributes.d,f.path.attributes.d);assert.equal(f.a.classes.has('dragging'),true);
  f.canvas.fire('pointerup',{clientX:170,clientY:150});
  assert.deepEqual(f.positions.get('a'),{x:110,y:100});assert.deepEqual(f.selected,[]);
  assert.equal(f.a.classes.has('dragging'),false);assert.equal(f.canvas.fire('click').stopped,true);
});
test('a block click selects its details even when pointer capture retargets the click to the canvas',t=>{
  const f=fixture(t);f.canvas.fire('pointerdown',{target:f.a});f.canvas.fire('pointerup');
  assert.deepEqual(f.selected,['a']);assert.equal(f.canvas.fire('click').stopped,true);
});
test('background dragging pans, cancellation does not select, and arrows move a focused block',t=>{
  const f=fixture(t);f.canvas.scrollTop=200;f.canvas.scrollLeft=100;
  f.canvas.fire('pointerdown');f.canvas.fire('pointermove',{clientX:70,clientY:50});f.canvas.fire('pointerup');
  assert.equal(f.canvas.scrollLeft,130);assert.equal(f.canvas.scrollTop,250);
  f.canvas.fire('pointerdown',{target:f.a});f.canvas.fire('pointercancel');assert.deepEqual(f.selected,[]);
  const event=f.canvas.fire('keydown',{target:f.a,key:'ArrowRight'});
  assert.equal(event.prevented,true);assert.equal(f.a.attributes.transform,'translate(56,50)');
});
test('restore layout animates to original positions, fit includes the whole vertical graph, cleanup removes handlers',t=>{
  const f=fixture(t);
  f.canvas.fire('pointerdown',{target:f.a});f.canvas.fire('pointermove',{clientX:150});f.canvas.fire('pointerup');
  f.view.reset();assert.equal(f.positions.size,0);assert.equal(f.frames.size,1);
  const animation=[...f.frames.values()][0];animation(performance.now()+500);
  assert.equal(f.a.attributes.transform,'translate(40,50)');
  f.view.fit();assert.ok(Number(f.svg.attributes.height)<=f.canvas.clientHeight);
  assert.equal(f.canvas.scrollTop,0);f.view.destroy();assert.equal(f.canvas.listeners.size,0);
});
