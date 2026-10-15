import {matchingProfile,decodeCompletion} from './save-profiles.js';
const CHUNKS = [null, ['achievements', 1], ['eventCounters', 4], ['levelCounters', 4],
  ['collection', 1], ['minibosses', 1], ['bosses', 1], ['challenges', 1],
  ['cutscenes', 4], ['settings', 4], ['specialSeeds', 1], ['bestiary', 0]];
const TABLE = Uint32Array.from({length: 256}, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) value = (value >> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

export class SaveError extends Error {
  constructor(message,code='invalid_save'){super(message);this.name='SaveError';this.code=code;}
}

export function rebirthChecksum(bytes,layout,gameStateChecksum,loadCounter) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let value=(loadCounter+2137939259)>>>0;
  const update=number=>{value=(number+((value>>>1)|((value&1)<<31)))>>>0;};
  for(const chunk of layout){
    update(chunk.id);update(chunk.sizeWritten);update(chunk.count);
    const width=CHUNKS[chunk.id][1];
    for(let i=0;i<chunk.count;i++)update(width===1?bytes[chunk.dataOffset+i]:view.getUint32(chunk.dataOffset+i*4,true));
  }
  update(gameStateChecksum);return (value^0x96696996)>>>0;
}

export function kageChecksum(bytes) {
  let value = (~0xfedcba76) >>> 0;
  for (const byte of bytes) value = (TABLE[(value & 255) ^ byte] ^ (value >>> 8)) >>> 0;
  return (~value) >>> 0;
}

export function parseSave(input,{fileName=''}={}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > 2 * 1024 * 1024) throw new SaveError('Файл слишком большой. Выберите persistentgamedata*.dat.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let position = 0;
  const take = size => {
    if (!Number.isSafeInteger(size) || size < 0 || position + size > bytes.length)
      throw new SaveError(`Файл обрезан или имеет неизвестный формат (позиция ${position}).`);
    const part = bytes.subarray(position, position + size);
    position += size;
    return part;
  };
  const uint = () => { take(4); return view.getUint32(position - 4, true); };
  const header=new TextDecoder().decode(take(16));
  if(header.startsWith('ISAACNG_GSR')){
    const match=fileName.match(/((?:rep\+|rep_|abp_|ab_)?)(?:gamestate)([123])/i);
    const expected=match?`${match[1]}persistentgamedata${match[2]}.dat`:'rep+persistentgamedata1.dat (или номер вашего слота)';
    throw new SaveError(`Это gamestate — состояние текущего забега, а не общий прогресс. Выберите в той же папке ${expected}. Файл gamestate для тирлиста и общей статистики не нужен.`,'run_state');
  }
  if(!['ISAACNGSAVE09R  ','ISAACNGSAVE06R  '].includes(header))
    throw new SaveError('Неизвестный формат файла. Нужен двоичный persistentgamedata*.dat из Rebirth, Repentance или Repentance+. gamestate, options.ini, log.txt и архивы не подходят.','unknown_format');
  const legacy=header==='ISAACNGSAVE06R  ';
  const gameStateChecksum = uint();
  const chunks = {}, layout = [];
  for (let expected = 1; expected <= (legacy?9:11); expected++) {
    const offset = position, id = uint(), sizeWritten = uint(), count = uint();
    if (id !== expected || !count) throw new SaveError(`Неизвестная структура блока ${expected}.`);
    const [name, width] = CHUNKS[id], dataOffset = position;
    if (!width) {
      if (![4, 5].includes(count)) throw new SaveError('Неизвестная структура бестиария.');
      const sections = {}, sectionNames = [[4, 'deaths'], [2, 'kills'], [3, 'hits'], [1, 'encounters']];
      let total = 0;
      for (const [expectedSection, sectionName] of sectionNames) {
        const section = uint(), written = uint();
        if (section !== expectedSection || written % 4) throw new SaveError('Некорректная секция бестиария.');
        total += written;
        const entries = {};
        take(written * 2);
        for (let cursor = position - written * 2; cursor < position; cursor += 8) {
          const key = view.getUint32(cursor, true), value = view.getInt32(cursor + 4, true);
          if (Object.hasOwn(entries, key) || value < 0) throw new SaveError('Некорректная запись бестиария.');
          entries[key] = value;
        }
        sections[sectionName] = entries;
      }
      if (sizeWritten !== total) throw new SaveError('Размер бестиария не совпадает с данными.');
      chunks[name] = sections;
    } else {
      if (sizeWritten !== count * (id === 1 ? 1 : 4)) throw new SaveError(`Некорректный размер блока ${id}.`);
      const part = take(count * width);
      if (width === 1) {
        if (part.some(value => value > 1)) throw new SaveError(`Некорректный флаг в блоке ${id}.`);
        chunks[name] = Array.from(part);
      } else chunks[name] = Array.from({length: count}, (_, i) => view.getInt32(dataOffset + i * 4, true));
    }
    layout.push({id, name, count, offset, dataOffset, sizeWritten, actualSize: position - dataOffset});
  }
  const loadCounter = uint(), stored = uint();
  if (position !== bytes.length) throw new SaveError('После сохранения обнаружены лишние данные.');
  const computed=legacy?rebirthChecksum(bytes,layout,gameStateChecksum,loadCounter):kageChecksum(bytes.subarray(16,bytes.length-4));
  if(stored!==computed)throw new SaveError('Контрольная сумма не совпала: файл повреждён или изменён. Выберите другую копию persistentgamedata, например последнюю резервную копию с датой.','checksum');
  const profile=matchingProfile(header,layout);
  if(!profile)throw new SaveError(`Формат ${header.trim()} распознан, но схема пока не проверена: ${chunks.achievements.length} ячеек секретов, ${chunks.eventCounters.length} счётчиков. Поддержаны Rebirth (179/95), Repentance (638/496), Repentance+ (642/523). Имя файла не определяет его версию.`,'unsupported_layout');
  if(legacy){chunks.specialSeeds=[];chunks.bestiary={deaths:{},kills:{},hits:{},encounters:{}};}
  return {header,profile,sizeBytes:bytes.length,checksum:{stored,computed,valid:true},gameStateChecksum,loadCounter,layout,chunks};
}

