import {createEvaluator, STATUS} from './unlock-engine.js';
import {recommendationsForPhase} from './phase-recommendations.js';

const counter=(id,atLeast)=>({type:'counter',id,atLeast});
const node=id=>({type:'node',id});
const boss=name=>({type:'boss_defeated',boss:name});
const goal=(label,condition,options={})=>({label,condition,...options});
const markGoals=['Mom’s Heart / It Lives!','Isaac','Satan','Boss Rush','???','The Lamb','Mega Satan','Hush','Greed / Greedier','Delirium','Mother','The Beast'];

// Stable phase IDs connect recommendation profiles to roadmap goals. Local item
// priorities remain independent of catalog ranks and phase completion.
export const PHASES=[
  {id:'mom',title:'The first ending',subtitle:'Face Mom. Open the way below.',theme:'depths',icons:['feature:womb'],link:'feature:womb',
    goals:[goal('Defeat Mom',node('feature:womb'),{manualKey:'defeat-mom'})]},
  {id:'heart',title:'The heart cycle',subtitle:'Eleven victories. A bigger world.',theme:'heart',icons:['feature:it-lives'],link:'feature:it-lives',
    goals:[goal('Heart / It Lives! victories',counter(1,11),{counterId:1,total:11})],note:'At 10 victories, Hush becomes a parallel target.'},
  {id:'photographs',title:'Choose your fate',subtitle:'Two photographs. Two paths beyond.',theme:'photographs',icons:['collectible:327','collectible:328'],link:'feature:chest',
    goals:[goal('Isaac victories',counter(11,5),{counterId:11,total:5}),goal('Satan victories',counter(13,5),{counterId:13,total:5})],note:'Both photographs are a roadmap goal, not a prerequisite for Mother.'},
  {id:'hush',title:'Break the silence',subtitle:'Defeat Hush. Find the secret exit.',theme:'hush',icons:['feature:blue-womb'],link:'feature:downpour',
    goals:[goal('Hush victories',counter(158,3),{counterId:158,total:3})],note:'The first victory opens the Void; the third opens the alternate path.'},
  {id:'mother',title:'The other way down',subtitle:'Follow the knife to Mother.',theme:'corpse',icons:['feature:strange-door'],link:'feature:corpse',
    goals:[goal('Defeat Mother',boss('Mother'))]},
  {id:'beast',title:'Find your way Home',subtitle:'Ascend. Face Dogma and the Beast.',theme:'home',icons:['feature:home'],link:'feature:home',
    goals:[goal('Defeat the Beast',boss('The Beast'))],note:'Tainted characters can be opened in Home before defeating the Beast.'},
  {id:'routes',title:'Leave no route behind',subtitle:'Every destination, at least once.',theme:'void',icons:['feature:void','feature:mega-satan'],link:'feature:mega-satan',
    goals:markGoals.map(target=>goal(target,target==='Greed / Greedier'?{type:'route_marks',target,minimum:2}:boss(target)))},
  {id:'marks',title:'Every character. Every mark.',subtitle:'Fill every page in red.',theme:'marks',icons:['collectible:628'],link:'collectible:628',
    goals:[goal('Hard / Greedier marks',node('collectible:628'),{metric:'marks',total:408})]},
  {id:'conditions',title:'Finish the unfinished',subtitle:'Challenges, special tasks and loose ends.',theme:'challenges',icons:['feature:dead-god-challenges'],link:'feature:dead-god-conditions',
    goals:[goal('Numbered challenges',node('feature:dead-god-challenges'),{metric:'challenges',total:45}),goal('Unlock requirements',node('feature:dead-god-conditions'),{metric:'conditions'})]},
  {id:'dead-god',title:'Dead God',subtitle:'The last pickup. The complete picture.',theme:'god',icons:['feature:dead-god'],link:'feature:dead-god',
    goals:[goal('All remaining conditions',node('feature:dead-god-conditions')),goal('Hard / Greedier marks',node('collectible:628'),{metric:'marks',total:408}),goal('Numbered challenges',node('feature:dead-god-challenges'),{metric:'challenges',total:45}),goal('Required collection',node('feature:dead-god-collection'),{metric:'collection',total:717})]},
].map((phase,index)=>({...phase,number:index+1,recommendations:[]}));

export const BRANCHES=[
  {id:'greed',title:'A little greed',subtitle:'A parallel path, from the start.',theme:'greed',icons:['feature:greed'],link:'feature:greed',
    goals:[goal('Complete Greed or Greedier',{type:'route_marks',target:'Greed / Greedier',minimum:1})]},
  {id:'greedier',title:'Greedier',subtitle:'Raise the stakes.',theme:'greed',icons:['feature:greedier'],link:'feature:greedier',
    goals:[goal('Open Greedier',{type:'any',conditions:[counter(115,500),{type:'route_marks',target:'Greed / Greedier',minimum:2}]},{historical:true,manualKey:'phase:greedier'})],note:'Donate 500 coins, or verify a recorded Greedier completion.'},
  {id:'lost',title:'A safer Lost',subtitle:'Holy Mantle, from the first room.',theme:'greed',icons:['character:the-lost'],link:'feature:lost-holy-mantle',
    goals:[goal('Donate 879 coins',counter(115,879),{historical:true,manualKey:'phase:lost-mantle'})]},
  {id:'keeper',title:'Meet the Keeper',subtitle:'One thousand coins. A new character.',theme:'greed',icons:['character:keeper'],link:'character:keeper',
    goals:[goal('Donate 1,000 coins',counter(115,1000),{historical:true,manualKey:'phase:keeper'})],note:'A low machine counter cannot establish whether an earlier donation milestone was reached.'},
].map(branch=>({...branch,recommendations:[]}));

