export const clampZoom = value => Math.max(.025, Math.min(2.5, value));
export function zoomAnchor(scroll, cursor, before, after) {
  return (scroll + cursor) / before * after - cursor;
}
export function edgeGeometry(a, b, via=[]) {
  const x1 = a.x + a.width / 2, y1 = a.y + a.height;
  const x2 = b.x + b.width / 2, y2 = b.y;
  if (via.length) {
    const points=[{x:x1,y:y1},...via,{x:x2,y:y2}];
    let path=`M ${x1} ${y1}`;
    for(let index=1;index<points.length;index++) {
      const from=points[index-1],to=points[index],middle=(from.y+to.y)/2;
      path+=` C ${from.x} ${middle}, ${to.x} ${middle}, ${to.x} ${to.y}`;
    }
    const middle=points[Math.floor(points.length/2)];
    return {path,x:middle.x,y:middle.y-6};
  }
  const bend = Math.max(32, Math.abs(y2 - y1) * .45);
  return {path:`M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
    x:(x1 + x2) / 2, y:(y1 + y2) / 2 - 6};
}

// Highlight only incident edges and their endpoints, including logic junctions.
export function graphNeighborhood(graph, id) {
  const nodes=new Set(),edges=new Set();
  if (!graph.nodes.some(node=>node.id===id)) return {nodes,edges};
  nodes.add(id);
  graph.edges.forEach((edge,index)=>{
    if(edge.from!==id&&edge.to!==id)return;
    nodes.add(edge.from);nodes.add(edge.to);edges.add(index);
  });
  return {nodes,edges};
}

export function createGraphView({canvas, svg, layout, zoom=1, onZoom, onSelect, positions=new Map()}) {
  const nodes = new Map(layout.nodes.map(node => [node.id, node]));
  const elements = new Map([...svg.querySelectorAll('.graph-node')].map(element => [element.dataset.id, element]));
  const edges = [...svg.querySelectorAll('[data-edge]')].map(element => ({element, edge:layout.edges[Number(element.dataset.edge)]}));
  const origins = new Map(layout.nodes.map(node => [node.id, {x:node.x,y:node.y}]));
  let scale=clampZoom(zoom), drag=null, suppressClick=false, animation=0;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paint() {
    for (const node of nodes.values()) elements.get(node.id)?.setAttribute('transform',`translate(${node.x},${node.y})`);
    for (const {element,edge} of edges) {
      const geometry=edgeGeometry(nodes.get(edge.from),nodes.get(edge.to),edge.via);
      element.querySelectorAll('path').forEach(path=>path.setAttribute('d',geometry.path));
      const label=element.querySelector('text');label.setAttribute('x',geometry.x);label.setAttribute('y',geometry.y);
    }
  }
  for (const node of nodes.values()) if (positions.has(node.id)) Object.assign(node, positions.get(node.id));
  paint();
  function setZoom(value, point={x:canvas.clientWidth/2,y:canvas.clientHeight/2}) {
    const next=clampZoom(value), left=zoomAnchor(canvas.scrollLeft,point.x,scale,next), top=zoomAnchor(canvas.scrollTop,point.y,scale,next);
    scale=next;svg.setAttribute('width',layout.width*scale);svg.setAttribute('height',layout.height*scale);
    canvas.scrollLeft=left;canvas.scrollTop=top;onZoom?.(scale);
  }
  function fit() { setZoom(Math.min(1,(canvas.clientWidth-32)/layout.width,(canvas.clientHeight-48)/layout.height));canvas.scrollTo(0,0); }
  function reset() {
    cancelAnimationFrame(animation);
    const from=new Map([...nodes].map(([id,node])=>[id,{x:node.x,y:node.y}])), start=performance.now();
    positions.clear();
    function frame(now) {
      const t=reducedMotion?1:Math.min(1,(now-start)/420), eased=1-Math.pow(1-t,4);
      for (const [id,node] of nodes) {const a=from.get(id), b=origins.get(id);node.x=a.x+(b.x-a.x)*eased;node.y=a.y+(b.y-a.y)*eased;}
      paint();if(t<1)animation=requestAnimationFrame(frame);
    }
    animation=requestAnimationFrame(frame);
  }
  const wheel=event=>{
    event.preventDefault();
    const rect=canvas.getBoundingClientRect(), delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
    setZoom(scale*Math.exp(-Math.max(-300,Math.min(300,delta))*.0025),{x:event.clientX-rect.left,y:event.clientY-rect.top});
  };
  const down=event=>{
    if(event.button!==0||event.isPrimary===false||drag)return;
    cancelAnimationFrame(animation);
    const element=event.target.closest('.graph-node'),node=element?nodes.get(element.dataset.id):null;
    drag={node,element,x:event.clientX,y:event.clientY,left:canvas.scrollLeft,top:canvas.scrollTop,nx:node?.x,ny:node?.y,moved:false};
    canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');element?.classList.add('dragging');
  };
  const move=event=>{
    if(!drag)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.hypot(dx,dy)>4)drag.moved=true;
    if(drag.node) {
      drag.node.x=Math.max(20,Math.min(layout.width-drag.node.width-20,drag.nx+dx/scale));
      drag.node.y=Math.max(20,Math.min(layout.height-drag.node.height-20,drag.ny+dy/scale));
      paint();
    } else {canvas.scrollLeft=drag.left-dx;canvas.scrollTop=drag.top-dy;}
  };
  const stop=event=>{
    if(!drag)return;
    const cancelled=event.type==='pointercancel';
    suppressClick=!cancelled&&(drag.moved||!!drag.node);
    if(drag.node&&!drag.moved&&!cancelled)onSelect?.(drag.node.id);
    if(!drag.node&&!drag.moved&&!cancelled)onSelect?.(null);
    if(drag.node)positions.set(drag.node.id,{x:drag.node.x,y:drag.node.y});
    drag.element?.classList.remove('dragging');canvas.classList.remove('dragging');drag=null;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  };
  const click=event=>{if(suppressClick){event.stopPropagation();event.preventDefault();suppressClick=false;}};
  const keydown=event=>{
    const element=event.target.closest('.graph-node'),node=element?nodes.get(element.dataset.id):null;
    const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
    if(!node||!delta)return;
    event.preventDefault();node.x=Math.max(20,Math.min(layout.width-node.width-20,node.x+delta[0]));
    node.y=Math.max(20,Math.min(layout.height-node.height-20,node.y+delta[1]));positions.set(node.id,{x:node.x,y:node.y});paint();
  };
  canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
  canvas.addEventListener('click',click,true);canvas.addEventListener('keydown',keydown);
  // Keep cards readable in wide trees; the Fit button still shows the whole map.
  scale=clampZoom(Math.max(.6,Math.min(1,(canvas.clientWidth-32)/layout.width)));
  svg.setAttribute('width',layout.width*scale);svg.setAttribute('height',layout.height*scale);onZoom?.(scale);
  const firstY=Math.min(...layout.nodes.map(node=>node.y));
  const firstRow=layout.nodes.filter(node=>node.y===firstY);
  const center=firstRow.length?firstRow.reduce((sum,node)=>sum+node.x+node.width/2,0)/firstRow.length:layout.width/2;
  canvas.scrollLeft=Math.max(0,center*scale-canvas.clientWidth/2);
  return {setZoom,fit,reset,get zoom(){return scale;},destroy(){
    cancelAnimationFrame(animation);
    canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('pointerdown',down);
    canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',stop);canvas.removeEventListener('pointercancel',stop);
    canvas.removeEventListener('click',click,true);canvas.removeEventListener('keydown',keydown);
  }};
}