const TARGETS = {KILL_MOMS_HEART: 'Mom’s Heart / It Lives!', KILL_ISAAC: 'Isaac', KILL_SATAN: 'Satan',
  BOSSRUSH_CLEARED: 'Boss Rush', KILL_BLUE_BABY: '???', KILL_THE_LAMB: 'The Lamb',
  KILL_MEGA_SATAN: 'Mega Satan', KILL_HUSH: 'Hush', GREED_MODE_CLEARED: 'Greed / Greedier',
  KILL_DELIRIUM: 'Delirium', KILL_MOTHER: 'Mother', KILL_BEAST: 'The Beast'};
const CHARACTERS = {ISAAC: 'Isaac', MAGDALENE: 'Magdalene', CAIN: 'Cain', JUDAS: 'Judas', BLUE_BABY: '???',
  EVE: 'Eve', SAMSON: 'Samson', AZAZEL: 'Azazel', LAZARUS: 'Lazarus', EDEN: 'Eden', THE_LOST: 'The Lost',
  LILITH: 'Lilith', KEEPER: 'Keeper', APOLLYON: 'Apollyon', FORGOTTEN: 'The Forgotten',
  THE_FORGOTTEN: 'The Forgotten', BETHANY: 'Bethany', JACOB_AND_ESAU: 'Jacob & Esau'};

