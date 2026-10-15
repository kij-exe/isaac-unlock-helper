import english from './locales/en.js';

const patterns = [
  [/^(✓ — Normal \/ Greed · H — Hard \/ Greedier · · — нет отметки\. Доступность персонажа по секретам здесь не учитывается\.) (Рамка — есть онлайн-отметка; Normal и Hard декодированы отдельно\.)$/, (_,marks,online)=>`${translate(marks,'en')} ${translate(online,'en')}`],
  [/^Подобрать (.+)$/, (_,item)=>`Collect ${item}`],
  [/^Пройти (?:испытание )?#(\d+)(.*)$/, (_,id,name)=>`Complete challenge #${id}${name}`],
  [/^Открыть испытание #(\d+): (.+)\.$/, (_,id,name)=>`Unlock challenge #${id}: ${name}.`],
  [/^Завершить испытание #(\d+): (.+) и забрать трофей\.$/, (_,id,name)=>`Complete challenge #${id}: ${name} and collect its trophy.`],
  [/^Победить (.+) за (.+)\.$/, (_,boss,character)=>`Defeat ${boss} as ${character}.`],
  [/^Победить (.+) (\d+) (?:раз|раза)\.?$/, (_,boss,count)=>`Defeat ${boss} ${count} time${count==='1'?'':'s'}`],
  [/^Победить (.+) три раза\.?$/, (_,boss)=>`Defeat ${boss} three times`],
  [/^Победить ([^А-Яа-яЁё]+)$/, (_,boss)=>`Defeat ${boss}`],
  [/^Внести (?:суммарно )?(\d+) (?:монет|монеты) в (.+?)(\.)?$/, (_,count,machine,period='')=>`Donate ${count} coins to the ${machine}${period}`],
  [/^За (.+): (.+?)( на Hard \/ Greedier)?\.$/, (_,character,boss,hard)=>`As ${character}: ${boss}${hard?' on Hard / Greedier':''}.`],
  [/^За (.+) дойти до Home и открыть скрытый шкаф Red Key, Cracked Key или Soul of Cain\.$/, (_,character)=>`Reach Home as ${character} and open the hidden closet with Red Key, Cracked Key or Soul of Cain.`],
  [/^Открыть скрытый шкаф в Home за (.+)$/, (_,character)=>`Open the hidden closet in Home as ${character}`],
  [/^Все (\d+) условий открытия$/, (_,count)=>`All ${count} unlock requirements`],
  [/^Все (\d+) предметов коллекции$/, (_,count)=>`All ${count} collection items`],
  [/^Все (\d+) испытаний$/, (_,count)=>`All ${count} challenges`],
  [/^Предметы (.+)$/, (_,range)=>`Items ${range}`],
  [/^(.+) · условия (\d+–\d+)$/, (_,edition,range)=>`${edition} · requirements ${range}`],
  [/^Приоритетные · (.+)$/, (_,rank)=>`Priority · ${rank}`],
  [/^Затем · (.+)$/, (_,rank)=>`Later · ${rank}`],
  [/^Отложить · (.+)$/, (_,rank)=>`Postpone · ${rank}`],
  [/^(.+) на Hard \/ Greedier$/, (_,mark)=>`${mark} on Hard / Greedier`],
  [/^Счётчик #(\d+) ≥ (\d+)$/, (_,id,count)=>`Counter #${id} ≥ ${count}`],
  [/^Отметка персонажа (.+)$/, (_,name)=>`Completion mark as ${name}`],
  [/^Граф открытия (.+)$/, (_,name)=>`Unlock graph for ${name}`],
  [/^Вики: (.+)$/, (_,name)=>`Wiki: ${name}`],
  [/^Тир (.+): (.+)$/, (_,rank,label)=>`Tier ${rank}: ${translate(label,'en')}`],
  [/^(\S+) КБ · checksum ✓$/, (_,size)=>`${size} KB · checksum ✓`],
  [/^Ещё (\d+) неизвестных флага$/, (_,count)=>`${count} additional unknown flags`],
  [/^Смертей: (.+) · Eden Tokens: (.+)$/, (_,deaths,tokens)=>`Deaths: ${deaths} · Eden Tokens: ${tokens}`],
  [/^(.+) · есть онлайн-отметка \(сырое значение (\d+)\): (.+)$/, (_,name,raw,difficulty)=>`${name} · online mark present (raw value ${raw}): ${translate(difficulty,'en')}`],
  [/^(.+): нет$/, (_,name)=>`${name}: none`],
  [/^Секреты · отдельная справка \((\d+)\)$/, (_,count)=>`Secrets · separate reference (${count})`],
  [/^(\d+) анлоков · (\d+) связей$/, (_,nodes,edges)=>`${nodes} unlocks · ${edges} links`],
  [/^Секрет #(\d+)$/, (_,id)=>`Secret #${id}`],
  [/^Неизвестный флаг #(\d+)$/, (_,id)=>`Unknown flag #${id}`],
  [/^Сущность (\d+\.\d+)$/, (_,id)=>`Entity ${id}`],
  [/^Испытание (\d+)$/, (_,id)=>`Challenge ${id}`],
  [/^Босс (\d+)$/, (_,id)=>`Boss ${id}`],
  [/^(.+): (\d+) условий открытия и 717 предметов коллекции\. Открытые секреты показаны отдельно и не доказывают выполнение условий в этом слоте\. Часть действий требует ручной проверки\.$/, (_,edition,count)=>`${edition}: ${count} unlock requirements and 717 collection items. Unlocked secrets are shown separately and do not prove requirements were met in this slot. Some actions require manual verification.`],
  [/^#(\d+) · ([^:]+): (.+)$/, (_,id,name,action)=>`#${id} · ${name}: ${translate(action,'en')}`],
  [/^Ошибка каталога: (.+)$/, (_,error)=>`Catalog error: ${error}`],
  [/^Файл обрезан или имеет неизвестный формат \(позиция (\d+)\)\.$/, (_,position)=>`File is truncated or has an unknown format (position ${position}).`],
  [/^Неизвестная структура блока (\d+)\.$/, (_,id)=>`Unknown structure in chunk ${id}.`],
  [/^Некорректный размер блока (\d+)\.$/, (_,id)=>`Invalid size in chunk ${id}.`],
  [/^Некорректный флаг в блоке (\d+)\.$/, (_,id)=>`Invalid flag in chunk ${id}.`],
  [/^Неизвестные биты отметки Repentance\+: (\d+)\.$/, (_,raw)=>`Unknown Repentance+ completion mark bits: ${raw}.`],
  [/^Неизвестное состояние отметки: (\d+)\.$/, (_,raw)=>`Unknown completion mark state: ${raw}.`],
  [/^Это gamestate — состояние текущего забега, а не общий прогресс\. Выберите в той же папке (.+)\. Файл gamestate для тирлиста и общей статистики не нужен\.$/, (_,file)=>`This gamestate stores the current run, rather than persistent progress. Choose ${file.replace(' (или номер вашего слота)',' (or your slot number)')} in the same folder. A gamestate file is not needed for the tier list or overall statistics.`],
  [/^Формат (.+) распознан, но схема пока не проверена: (\d+) ячеек секретов, (\d+) счётчиков\. Поддержаны Rebirth \(179\/95\), Repentance \(638\/496\), Repentance\+ \(642\/523\)\. Имя файла не определяет его версию\.$/, (_,header,secrets,counters)=>`Format ${header} recognized, but this layout has not been verified: ${secrets} secret slots, ${counters} counters. Supported: Rebirth (179/95), Repentance (638/496), Repentance+ (642/523). The filename does not determine its version.`],
];

export function translate(value, language='ru') {
  const source=String(value??'');
  if(language!=='en'||!/[А-Яа-яЁё]/.test(source))return source;
  const text=source.trim();
  let result=english[text];
  if(result===undefined){
    for(const [pattern,render] of patterns){const match=text.match(pattern);if(match){result=render(...match);break;}}
  }
  // Composite graph labels are built from already translated condition labels.
  if(result===undefined && text.includes(' или '))result=text.split(' или ').map(part=>translate(part,'en')).join(' or ');
  if(result===undefined)return source;
  return source.slice(0,source.indexOf(text))+result+source.slice(source.indexOf(text)+text.length);
}

// Translate presentation fields only. Save bytes, IDs, requirements and evidence
// retain the same meaning; the canonical Russian catalog is never mutated.
export function localizeCatalog(catalog,language) {
  if(language!=='en')return catalog;
  const result=structuredClone(catalog),fields=new Set(['name','label','description','reason','sourceNote']);
  function visit(value){
    if(Array.isArray(value))value.forEach(visit);
    else if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){
      if(fields.has(key)&&typeof child==='string')value[key]=translate(child,language);
      else visit(child);
    }
  }
  visit(result);return result;
}

// Generated templates use this at their rendering boundary. Only text and
// human-readable attributes are translated; URLs, data keys and inputs stay intact.
export function translateHTML(markup,language) {
  if(language!=='en')return markup;
  return markup.replace(/<!--[^]*?-->|<\/?[A-Za-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|[^<]+|</g,token=>{
    if(token.startsWith('<'))return token.replace(/\b(aria-label|aria-description|title|placeholder|content)=("[^"]*"|'[^']*')/g,(_,attribute,quoted)=>{
      const quote=quoted[0],text=translate(quoted.slice(1,-1),language);
      return `${attribute}=${quote}${text.replaceAll(quote,quote==='"'?'&quot;':'&#39;')}${quote}`;
    });
    return translate(token,language);
  });
}

export function createI18n(storage) {
  if(storage===undefined)try{storage=globalThis.localStorage;}catch{}
  let language='ru';try{if(storage?.getItem('atlas-language')==='en')language='en';}catch{}
  const originals=new WeakMap(),attributes=new WeakMap(),messages=new Map();
  const api={
    get language(){return language;},
    t:source=>translate(source,language),
    html:markup=>translateHTML(markup,language),
    text(element,source){messages.set(element,source);element.textContent=translate(source,language);},
    setLanguage(value){language=value==='en'?'en':'ru';try{storage?.setItem('atlas-language',language);}catch{}},
    refreshMessages(){for(const [element,source] of messages)element.textContent=translate(source,language);},
    localizeDOM(root){
      function visit(node){
        if(node.nodeType===3){if(!originals.has(node))originals.set(node,node.textContent);node.textContent=translate(originals.get(node),language);return;}
        if(node.nodeType===1){
          if(!attributes.has(node))attributes.set(node,new Map(['aria-label','aria-description','title','placeholder','content'].flatMap(key=>node.hasAttribute(key)?[[key,node.getAttribute(key)]]:[])));
          for(const [key,source] of attributes.get(node))node.setAttribute(key,translate(source,language));
        }
        for(const child of node.childNodes||[])visit(child);
      }
      if(root)visit(root);
    },
  };
  return api;
}
