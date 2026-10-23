import {STATUS} from './unlock-engine.js';
import {RANKS} from './tier-ranks.js';
import {PHASE_ITEM_RANKS} from './phase-recommendations.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const check='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m7 16 6 7L26 9" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const lock='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg>';
const seal=`<svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M27 77C6 59 12 30 27 20m46 57c21-18 15-47 0-57"/><path d="m20 66-12-7m10-4L7 45m12-3L12 30m11 2-2-14m59 48 12-7m-10-4 11-10m-12-3 7-12m-11 2 2-14"/><circle cx="50" cy="46" r="27"/><path d="m36 46 10 10 19-21M36 84l14-7 14 7"/></svg>`;

// Original decorative ink drawings; game sprites remain the catalog's local artwork.
function scene(theme){
  const motifs={
    depths:'<path d="M20 135V40h160v95M20 67h160M20 95h160M52 40v27m45-27v27m45-27v27M72 67v28m61-28v28M48 95v40m107-40v40"/><path class="scene-fill" d="M67 135V78a33 33 0 0 1 66 0v57Z"/><path d="m25 25 9-10 10 10m116 2 9-10 10 10M91 101l8 6-4 12"/>',
    heart:'<path d="M100 142C65 113 34 84 45 58c9-23 37-25 55-4 18-21 46-19 55 4 11 26-20 55-55 84Z"/><path d="m100 54-6-31 11-12m7 43 13-31 16-7M46 78 19 66 5 44m148 37 28-14 13-24M43 114l-18 14m132-16 18 17"/>',
    photographs:'<g transform="rotate(-13 80 75)"><path class="scene-fill" d="M28 23h92v116H28Z"/><path d="M39 35h70v69H39Zm8 82h45"/></g><g transform="rotate(12 140 80)"><path class="scene-fill" d="M99 35h79v105H99Z"/><path d="M110 46h57v60h-57Zm8 75h40"/></g>',
    hush:'<ellipse cx="100" cy="100" rx="89" ry="40"/><ellipse cx="100" cy="100" rx="70" ry="28"/><path d="M49 99c-5-26 7-60 51-60s56 34 51 60M29 35l8 8m133-8-8 8M83 17l3 10m32-10-3 10"/><ellipse cx="82" cy="75" rx="5" ry="8"/><ellipse cx="118" cy="75" rx="5" ry="8"/><ellipse cx="100" cy="96" rx="11" ry="16"/>',
    corpse:'<path d="M13 140c36-32 14-70 45-111m-23 77-24-9m27-17 18-16m2-35-14-17m17 21 16-15M189 140c-36-32-14-70-45-111m23 77 24-9m-27-17-18-16m-2-35 14-17m-17 21-16-15"/><path d="M81 120V67a19 19 0 0 1 38 0v53m-46 9h54M93 87h14m-7-7v15"/>',
    home:'<path d="m19 75 81-59 81 59M35 66v76h130V66M76 142V93h48v49M49 83h18v22H49Zm84 0h18v22h-18ZM133 39V16h19v37M58 55l42-30 42 30"/><path d="m8 145 184-1M94 114h2"/>',
    void:'<ellipse cx="100" cy="77" rx="71" ry="53" transform="rotate(-25 100 77)"/><ellipse cx="100" cy="77" rx="55" ry="38" transform="rotate(20 100 77)"/><ellipse cx="100" cy="77" rx="30" ry="45" transform="rotate(-25 100 77)"/><path d="m15 20 4 10 11 3-11 4-4 11-4-11-10-4 10-3Zm160 87 4 10 11 3-11 4-4 11-4-11-10-4 10-3ZM90 9h5m55 135h5M182 45h5M37 135h5"/>',
    marks:'<path class="scene-fill" d="m39 22 121-9 10 128-121 9Z"/><path d="m56 43 85-6m-82 27 15-1m10 0 15-1m10 0 15-1m-63 28 15-1m10 0 15-1m10 0 15-1m-64 28 15-1m10 0 15-1m10 0 15-1"/><path d="m59 52 8 13 14-22m7 6 8 13 14-22m4 5 8 13 14-22m-73 42 8 13 14-22m7 6 8 13 14-22m4 5 8 13 14-22"/>',
    challenges:'<path class="scene-fill" d="M33 15h105l27 28v100H33Z"/><path d="M138 15v29h27M49 63h70M49 80h96M49 97h72M49 114h47"/><circle cx="140" cy="124" r="22"/><path d="m131 124 7 7 13-16"/>',
    god:'<circle cx="100" cy="76" r="42"/><circle cx="100" cy="76" r="54"/><path d="m71 75 20 22 40-45M100 8v9m0 118v9M32 76h-9m145 0h9M49 25l9 9m84 84 9 9M49 127l9-9m84-84 9-9M81 137l19-10 19 10"/>',
    greed:'<ellipse cx="66" cy="115" rx="44" ry="17"/><path d="M22 115v14c0 23 88 23 88 0v-14M22 99v15M110 99v15"/><ellipse cx="66" cy="99" rx="44" ry="17"/><circle cx="131" cy="65" r="36"/><circle cx="131" cy="65" r="27"/><path d="M131 44v42m9-33c-16-10-26 9-9 12s7 22-9 12"/>',
  };
  return `<svg class="phase-scene" viewBox="0 0 200 160" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${motifs[theme]||motifs.depths}</svg>`;
}
function completion(entry){
  if(entry.status===STATUS.YES)return 100;
  const value=entry.goals.reduce((sum,goal)=>sum+(goal.status===STATUS.YES?1:goal.total&&goal.current!=null?Math.max(0,Math.min(1,goal.current/goal.total)):0),0)/entry.goals.length;
  return Math.min(99,Math.round(value*100));
}
export function progressionMarkup(model,{t,icons,confirmations={},celebrating=[],hideObtained=false,openRecommendations=new Map()}){
  const text=value=>esc(t(value));
  const statusLabel=entry=>entry.status===STATUS.YES?(entry.manual?'Confirmed manually':'Verified in save'):entry.current?'You are here':entry.locked?'Not yet accessible':entry.status===STATUS.UNKNOWN?'Needs verification':'Ready to explore';
  function recommendations(entry){
    const summary=entry.recommendationSummary;
    if(!summary?.total)return '';
    const items=entry.recommendations.filter(item=>!hideObtained||!item.obtained);
    const isOpen=openRecommendations.has(entry.id)?openRecommendations.get(entry.id):!entry.locked;
    const heading=summary.mode==='collection'?'COLLECTION CHECKLIST':'RECOMMENDED UNLOCKS';
    function itemCard(item){
      const status=item.collected===true?'Collected in this slot':item.earned===STATUS.YES?(item.manual?'Confirmed manually':'Unlock condition verified'):item.earned===STATUS.UNKNOWN?'Needs verification':'Requirement not verified';
      const marker=item.collected===true?'◆':item.earned===STATUS.YES?'✓':item.earned===STATUS.UNKNOWN?'?':'○';
      return `<a class="phase-unlock-item ${item.obtained?'is-obtained':''} ${item.collected?'is-collected':''}" href="#/graph?item=${encodeURIComponent(item.nodeId)}" data-phase-item="${esc(item.nodeId)}" data-recommendation-phase="${entry.id}" data-obtained="${item.obtained}" title="${text(item.name)}\n${text(item.description)}\n${text(status)}" aria-label="${text(item.name)} — ${text(item.description)} — ${text(status)}"><span class="phase-unlock-sprite">${icons.has(item.nodeId)?`<img src="${esc(icons.get(item.nodeId))}" alt="" loading="lazy" decoding="async">`:'<span aria-hidden="true">✦</span>'}<span class="phase-unlock-state" aria-hidden="true">${marker}</span></span><span class="phase-unlock-name">${text(item.name)}</span></a>`;
    }
    return `<details class="phase-recommendations" data-phase-recommendations="${entry.id}" ${isOpen?'open':''}><summary><span>${text(heading)}</span><span class="phase-recommendation-count">${summary.mode==='collection'?`${summary.remaining} ${text('left to collect')}`:`${summary.done} / ${summary.total} ${text('obtained')}`} <i aria-hidden="true">⌄</i></span></summary><div class="phase-recommendation-content"><p>${text(summary.description)}</p>
      ${items.length?`<div class="phase-unlock-tiers">${RANKS.filter(rank=>PHASE_ITEM_RANKS.includes(rank.id)).map(rank=>{
        const row=items.filter(item=>item.rank===rank.id);if(!row.length)return '';
        return `<div class="phase-unlock-row" style="--recommendation-color:${rank.color}" aria-label="${text('Phase priority')} ${rank.id}"><span class="phase-unlock-rank" title="${text(rank.label)}"><b>${rank.id}</b></span><div class="phase-unlock-items">${row.map(itemCard).join('')}</div></div>`;
      }).join('')}</div>`:`<p class="phase-recommendations-done">✓ ${text(summary.mode==='collection'?'The required collection is complete.':'All recommendations obtained.')}</p>`}
      <div class="phase-recommendation-key"><span>✓ ${text('Condition verified')}</span><span>◆ ${text('Collected')}</span></div><p class="phase-recommendation-help">${text('Select an item to see its requirements. These recommendations do not complete the phase.')}</p></div></details>`;
  }
  function card(entry,branch=false){
    const complete=entry.status===STATUS.YES,percent=completion(entry),newly=celebrating.includes(entry.id);
    return `<article id="phase-${entry.id}" class="phase-card phase-${entry.theme} ${branch?'phase-branch':''} ${complete?'is-complete':''} ${entry.current?'is-current':''} ${entry.locked?'is-locked':branch&&entry.status===STATUS.UNKNOWN?'is-unverified':''} ${newly?'just-completed':''}" data-phase="${entry.id}" data-status="${entry.status}" ${entry.current?'aria-current="step"':''}>
      <span class="phase-rail-node" aria-hidden="true">${complete?'✓':entry.current?'●':entry.locked?'·':'○'}</span>
      <div class="phase-paper"><div class="phase-card-top"><span class="phase-number">${branch?text('SIDE PATH'):`${text('PHASE')} ${String(entry.number).padStart(2,'0')}`}</span><span class="phase-state">${complete?'✓':entry.current?'◉':entry.locked?lock:'○'} ${text(statusLabel(entry))}</span></div>
      <div class="phase-chapter"><div class="phase-title"><h2>${text(entry.title)}</h2><p class="phase-subtitle">${text(entry.subtitle)}</p></div>
      <div class="phase-art" aria-hidden="true">${scene(entry.theme)}<div class="phase-sprites">${entry.icons.map(id=>icons.has(id)?`<img src="${esc(icons.get(id))}" alt="" loading="lazy">`:'').join('')}</div>${complete?`<div class="phase-medal">${seal}</div>`:entry.locked?`<div class="phase-art-lock">${lock}</div>`:branch&&entry.status===STATUS.UNKNOWN?'<div class="phase-art-lock">?</div>':''}</div></div>
      <div class="phase-goals">${entry.goals.map(goal=>`<div class="phase-goal ${goal.status===STATUS.YES?'goal-done':''}"><span class="phase-goal-symbol" aria-hidden="true">${goal.status===STATUS.YES?'✓':goal.status===STATUS.UNKNOWN?'?':''}</span><span>${text(goal.label)}</span>${goal.total?`<span class="phase-count">${goal.current==null?'—':goal.current} <span>/ ${goal.total}</span></span>`:''}${goal.manual?`<small>${text('Manual')}</small>`:''}</div>${goal.total?`<div class="phase-meter" role="progressbar" aria-label="${text(goal.label)}" aria-valuemin="0" aria-valuemax="${goal.total}" aria-valuenow="${Math.min(goal.current??0,goal.total)}"><i style="width:${Math.min(100,Math.max(0,(goal.current??0)/goal.total*100))}%"></i></div>`:''}${goal.manualKey&&goal.auto===STATUS.UNKNOWN?`<label class="phase-confirm"><input type="checkbox" data-phase-manual="${esc(goal.manualKey)}" ${confirmations[goal.manualKey]?'checked':''}><span>${text('Confirm this milestone manually')}</span></label>`:''}`).join('')}</div>
      ${entry.note?`<p class="phase-note">${text(entry.note)}</p>`:''}
      ${recommendations(entry)}
      <div class="phase-card-bottom"><span class="phase-result ${complete?'phase-stamp':''}">${complete?`✓ ${text('CLEARED')}`:entry.current?`${text('YOUR NEXT CHAPTER')} <b>${percent}%</b>`:entry.locked?`${lock} ${text(entry.accessHint)}`:`${text('Chapter progress')} <b>${percent}%</b>`}</span><a href="#/graph?item=${encodeURIComponent(entry.link)}">${text('View requirements')} <span aria-hidden="true">↗</span></a></div></div>
      ${newly?`<div class="phase-sparks" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--spark:${i}"></i>`).join('')}</div>`:''}
    </article>`;
  }
  const current=model.finished?model.phases.at(-1):model.current;
  const award=celebrating.length?[...model.phases,...model.branches].find(entry=>entry.id===celebrating[0]):null;
  return `<div class="phase-overview"><div><span class="eyebrow">✦ ${text('PROGRESS JOURNAL')}</span><h1>${text('One save. A whole journey.')}</h1><p>${text('From the first ending to Dead God. Follow the main path, take a detour, and see what you have already done.')}</p></div><div class="phase-overview-count"><span class="phase-trophy" aria-hidden="true">${seal}</span><strong>${model.completed}<span> / 10</span></strong><span>${text('phases completed')}</span></div></div>
    <nav class="phase-chapter-shelf" aria-label="${text('Journey milestones')}">${model.phases.map(entry=>`<button type="button" class="phase-mini ${entry.status===STATUS.YES?'is-complete':''} ${entry.current?'is-current':''} ${entry.locked?'is-locked':''}" data-phase-jump="${entry.id}" aria-label="${text(entry.title)} — ${text(statusLabel(entry))}" title="${text(entry.title)} — ${text(statusLabel(entry))}" ${entry.current?'aria-current="step"':''}><span>${entry.status===STATUS.YES?'✓':String(entry.number).padStart(2,'0')}</span>${icons.has(entry.icons[0])?`<img src="${esc(icons.get(entry.icons[0]))}" alt="">`:''}</button>`).join('')}</nav>
    <div class="phase-focus"><span class="phase-focus-icon" aria-hidden="true">${model.finished?check:'↳'}</span><span>${text(model.finished?'Journey complete':'YOU ARE HERE')} ${current.number?`<small>· ${text('PHASE')} ${String(current.number).padStart(2,'0')}</small>`:''}<strong>${text(current.title)}</strong></span><a class="button small" href="#phase-${current.id}" data-phase-jump="${current.id}">${text('Jump to phase')} ↓</a></div>
    <div class="phase-legend"><span><i class="phase-legend-done">✓</i>${text('CLEARED')}</span><span><i>◉</i>${text('You are here')}</span><span>${lock}${text('Not yet accessible')}</span><p>${text('Based on slot progress. Secret flags never complete a phase.')}</p></div>
    <div class="phase-recommendation-toolbar"><span>${text('Each chapter has its own unlock priorities.')}</span><label><input type="checkbox" id="phase-hide-obtained" data-phase-filter="obtained" ${hideObtained?'checked':''}>${text('Hide obtained recommendations')}</label></div>
    <div class="phase-roadmap"><section class="phase-main-path" aria-label="${text('Main progression path')}"><div class="phase-lane-label">${text('THE MAIN PATH')} <span>↓</span></div>${model.phases.map(entry=>card(entry)).join('')}</section>
    <aside class="phase-side-path" aria-label="${text('Greed side path')}"><div class="phase-lane-label">${text('A LITTLE DETOUR')} <span>↳</span></div><p class="phase-branch-note">${text('Greed grows alongside your main journey. These milestones do not block the story routes.')}</p>${model.branches.map(entry=>card(entry,true)).join('')}</aside></div>
    <p class="phase-policy">${text('This is a suggested order, not a chain of mandatory gates. Later victories keep earlier gaps visible. Manual confirmations stay with this saved snapshot in your browser; choosing another save clears them.')}</p>
    ${award?`<div class="phase-award" role="status"><span class="phase-award-medal">${seal}</span><div><span>${text('CHAPTER CLEARED')}</span><strong>${text(award.title)}</strong><small>${text('Another page in your story.')}</small></div><span class="phase-award-stars" aria-hidden="true">✦</span></div>`:''}`;
}
