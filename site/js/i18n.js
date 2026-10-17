import russian, {patterns, orSeparator} from './locales/ru.js';

export const LANGUAGES = ['en', 'ru'];
const DEFAULT_LANGUAGE = 'en';
const normalizeLanguage = value => LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;

// English is the source language. Russian is looked up by exact message key,
// then by parameterized patterns; unknown text (names, IDs, input) is returned unchanged.
export function translate(value, language=DEFAULT_LANGUAGE) {
  const source=String(value??'');
  if(language!=='ru')return source;
  const text=source.trim();
  if(!text||!/[A-Za-z]/.test(text))return source;
  let result=Object.hasOwn(russian,text)?russian[text]:undefined;
  if(result===undefined){
    const nested=part=>translate(part,language);
    for(const [pattern,render] of patterns){const match=text.match(pattern);if(match){result=render(nested,...match);break;}}
  }
  // Composite graph labels join condition labels; translate only when every part is known.
  if(result===undefined && text.includes(' or ')){
    const parts=text.split(' or '),translated=parts.map(part=>translate(part,language));
    if(translated.every((part,index)=>part!==parts[index]))result=translated.join(orSeparator);
  }
  if(result===undefined)return source;
  return source.slice(0,source.indexOf(text))+result+source.slice(source.indexOf(text)+text.length);
}

// Translate presentation fields only. Save bytes, IDs, requirements and evidence
// retain the same meaning; the canonical English catalog is never mutated.
export function localizeCatalog(catalog,language) {
  if(language!=='ru')return catalog;
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
  if(language!=='ru')return markup;
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
  let language=DEFAULT_LANGUAGE;try{language=normalizeLanguage(storage?.getItem('atlas-language'));}catch{}
  const originals=new WeakMap(),attributes=new WeakMap(),messages=new Map();
  const api={
    get language(){return language;},
    t:source=>translate(source,language),
    html:markup=>translateHTML(markup,language),
    text(element,source){messages.set(element,source);element.textContent=translate(source,language);},
    setLanguage(value){language=normalizeLanguage(value);try{storage?.setItem('atlas-language',language);}catch{}},
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