export function slotProgress(save, catalog) {
  const raw = save.chunks;
  const profile=save.profile,legacy=profile?.id==='rebirth';
  const characters = catalog.characters.slice(0,profile?.characters||34).map(character => ({name: character.name, marks: {}}));
  const byName = Object.fromEntries(characters.map(c => [c.name, c]));
  if(legacy){
    const targets=['Mom’s Heart / It Lives!','Isaac','Satan','Boss Rush','???','The Lamb'];
    targets.forEach((target,index)=>characters.forEach((character,charIndex)=>{
      const counterId=26+index*11+charIndex;
      character.marks[target]={...decodeCompletion(raw.eventCounters[counterId],profile.id),counterId};
    }));
  }else for (const [key, entry] of Object.entries(catalog.eventCounters)) {
    const id = Number(key);
    if (id >= raw.eventCounters.length || !entry.name.startsWith('PROGRESSION_')) continue;
    const match = entry.name.match(/^PROGRESSION_(.+)_WITH_(.+)$/);
    if (!match || !TARGETS[match[1]]) throw new SaveError('Неизвестный счётчик отметки.');
    const tainted = match[2].startsWith('T_'), base = tainted ? match[2].slice(2) : match[2];
    const name = tainted && base === 'JACOB_AND_ESAU' ? 'Tainted Jacob' : `${tainted ? 'Tainted ' : ''}${CHARACTERS[base]}`;
    if(!byName[name])throw new SaveError('Неизвестный персонаж в отметках.');
    let mark;try{mark=decodeCompletion(raw.eventCounters[id],profile?.id||'repentance');}catch(error){throw new SaveError(error.message);}
    byName[name].marks[TARGETS[match[1]]] = {...mark,counterId:id};
  }
  if(characters.some(character=>Object.keys(character.marks).length!==(profile?.marksPerCharacter||12)))throw new SaveError('Каталог отметок не соответствует сохранению.');
  let counters=[...raw.eventCounters];
  if(legacy){
    counters=Array(496).fill(null);
    for(let i=0;i<=3;i++)counters[i]=raw.eventCounters[i];
    for(let i=4;i<=24;i++)counters[i+1]=raw.eventCounters[i];
    counters[111]=raw.eventCounters[92];counters[113]=raw.eventCounters[93];
  }
  const itemNames = new Map(catalog.items.map(i => [i.id, i.name]));
  const collection = raw.collection.flatMap((value, id) => value ? [{id, name: itemNames.get(id) ?? `Неизвестный флаг #${id}`, known: itemNames.has(id)}] : []);
  const entityNames = new Map(catalog.entities.map(e => [`${e.id}.${e.variant}`, e]));
  const keys = new Set(Object.values(raw.bestiary).flatMap(section => Object.keys(section)));
  const bestiary = [...keys].map(key => {
    const type = Number(key) >>> 20, variant = (Number(key) >>> 8) & 4095;
    const entry = entityNames.get(`${type}.${variant}`);
    return {key: Number(key), type, variant, name: entry?.name ?? `Сущность ${type}.${variant}`,
      isBoss: entry?.isBoss ?? null, ...Object.fromEntries(Object.entries(raw.bestiary).map(([name, section]) => [name, section[key] ?? 0]))};
  });
  return {characters, collection, bestiary, counters,
    challenges: raw.challenges.map((value, id) => ({id, name: catalog.challenges[id]?.name ?? `Испытание ${id}`, completed: !!value})).slice(1),
    bosses: raw.bosses.map((value, id) => ({id, name: catalog.bosses[id]?.name ?? `Босс ${id}`, killed: !!value})).slice(1),
    summary: {marks: characters.reduce((n, c) => n + Object.values(c.marks).filter(m => m.value > 0).length, 0),
      challenges: raw.challenges.slice(1).filter(Boolean).length, collected: collection.filter(i => i.known).length,
      unknownCollectionFlags: collection.filter(i => !i.known).map(i => i.id), bestiary: bestiary.length},
    edition:profile?.label||'Repentance',
    capabilities:{bestiary:!legacy,planner:!legacy,marks:characters.length*(profile?.marksPerCharacter||12),challenges:raw.challenges.length-1},
    evidencePolicy: {achievementFlagsUsed: false, steamAchievementsUsed: false}};
}
