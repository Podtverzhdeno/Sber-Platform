"use strict";
(() => {
 const d = window.APPLE_SOURCE_ATLAS;
 if (!d || !Array.isArray(d.entries)) {
  document.querySelector("#results").textContent="Ошибка: каталог источников не загружен.";
  return;
 }
 const $ = selector => document.querySelector(selector);
 const make = (name,cls,text) => {
  const e = document.createElement(name);
  if (cls) e.className=cls;
  if (text !== undefined) e.textContent=String(text);
  return e;
 };
 const safeLink = (url,title,extraClass="") => {
  const a=make("a",extraClass,title);
  a.href=url;
  a.target="_blank";
  a.rel="noopener noreferrer";
  return a;
 };
 const kits=$("#kits");
 d.kit_sources.forEach(kit=>{
  const a=safeLink(kit.url,"");
  a.className="kit-card";
  a.append(make("strong","",kit.label));
  a.append(make("small","",kit.platform));
  a.append(make("span","","Открыть официальный источник ↗"));
  kits.append(a);
 });
 d.groups.forEach(g=>{
  const opt=make("option","",g.label+" · "+g.items);
  opt.value=g.key;
  $("#category").append(opt);
 });
 let priority="";
 const state={search:"",category:"",priority:""};
 const category=$("#category"),search=$("#search"),results=$("#results");
 const normalize=v=>String(v).toLocaleLowerCase("ru-RU").normalize("NFKC");
 const matching=e=>{
  if (state.category && e.category!==state.category) return false;
  if (state.priority && e.priority!==state.priority) return false;
  if (!state.search) return true;
  const haystack=[e.title,e.id,e.category_name,e.impulse_touchpoint,...e.states,...e.platforms].join(" ");
  return normalize(haystack).includes(normalize(state.search));
 };
 const makeCard=e=>{
  const art=make("article","case-card");
  const meta=make("div","case-meta");
  meta.append(make("span","id-tag",e.id));
  meta.append(make("span","priority "+e.priority.toLowerCase(),e.priority));
  meta.append(make("span","",e.category_name));
  art.append(meta);
  art.append(make("h3","",e.title));
  art.append(make("p","",e.platforms.join(" / ")+" · официальный HIG + UI Kit 27"));
  const states=make("div","state-row");
  e.states.slice(0,5).forEach(x=>states.append(make("span","state-token",x.replaceAll("_"," "))));
  art.append(states);
  art.append(safeLink(e.guideline_url,"Открыть HIG ↗","case-link"));
  const detail=make("details");
  detail.append(make("summary","","Состояния, измерения и интеграция"));
  detail.append(make("p","","Варианты: "+e.states.join(" · ")));
  const target=make("p");
  target.append(document.createTextNode("Impulse: "));
  target.append(make("code","",e.impulse_touchpoint));
  detail.append(target);
  detail.append(make("p","","Что измерить: "+e.measures.slice(0,9).join(", ")+"…"));
  const parentKit=d.kit_sources.find(k=>k.key===e.kit_source_keys[0]);
  if (parentKit) detail.append(safeLink(parentKit.url,"Открыть UI Kit в редакторе ↗","case-link"));
  detail.append(make("p","","Статус: ожидается проверка слоя/фрейма и пиксельного соответствия."));
  art.append(detail);
  return art;
 };
 function render() {
  const found=d.entries.filter(matching);
  const fragment=document.createDocumentFragment();
  found.forEach(e=>fragment.append(makeCard(e)));
  results.replaceChildren(fragment);
  $("#result-count").textContent=found.length+" из "+d.entries.length+" компонентов";
  $("#empty").hidden=found.length!==0;
 }
 search.addEventListener("input",()=>{state.search=search.value.trim();render();});
 category.addEventListener("change",()=>{state.category=category.value;render();});
 document.querySelectorAll("[data-priority]").forEach(button=>{
  button.addEventListener("click",()=>{
   state.priority=button.dataset.priority;
   document.querySelectorAll("[data-priority]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.priority===state.priority)));
   render();
  });
 });
 render();
})();