const phaseKeys=new Set([...PHASES,...BRANCHES].flatMap(phase=>phase.goals.flatMap(goal=>goal.manualKey?[goal.manualKey]:[])));
export function cleanPhaseConfirmations(value){
  return Object.fromEntries(Object.entries(value&&typeof value==='object'?value:{}).filter(([key,confirmed])=>phaseKeys.has(key)&&confirmed===true));
}

const combine=states=>states.includes(STATUS.NO)?STATUS.NO:states.includes(STATUS.UNKNOWN)?STATUS.UNKNOWN:STATUS.YES;
export function progressionForSave(data,save,progress,manual={},phaseManual={},recommendationProfile=null){
  // Deliberately independent of the collection-inference and availability toggles.
  const automatic=createEvaluator(data,save,progress);
  const confirmations=cleanPhaseConfirmations(phaseManual);
  const evaluator=createEvaluator(data,save,progress,{...manual,...confirmations});
  const routeMark=(target,minimum)=>progress.characters.some(character=>character.marks[target]?.value>=minimum);
  const evaluate=(condition,engine)=>{
    if(condition.type==='route_marks')return routeMark(condition.target,condition.minimum)?STATUS.YES:STATUS.NO;
    if(condition.type==='any'){
      const states=condition.conditions.map(child=>evaluate(child,engine));
      return states.includes(STATUS.YES)?STATUS.YES:states.includes(STATUS.UNKNOWN)?STATUS.UNKNOWN:STATUS.NO;
    }
    return engine.evaluate(condition);
  };
  function requirements(id){
    const root=evaluator.nodes.get(id)?.unlock.requirements;
    const leaves=condition=>!condition?[]:condition.goalSecretId!=null||condition.type==='collected'?[condition]:(condition.conditions||[]).flatMap(leaves);
    return leaves(root);
  }
  const conditions=requirements('feature:dead-god-conditions'),collection=requirements('feature:dead-god-collection');
  const metrics={
    marks:progress.characters.reduce((sum,character)=>sum+Object.values(character.marks).filter(mark=>mark.value>=2).length,0),
    challenges:progress.challenges.filter(challenge=>challenge.completed).length,
    conditions:conditions.filter(condition=>evaluator.evaluate(condition)===STATUS.YES).length,
    collection:collection.filter(condition=>evaluator.evaluate(condition)===STATUS.YES).length,
  };
  function entry(definition){
    const goals=definition.goals.map(goal=>{
      let auto=evaluate(goal.condition,automatic),status=evaluate(goal.condition,evaluator);
      // Donation machine history may not survive a reset. Do not infer failure.
      if(goal.historical&&auto!==STATUS.YES){auto=STATUS.UNKNOWN;status=(manual[goal.manualKey]||confirmations[goal.manualKey])?STATUS.YES:STATUS.UNKNOWN;}
      const total=goal.metric==='conditions'?conditions.length:goal.total;
      const current=goal.counterId!=null?progress.counters[goal.counterId]:goal.metric?metrics[goal.metric]:null;
      return {...goal,auto,status,current,total,manual:status===STATUS.YES&&auto!==STATUS.YES};
    });
    const recommendations=recommendationsForPhase(recommendationProfile,definition.id,evaluator,automatic,collection.map(condition=>condition.id));
    return {...definition,goals,status:combine(goals.map(goal=>goal.status)),manual:goals.some(goal=>goal.manual),
      recommendations:recommendations.items,recommendationSummary:recommendations};
  }
  const phases=PHASES.map(entry),branches=BRANCHES.map(entry);
  let current=0;
  for(let index=0;index<phases.length;index++)if(phases[index].status===STATUS.YES)current=Math.max(current,Math.min(index+1,phases.length-1));
  if(progress.counters[1]>0||routeMark('Mom’s Heart / It Lives!',1))current=Math.max(current,1);
  if(evaluator.evaluate(boss('Isaac'))===STATUS.YES||evaluator.evaluate(boss('Satan'))===STATUS.YES)current=Math.max(current,2);
  if(evaluator.evaluate(boss('Hush'))===STATUS.YES)current=Math.max(current,3);
  if(progress.characters.some(character=>character.name.startsWith('Tainted ')&&Object.values(character.marks).some(mark=>mark.value>0)))current=Math.max(current,5);
  // A verified full-completion result supersedes unknown early route history.
  const finished=phases.at(-1).status===STATUS.YES;
  const won=target=>evaluator.evaluate(boss(target))===STATUS.YES;
  const access=[true,phases[0].status===STATUS.YES,progress.counters[1]>=11||won('Isaac')||won('Satan'),
    progress.counters[1]>=10||won('Hush'),progress.counters[158]>=3||won('Mother'),won('Mother')||current>=5,
    won('The Beast')||current>=6,phases[6].status===STATUS.YES||current>=7,
    phases[7].status===STATUS.YES||current>=8,phases[8].status===STATUS.YES||finished];
  const accessHints=['','Complete the first ending','Reach 11 Heart victories','Reach 10 Heart victories','Defeat Hush three times','Defeat Mother',
    'Finish the Home chapter','Complete every route','Complete the Hard / Greedier marks','Finish the remaining conditions'];
  phases.forEach((phase,index)=>{
    phase.current=!finished&&index===current;
    phase.locked=phase.status!==STATUS.YES&&!phase.current&&!access[index];
    phase.accessHint=accessHints[index];
  });
  branches.forEach(branch=>{branch.locked=false;});
  return {phases,branches,current:finished?null:phases[current],completed:phases.filter(phase=>phase.status===STATUS.YES).length,finished};
}
