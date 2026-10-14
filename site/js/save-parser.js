const HEADER = 'ISAACNGSAVE09R  ';
const CHUNKS = [null, ['achievements', 1], ['eventCounters', 4], ['levelCounters', 4],
  ['collection', 1], ['minibosses', 1], ['bosses', 1], ['challenges', 1],
  ['cutscenes', 4], ['settings', 4], ['specialSeeds', 1], ['bestiary', 0]];
const TABLE = Uint32Array.from({length: 256}, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) value = (value >> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

export class SaveError extends Error {}

export function kageChecksum(bytes) {
  let value = (~0xfedcba76) >>> 0;
  for (const byte of bytes) value = (TABLE[(value & 255) ^ byte] ^ (value >>> 8)) >>> 0;
  return (~value) >>> 0;
}

export function parseSave(input) {
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
  if (new TextDecoder().decode(take(16)) !== HEADER)
    throw new SaveError('Это не сохранение Repentance. Нужен rep_persistentgamedata1.dat, 2.dat или 3.dat.');
  const gameStateChecksum = uint();
  const chunks = {}, layout = [];
  for (let expected = 1; expected <= 11; expected++) {
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
  const computed = kageChecksum(bytes.subarray(16, bytes.length - 4));
  if (stored !== computed) throw new SaveError('Контрольная сумма не совпала. Попробуйте другую резервную копию сохранения.');
  if (chunks.achievements.length !== 638 || chunks.eventCounters.length !== 496)
    throw new SaveError('Пока поддерживается Repentance (638 секретов / 496 счётчиков). Repentance+ и Afterbirth+ используют другую схему.');
  return {header: HEADER, sizeBytes: bytes.length, checksum: {stored, computed, valid: true},
    gameStateChecksum, loadCounter, layout, chunks};
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
  const characters = catalog.characters.map(character => ({name: character.name, marks: {}}));
  const byName = Object.fromEntries(characters.map(c => [c.name, c]));
  for (const [key, entry] of Object.entries(catalog.eventCounters)) {
    const id = Number(key);
    if (id >= raw.eventCounters.length || !entry.name.startsWith('PROGRESSION_')) continue;
    const match = entry.name.match(/^PROGRESSION_(.+)_WITH_(.+)$/);
    if (!match || !TARGETS[match[1]]) throw new SaveError('Неизвестный счётчик отметки.');
    const tainted = match[2].startsWith('T_'), base = tainted ? match[2].slice(2) : match[2];
    const name = tainted && base === 'JACOB_AND_ESAU' ? 'Tainted Jacob' : `${tainted ? 'Tainted ' : ''}${CHARACTERS[base]}`;
    const value = raw.eventCounters[id];
    if (!byName[name] || ![0, 1, 2].includes(value)) throw new SaveError('Неизвестное состояние отметки.');
    byName[name].marks[TARGETS[match[1]]] = {value, counterId: id};
  }
  if (characters.length !== 34 || characters.some(c => Object.keys(c.marks).length !== 12))
    throw new SaveError('Каталог отметок не соответствует сохранению.');
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
  return {characters, collection, bestiary, counters: [...raw.eventCounters],
    challenges: raw.challenges.map((value, id) => ({id, name: catalog.challenges[id]?.name ?? `Испытание ${id}`, completed: !!value})).slice(1),
    bosses: raw.bosses.map((value, id) => ({id, name: catalog.bosses[id]?.name ?? `Босс ${id}`, killed: !!value})).slice(1),
    summary: {marks: characters.reduce((n, c) => n + Object.values(c.marks).filter(m => m.value > 0).length, 0),
      challenges: raw.challenges.slice(1).filter(Boolean).length, collected: collection.filter(i => i.known).length,
      unknownCollectionFlags: collection.filter(i => !i.known).map(i => i.id), bestiary: bestiary.length},
    evidencePolicy: {achievementFlagsUsed: false, steamAchievementsUsed: false}};
}
