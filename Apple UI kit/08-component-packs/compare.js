"use strict";
(() => {
  const byId = id => document.getElementById(id);
  const reference = byId("reference"), actual = byId("actual"), mode = byId("mode");
  const screen = byId("screen"), context = screen.getContext("2d", { willReadFrequently: true });
  const opacity = byId("opacity"), threshold = byId("threshold"), report = byId("report");
  const loaded = { reference: null, actual: null };
  let stats = null;
  let pixelReference = null, pixelActual = null;
  const setStatus = message => { byId("status").textContent = message; };
  const safeName = file => file ? file.name : "—";
  function readFile(file, slot) {
    loaded[slot] = null;
    stats = null; report.disabled = true;
    if (!file) { setStatus("Ожидаю оба изображения."); render(); return; }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setStatus("Поддерживаются PNG, JPEG и WebP."); render(); return; }
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(source); loaded[slot] = image; render(); };
    image.onerror = () => { URL.revokeObjectURL(source); setStatus("Ошибка чтения изображения."); };
    image.src = source;
  }
  reference.addEventListener("change", e => readFile(e.target.files?.[0], "reference"));
  actual.addEventListener("change", e => readFile(e.target.files?.[0], "actual"));
  function getData(image, width, height) {
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height).data;
  }
  function calculate() {
    if (!pixelReference || !pixelActual) return null;
    const limit = Number(threshold.value);
    let total = 0, changed = 0;
    const n = pixelReference.length / 4;
    for (let i=0; i<pixelReference.length; i+=4) {
      const d0=Math.abs(pixelReference[i]-pixelActual[i]);
      const d1=Math.abs(pixelReference[i+1]-pixelActual[i+1]);
      const d2=Math.abs(pixelReference[i+2]-pixelActual[i+2]);
      total += d0+d1+d2;
      if (Math.max(d0,d1,d2)>limit) changed++;
    }
    return { width:screen.width,height:screen.height,meanAbsoluteError:Number((total/(3*n)).toFixed(3)),
      differentPixels:changed,totalPixels:n,differentPercent:Number((100*changed/n).toFixed(3)),threshold:limit };
  }
  function drawDifference() {
    const output = context.createImageData(screen.width,screen.height);
    const p=output.data;
    const limit=Number(threshold.value);
    for (let i=0;i<p.length;i+=4) {
      const a=pixelReference,b=pixelActual;
      const delta=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
      if (delta>limit) {
        p[i]=255;p[i+1]=Math.max(0,130-delta);p[i+2]=40;p[i+3]=255;
      } else {
        const gray=Math.round((a[i]+a[i+1]+a[i+2])/3);
        p[i]=Math.round(gray*.25);p[i+1]=Math.round(gray*.25);p[i+2]=Math.round(gray*.25);p[i+3]=255;
      }
    }
    context.putImageData(output,0,0);
  }
  function render() {
    const a=loaded.reference,b=loaded.actual;
    if (!a||!b) { byId("dimensions").textContent="—";byId("mae").textContent="—";byId("pixels").textContent="—";return; }
    if (a.naturalWidth!==b.naturalWidth || a.naturalHeight!==b.naturalHeight) {
      stats=null;report.disabled=true;
      setStatus("Размеры не совпадают: эталон "+a.naturalWidth+"×"+a.naturalHeight+
        "; реализация "+b.naturalWidth+"×"+b.naturalHeight+". Нельзя вычислять честный pixel diff.");
      return;
    }
    if (a.naturalWidth*a.naturalHeight>12000000) {
      setStatus("Слишком большой кадр: лимит 12 млн пикселей для сравнительного инструмента.");
      report.disabled=true;return;
    }
    screen.width=a.naturalWidth;screen.height=a.naturalHeight;
    pixelReference=getData(a,screen.width,screen.height);
    pixelActual=getData(b,screen.width,screen.height);
    const selected=mode.value;
    context.clearRect(0,0,screen.width,screen.height);
    if (selected==="diff") drawDifference();
    else if (selected==="reference") context.drawImage(a,0,0);
    else if (selected==="actual") context.drawImage(b,0,0);
    else if (selected==="split") { context.drawImage(a,0,0);context.save();context.beginPath();context.rect(screen.width/2,0,screen.width/2,screen.height);context.clip();context.drawImage(b,0,0);context.restore(); }
    else { context.drawImage(a,0,0);context.globalAlpha=Number(opacity.value)/100;context.drawImage(b,0,0);context.globalAlpha=1; }
    stats=calculate(); report.disabled=false;
    byId("dimensions").textContent=stats.width+"×"+stats.height;
    byId("mae").textContent=stats.meanAbsoluteError.toFixed(3);
    byId("pixels").textContent=stats.differentPercent.toFixed(2)+"%";
    setStatus("Сравнение рассчитано локально. Вывод ограничен точностью изображений и условиями съёмки.");
  }
  mode.addEventListener("change",render);
  opacity.addEventListener("input",()=>{byId("opacityValue").textContent=opacity.value+"%";render();});
  threshold.addEventListener("input",()=>{byId("thresholdValue").textContent=threshold.value;render();});
  report.addEventListener("click",()=>{
    if (!stats) return;
    const output={tool:"Impulse Screenshot QA",generated:new Date().toISOString(),
      reference:safeName(reference.files?.[0]),actual:safeName(actual.files?.[0]),
      ...stats,notes:"RGB pixel diff only; not native material or interaction parity"};
    const blob = new Blob([JSON.stringify(output,null,2)], {type:"application/json"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="impulse-screenshot-qa.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  });
  setStatus("Ожидаю эталон и скриншот реализации.");
})();