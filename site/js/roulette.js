// Unlock roulette: which locked tier-list entries can be drawn, the reel that lands on the
// winner, and a synthesized case-opening sound. Availability is the same per-entry status the
// tier list shows; the roulette never credits progress.
export const ROULETTE_RANKS = ['S','A','B','C','D','F'];
export const ROULETTE_MODES = ['best','full'];

// Node references count as met when that dependency is already available; every other
// condition is the action the spin asks the player to do.
export function prerequisitesReady(condition, isAvailable) {
  switch (condition?.type) {
    case 'node': return isAvailable(condition.id);
    case 'all': return condition.conditions.every(child=>prerequisitesReady(child,isAvailable));
    case 'any': return condition.conditions.some(child=>prerequisitesReady(child,isAvailable));
    case 'constant': return condition.value !== false;
    default: return true;
  }
}

// "full": every locked entry from S to F. "best": the highest tier that still has a locked
// entry whose prerequisites are available; if nothing is ready, the highest locked tier.
export function roulettePool(nodes, {isLocked, isAvailable, mode='best'}) {
  const locked=nodes.filter(node=>ROULETTE_RANKS.includes(node.rank)&&isLocked(node));
  if (mode==='full') return {nodes:locked,rank:null,ready:false};
  const ready=locked.filter(node=>prerequisitesReady(node.unlock.requirements,isAvailable));
  const source=ready.length?ready:locked, rank=ROULETTE_RANKS.find(id=>source.some(node=>node.rank===id))??null;
  return {nodes:source.filter(node=>node.rank===rank),rank,ready:ready.length>0};
}

// The reel is filler drawn from the same pool with the winner at a fixed index near the end.
export function buildReel(pool, winner, {length=56, winnerIndex=48, random=Math.random}={}) {
  return Array.from({length}, (_,index)=>index===winnerIndex?winner:pool[Math.floor(random()*pool.length)]);
}

// Fast start and a long, gentle stop, like a case opening.
export const reelEasing = t => 1-Math.pow(1-t,4);

export function createRouletteSound() {
  let context=null, last=0;
  const audio=()=>{
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Context)return null;
    context??=new Context();
    if(context.state==='suspended')context.resume();
    return context;
  };
  const envelope=(ctx,start,peak,length)=>{
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(0.0001,start);gain.gain.exponentialRampToValueAtTime(peak,start+.004);
    gain.gain.exponentialRampToValueAtTime(0.0001,start+length);gain.connect(ctx.destination);
    return gain;
  };
  return {
    muted:false,
    // Wakes the audio context inside the click that starts the spin.
    prepare(){ if(!this.muted)audio(); },
    open(){
      const ctx=!this.muted&&audio();if(!ctx)return;
      const now=ctx.currentTime,noise=ctx.createBuffer(1,ctx.sampleRate*.45,ctx.sampleRate),data=noise.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
      source.buffer=noise;filter.type='bandpass';filter.Q.value=1.6;
      filter.frequency.setValueAtTime(500,now);filter.frequency.exponentialRampToValueAtTime(2600,now+.4);
      source.connect(filter).connect(envelope(ctx,now,.18,.45));source.start(now);source.stop(now+.46);
    },
    tick(){
      const ctx=!this.muted&&audio();if(!ctx)return;
      const now=ctx.currentTime;if(now-last<.018)return;last=now;
      const osc=ctx.createOscillator(),filter=ctx.createBiquadFilter();
      osc.type='square';osc.frequency.setValueAtTime(1500+Math.random()*250,now);osc.frequency.exponentialRampToValueAtTime(520,now+.03);
      filter.type='highpass';filter.frequency.value=700;
      osc.connect(filter).connect(envelope(ctx,now,.07,.045));osc.start(now);osc.stop(now+.05);
    },
    reveal(rank){
      const ctx=!this.muted&&audio();if(!ctx)return;
      const now=ctx.currentTime,tier=Math.max(0,ROULETTE_RANKS.indexOf(rank));
      const notes=[523.25,659.25,783.99,1046.5].map(freq=>freq*Math.pow(2,(5-tier)/12));
      notes.forEach((freq,index)=>{
        const osc=ctx.createOscillator(),start=now+index*.085;
        osc.type=index===notes.length-1?'triangle':'sine';osc.frequency.value=freq;
        osc.connect(envelope(ctx,start,.16,index===notes.length-1?.9:.3));osc.start(start);osc.stop(start+1);
      });
    },
  };
}
