/* Interactive demo, synthetic local data ONLY. No network calls or Impulse mutations. */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const sample = {
    participant: [["Задача по дизайну","Открыта"],["Проверка интерфейса","Ожидает"],["Доступность","Готово"]],
    customer: [["Техническое задание","Черновик"],["Участники проекта","Ожидает"],["Макет интерфейса","Готово"]],
    mentor: [["Проверка вклада","Ожидает"],["Ревью портфолио","Открыта"],["Ответ студенту","Готово"]]
  };
  const names = { participant:"Участник",customer:"Заказчик",mentor:"Ментор" };
  let role="participant", state="ready", current=null, lastFocus=null, toastTimer=null;
  const drawer=el("drawer"), pop=el("profilePop"), dialog=el("dialog");
  const notify=text=>{ clearTimeout(toastTimer);const t=el("toast");t.textContent=text;t.hidden=false;toastTimer=setTimeout(()=>t.hidden=true,2500); };
  function menu(open){
    if(open){lastFocus=document.activeElement;pop.hidden=true;el("profileBtn").setAttribute("aria-expanded","false");drawer.inert=false;drawer.dataset.open="true";el("scrim").hidden=false;el("menuBtn").setAttribute("aria-expanded","true");el("closeDrawer").focus();}
    else{drawer.dataset.open="false";drawer.inert=true;el("scrim").hidden=true;el("menuBtn").setAttribute("aria-expanded","false");(lastFocus||el("menuBtn")).focus();}
  }
  function popover(open,focus=true){pop.hidden=!open;el("profileBtn").setAttribute("aria-expanded",String(open));if(!open&&focus)el("profileBtn").focus();else if(open)el("popoverClose").focus();}
  function showDialog(message){popover(false,false);el("dialogBody").textContent=message;dialog.showModal();}
  function render(){
    const list=el("tasks");list.replaceChildren();
    const q=el("search").value.toLocaleLowerCase("ru");
    const matches=sample[role].filter(row=>row[0].toLocaleLowerCase("ru").includes(q));
    let visible=state==="ready"?matches:[];
    const empty=el("empty");empty.hidden=visible.length>0;
    if(!visible.length){
      const isError=state==="error", noResults=state==="ready"&&q.trim().length>0;
      const message=isError?"Ошибка загрузки (демо). Действия на сервере не выполнялись.":state==="empty"?"Пустой список (демо).":"Совпадений нет.";
      empty.replaceChildren();
      empty.setAttribute("role",isError?"alert":"status");
      const text=document.createElement("p");text.textContent=message;empty.append(text);
      if(isError||noResults){
        const action=document.createElement("button");action.className="btn";action.type="button";
        action.textContent=isError?"Повторить пример":"Очистить поиск";
        action.addEventListener("click",()=>{
          if(isError)setState("ready");
          else{el("search").value="";render();el("search").focus();}
        });
        empty.append(action);
      }
    }
    for(const [title,status] of visible){const li=document.createElement("li");const b=document.createElement("button");b.type="button";b.setAttribute("aria-label",title+" — "+status+", открыть");const copy=document.createElement("span");copy.textContent=title;const sub=document.createElement("small");sub.textContent="Синтетическая запись";copy.append(sub);const badge=document.createElement("em");badge.textContent=status;b.append(copy,badge);b.addEventListener("click",()=>{current=title;showDialog("Выбран пример: "+title+". Данные Impulse не изменены.");});li.append(b);list.append(li);}
  }
  function tab(next,focus=false){role=next;current=null;const selected=document.querySelector('[data-role="'+next+'"]');for(const b of document.querySelectorAll('[role="tab"]')){b.setAttribute("aria-selected",String(b===selected));b.tabIndex=b===selected?0:-1;}el("rolePanel").setAttribute("aria-labelledby",selected.id);if(focus)selected.focus();render();}
  el("menuBtn").addEventListener("click",()=>menu(true));el("closeDrawer").addEventListener("click",()=>menu(false));el("scrim").addEventListener("click",()=>menu(false));drawer.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>menu(false)));
  drawer.addEventListener("keydown",e=>{if(e.key!=="Tab")return;const nodes=Array.from(drawer.querySelectorAll("a,button:not(:disabled)"));if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus();}else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}});
  el("profileBtn").addEventListener("click",()=>popover(pop.hidden));el("popoverClose").addEventListener("click",()=>popover(false));el("popoverDialog").addEventListener("click",()=>showDialog("Пример модального окна. Никаких реальных действий."));
  document.addEventListener("pointerdown",e=>{if(!pop.hidden&&!pop.contains(e.target)&&!el("profileBtn").contains(e.target))popover(false,false);});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(drawer.dataset.open==="true")menu(false);else if(!pop.hidden)popover(false);}});
  el("themeBtn").addEventListener("click",()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==="dark"?"light":"dark";notify("Тема изменена в локальном примере");});
  el("search").addEventListener("input",render);
  document.querySelectorAll('[role="tab"]').forEach(b=>{b.addEventListener("click",()=>tab(b.dataset.role));b.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();const tabs=Array.from(document.querySelectorAll('[role="tab"]'));const index=tabs.indexOf(b);const next=e.key==="Home"?0:e.key==="End"?tabs.length-1:(index+(e.key==="ArrowRight"?1:tabs.length-1))%tabs.length;tab(tabs[next].dataset.role,true);});});
  function setState(next){
    state=next;
    document.querySelectorAll("[data-state]").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.state===next)));
    render();
  }
  document.querySelectorAll("[data-state]").forEach(b=>b.addEventListener("click",()=>setState(b.dataset.state)));
  document.querySelectorAll("[data-glass-choice]").forEach(b=>b.addEventListener("click",()=>{el("glassExample").dataset.glass=b.dataset.glassChoice;document.querySelectorAll("[data-glass-choice]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));}));
  el("newBtn").addEventListener("click",()=>showDialog("Создание демо-примера. Это не новая задача в Impulse."));el("glassBtn").addEventListener("click",()=>showDialog("Проверяйте контраст на насыщенном фоне."));
  el("inspectBtn").addEventListener("click",()=>showDialog(current?"Выбрана запись: "+current:"Сначала выберите задачу из списка."));
  el("cancelDialog").addEventListener("click",()=>dialog.close());el("confirmDialog").addEventListener("click",()=>{dialog.close();notify("Локальный пример подтверждён");});
  el("sampleForm").addEventListener("submit",e=>{e.preventDefault();const input=el("taskName");const error=el("formError");const valid=input.value.trim().length>=3&&el("consent").checked;error.hidden=valid;error.textContent=valid?"":"Введите не меньше 3 символов и отметьте согласие.";input.setAttribute("aria-invalid",String(input.value.trim().length<3));if(valid)notify("Форма проверена локально (не сохранена)");else (input.value.trim().length<3?input:el("consent")).focus();});
  el("sampleForm").addEventListener("reset",()=>{el("formError").hidden=true;el("taskName").removeAttribute("aria-invalid");});
  render();
})();
