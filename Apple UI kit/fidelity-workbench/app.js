"use strict";
// The only input is user-selected local images. No fetch, XHR, remote imports or storage.
const state = {source:null,target:null,mode:"overlay",reveal:50,threshold:12,stats:null,ready:false};
const $ = id => document.getElementById(id);
const format = n => new Intl.NumberFormat("ru-RU").format(n);
const allowed = new Set(["image/png","image/jpeg","image/webp"]);
let debounce = null;
const present = () => Boolean(state.source && state.target);
const dimensionsMatch = () => present() && state.source.width === state.target.width && state.source.height === state.target.height;
function note(message,warning) {
  $("dimension-note").textContent = message;
  $("dimension-note").classList.toggle("warning",Boolean(warning));
}
function status(message) { $("status").textContent = message; }
async function readImage(file) {
  if (!file) return null;
  if (!allowed.has(file.type)) throw new Error("Поддерживаются только PNG, JPEG и WebP.");
  if (file.size > 40 * 1024 * 1024) throw new Error("Файл больше 40 МБ.");
  const url = URL.createObjectURL(file), image = new Image();
  try {
    image.src = url;
    await image.decode();
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height) throw new Error("Некорректное изображение.");
    if (width * height > 24000000) throw new Error("Слишком много пикселей: максимум 24 млн.");
    return {url,image,width,height,name:file.name};
  } catch(error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
function setImage(kind,entry) {
  if (state[kind]) URL.revokeObjectURL(state[kind].url);
  state[kind] = entry;
  $(kind+"-meta").textContent=entry ? entry.name+" · "+format(entry.width)+" × "+format(entry.height)+" px" : "Не выбран";
}
async function onFile(kind,event) {
  const file=event.currentTarget.files && event.currentTarget.files[0];
  if(!file)return;
  try { setImage(kind,await readImage(file)); refresh(); }
  catch(error){ event.currentTarget.value="";note(error.message,true);status("Ошибка загрузки файла"); }
}
function renderImages() {
  $("placeholder").hidden=present();
  $("visuals").hidden=!present();
  if(!present())return;
  $("layer-source").src=state.source.url;
  $("layer-target").src=state.target.url;
  $("side-source").src=state.source.url;
  $("side-target").src=state.target.url;
  $("overlay-view").style.setProperty("--ratio",state.source.width+" / "+state.source.height);
  moveDivider();
  setMode(state.mode);
}
function moveDivider() {
  $("layer-target").style.clipPath="inset(0 0 0 "+state.reveal+"%)";
  $("divider").style.left=state.reveal+"%";
  $("reveal-value").textContent=state.reveal+"%";
  $("reveal").setAttribute("aria-valuetext",state.reveal+" процентов");
}
function setMode(mode) {
  if(mode==="diff" && !state.ready) mode="overlay";
  state.mode=mode;
  document.querySelectorAll("[data-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===mode)));
  $("overlay-view").hidden=mode!=="overlay";
  $("side-view").hidden=mode!=="side";
  $("diff-view").hidden=mode!=="diff";
  $("reveal").disabled=mode!=="overlay";
}
function resetStats() {
  state.stats=null;state.ready=false;
  ["metric-different","metric-percent","metric-mae"].forEach(x=>$(x).textContent="—");
  $("metric-size").textContent=present()?format(state.source.width)+" × "+format(state.source.height):"—";
  document.querySelector('[data-mode="diff"]').disabled=true;
  $("export-png").disabled=true;
  $("export-json").disabled=true;
  if(state.mode==="diff")state.mode="overlay";
}
function rgba(entry,context) {
  context.clearRect(0,0,entry.width,entry.height);
  context.fillStyle="#ffffff";
  context.fillRect(0,0,entry.width,entry.height);
  context.drawImage(entry.image,0,0,entry.width,entry.height);
  return context.getImageData(0,0,entry.width,entry.height).data;
}
function calculate() {
  if(!dimensionsMatch())return;
  const width=state.source.width,height=state.source.height,pixels=width*height;
  const ca=document.createElement("canvas"),cb=document.createElement("canvas");
  ca.width=cb.width=width;ca.height=cb.height=height;
  const a=rgba(state.source,ca.getContext("2d",{willReadFrequently:true}));
  const b=rgba(state.target,cb.getContext("2d",{willReadFrequently:true}));
  const diff=$("diff-canvas");diff.width=width;diff.height=height;
  const cx=diff.getContext("2d",{willReadFrequently:true});
  const map=cx.createImageData(width,height),m=map.data;
  let different=0,absolute=0;
  for(let i=0;i<a.length;i+=4){
    const dr=Math.abs(a[i]-b[i]),dg=Math.abs(a[i+1]-b[i+1]),db=Math.abs(a[i+2]-b[i+2]);
    const maximum=Math.max(dr,dg,db);
    absolute+=dr+dg+db;
    if(maximum>state.threshold){
      different++;
      m[i]=255;m[i+1]=Math.round(70+maximum*.37);m[i+2]=105;m[i+3]=255;
    }else{
      const g=Math.round((a[i]+a[i+1]+a[i+2])/3);
      m[i]=Math.round(g*.16);m[i+1]=Math.round(g*.23);m[i+2]=Math.round(g*.32);m[i+3]=255;
    }
  }
  cx.putImageData(map,0,0);
  state.stats={
    total_pixels:pixels,
    different_pixels:different,
    percent_changed:Number((different*100/pixels).toFixed(5)),
    mean_absolute_rgb_error:Number((absolute/(3*pixels)).toFixed(5))
  };
  state.ready=true;
  $("metric-different").textContent=format(different);
  $("metric-percent").textContent=state.stats.percent_changed.toFixed(2)+"%";
  $("metric-mae").textContent=state.stats.mean_absolute_rgb_error.toFixed(2);
  document.querySelector('[data-mode="diff"]').disabled=false;
  $("export-png").disabled=false;$("export-json").disabled=false;
  status("Diff рассчитан");
}
function refresh() {
  resetStats();renderImages();
  if(!present()){note("Нужно выбрать два изображения. Анализ выполняется без сетевых запросов.");status("Ожидаются изображения");return;}
  if(!dimensionsMatch()){
    note("Размеры не совпадают: A "+state.source.width+"×"+state.source.height+" и B "+state.target.width+"×"+state.target.height+". Наложение доступно для просмотра, но численный diff запрещён.",true);
    status("Разный размер изображений");return;
  }
  note("Размеры совпадают: "+format(state.source.width)+" × "+format(state.source.height)+" px. RGB сравнивается без ресайза, прозрачность компонуется на белый фон.");
  try {calculate();}
  catch(error) {resetStats();setMode("overlay");note("Не удалось рассчитать diff: "+error.message,true);status("Ошибка анализа");}
}
function save(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function report() {
  return {
    tool:"Impulse Fidelity Workbench",version:1,created_at:new Date().toISOString(),
    source:{name:state.source.name,width:state.source.width,height:state.source.height},
    implementation:{name:state.target.name,width:state.target.width,height:state.target.height},
    dimensions_equal:dimensionsMatch(),threshold_max_channel_delta:state.threshold,
    composite_transparency:"#ffffff",
    algorithm:"per-pixel maximum absolute RGB channel difference > threshold; RGB mean absolute error across all channels",
    results:state.stats,verified_official_apple_source:false,reviewed_functionality:false,
    notice:"Diagnostic image comparison only. Not a certification of official Apple geometry, source rights or functional behavior."
  };
}
function rounded(ctx,x,y,w,h,r,fill) {
  ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
function write(ctx,value,x,y,size,color,bold) {
  ctx.fillStyle=color;ctx.font=(bold?"700 ":"500 ")+size+"px Arial";ctx.fillText(value,x,y);
}
async function synthetic(kind) {
  const canvas=document.createElement("canvas");canvas.width=960;canvas.height=600;
  const c=canvas.getContext("2d");
  rounded(c,0,0,960,600,0,"#112945");
  rounded(c,26,24,908,60,22,"#33577b");
  write(c,"IMPULSE",55,63,23,"#f1f9ff",true);
  rounded(c,339,37,380,36,12,"#537498");
  write(c,"Найти задачу или курс",355,59,14,"#d6ecff",false);
  rounded(c,747,37,151,36,13,"#5c83aa");
  write(c,"Профиль",773,60,14,"#f1f9ff",false);
  rounded(c,45,120,575,290,22,"#20476e");
  write(c,"Ваш маршрут",75,173,30,"#eef8ff",true);
  write(c,"Проверенные шаги и задачи из рабочего профиля",75,207,16,"#aacce9",false);
  rounded(c,74,259,500,11,5,"#356a99");
  rounded(c,74,259,kind==="source"?348:322,11,5,"#60b9ff");
  rounded(c,75,306,kind==="source"?179:193,45,14,kind==="source"?"#2785f0":"#356fcd");
  write(c,"Открыть план",92,335,15,"#fff",true);
  rounded(c,642,120,270,290,22,kind==="source"?"#1e4268":"#254d74");
  write(c,"Следующее действие",664,171,20,"#ebf7ff",true);
  write(c,kind==="source"?"Перейти к обучению":"Перейти к практике",663,222,15,"#b4d3ee",false);
  rounded(c,662,264,215,9,5,"#3d6a93");
  rounded(c,662,264,kind==="source"?128:150,9,5,"#78bfff");
  for(let k=0;k<3;k++){
    rounded(c,49+k*292,445,275,107,19,"#25496a");
    write(c,["Задачи","Bootcamp","Аналитика"][k],69+k*292,488,20,"#e1f5ff",true);
    write(c,"Открыть раздел ›",69+k*292,522,14,"#b5d2e9",false);
  }
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  if(!blob)throw new Error("Невозможно создать демонстрационный скриншот.");
  return readImage(new File([blob],"demo-"+kind+".png",{type:"image/png"}));
}
async function demo() {
  $("demo").disabled=true;
  try{
    const images=await Promise.all([synthetic("source"),synthetic("target")]);
    setImage("source",images[0]);setImage("target",images[1]);refresh();
    $("compare-heading").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});
  }catch(error){note("Ошибка демонстрации: "+error.message,true);status("Ошибка");}
  finally{$("demo").disabled=false;}
}
$("source-input").addEventListener("change",event=>onFile("source",event));
$("target-input").addEventListener("change",event=>onFile("target",event));
$("demo").addEventListener("click",demo);
document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
$("reveal").addEventListener("input",event=>{
  state.reveal=Number(event.currentTarget.value);moveDivider();
});
$("threshold").addEventListener("input",event=>{
  state.threshold=Number(event.currentTarget.value);
  $("threshold-value").textContent=String(state.threshold);
  event.currentTarget.setAttribute("aria-valuetext",state.threshold+" из 255");
  clearTimeout(debounce);
  if(dimensionsMatch())debounce=setTimeout(refresh,100);
});
$("export-json").addEventListener("click",()=>{
  if(!state.ready)return;
  save(new Blob([JSON.stringify(report(),null,2)+"\n"],{type:"application/json"}),"impulse-pixel-report.json");
});
$("export-png").addEventListener("click",()=>{
  if(!state.ready)return;
  $("diff-canvas").toBlob(blob=>{if(blob)save(blob,"impulse-diff.png");},"image/png");
});
window.addEventListener("beforeunload",()=>{
  ["source","target"].forEach(kind=>{if(state[kind])URL.revokeObjectURL(state[kind].url);});
});
setMode("overlay");
