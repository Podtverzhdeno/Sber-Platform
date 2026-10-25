import { useEffect, useRef, useState, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardCheck, CloudUpload,
  ExternalLink, FileArchive, FileCheck2, FileText, Info, Link2, LockKeyhole,
  Paperclip, ShieldCheck, Trash2, X,
} from "lucide-react";
import { apiRequest } from "../../api/client";
import "./checkpoint-workspace.scss";

export type CheckpointInfo = { key:string; title:string; status:string; description?:string; deliverable?:string; acceptance_criteria?:string[]; estimated_minutes?:number|null };
export type SubmittedCheckpoint = {
  checkpoint_key:string; contribution_id:string; version:number; status:string;
};

const finished=new Set(["completed","accepted","done","closed","verified"]);
const MAX_SIZE=5*1024*1024;
const allowedExtensions=[".pdf",".png",".jpg",".jpeg",".txt",".zip"];
const formatSize=(value:number)=>value>=1024*1024?`${(value/1024/1024).toFixed(1)} МБ`:`${Math.ceil(value/1024)} КБ`;
const statusLabels:Record<string,string>={
  accepted:"Принято",completed:"Подтверждено",done:"Завершено",verified:"Подтверждено",
  submitted:"На проверке",revision_requested:"Требуется доработка",
  in_progress:"В работе",planned:"По плану",pending:"Не начат",
};

function fileContent(file:File):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      if(typeof reader.result!=="string"){reject(new Error("Файл не прочитан"));return;}
      const b64=reader.result.split(",")[1];
      if(!b64){reject(new Error("Файл не прочитан"));return;}
      resolve(b64);
    };
    reader.onerror=()=>{reject(new Error("Не удалось прочитать файл"));};
    reader.readAsDataURL(file);
  });
}
type Props={
  assignmentId:string;
  checkpoint:CheckpointInfo;
  stageIndex:number;
  stageCount:number;
  criteria:string[];
  deliverable:string;
  deadline:string;
  allowedArtifacts:string[];
  assignmentStatus:string;
  previous?:SubmittedCheckpoint;
  onClose:()=>void;
  onStartWork?:()=>Promise<void>;
};
type UploadedFile={id:string;filename:string;size_bytes:number};

export function CheckpointWorkspace({
  assignmentId,checkpoint,stageIndex,stageCount,criteria,deliverable,deadline,
  allowedArtifacts,assignmentStatus,previous,onClose,onStartWork,
}:Props){
  const queryClient=useQueryClient();
  const [files,setFiles]=useState<File[]>([]);
  const [description,setDescription]=useState("");
  const [url,setUrl]=useState("");
  const [artifactKey,setArtifactKey]=useState(allowedArtifacts[0]??"report");
  const [dragging,setDragging]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const [uploaded,setUploaded]=useState<UploadedFile[]>([]);
  const closeButton=useRef<HTMLButtonElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const closeRef=useRef(onClose);
  useEffect(()=>{closeRef.current=onClose;},[onClose]);
  useEffect(()=>{
    const active=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const original=document.body.style.overflow;
    document.body.style.overflow="hidden";
    closeButton.current?.focus({preventScroll:true});
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();closeRef.current();return;}
      if(event.key!=="Tab")return;
      const focusable=Array.from(document.querySelectorAll<HTMLElement>(
        '.mpc-dialog button:not([disabled]),.mpc-dialog input:not([disabled]),.mpc-dialog select:not([disabled]),.mpc-dialog textarea:not([disabled]),.mpc-dialog a[href]'
      )).filter(element=>element.getClientRects().length>0);
      const first=focusable[0],last=focusable[focusable.length-1];
      if(!first||!last)return;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",onKey);
    return ()=>{
      document.removeEventListener("keydown",onKey);
      document.body.style.overflow=original;
      if(active?.isConnected)active.focus({preventScroll:true});
    };
  },[]);
  const addFiles=(incoming:FileList|File[])=>{
    setError("");
    const combined=[...files,...Array.from(incoming)];
    if(combined.length>5){setError("Можно приложить не более пяти файлов");return;}
    for(const file of combined){
      const ext=file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if(!allowedExtensions.includes(ext)){setError("Поддерживаются PDF, PNG, JPG, TXT и ZIP");return;}
      if(!file.size||file.size>MAX_SIZE){setError("Размер каждого файла — до 5 МБ");return;}
    }
    setFiles(combined);
  };
  const isDone=finished.has(checkpoint.status);
  const isInReview=assignmentStatus==="submitted"||assignmentStatus==="disputed"||
    previous?.status==="submitted"||previous?.status==="disputed";
  const canSubmit=assignmentStatus==="in_progress"&&!isDone&&!isInReview;
  const due=new Date(deadline);
  const validDue=!Number.isNaN(due.getTime());
  const currentStatus=isDone?"Подтверждено":isInReview?"На проверке":
    previous?.status==="revision_requested"?"Требуется доработка":
    statusLabels[checkpoint.status]??"Ожидает выполнения";
  const normalizedDescription=description.trim();
  const hasEvidence=files.length>0||url.trim().length>0;
  const canSend=normalizedDescription.length>=20&&hasEvidence&&!loading;
  const submit=async()=>{
    if(!canSend||!canSubmit)return;
    if(url&&(!/^https?:\/\//i.test(url)||!URL.canParse(url))){setError("Укажите корректную ссылку HTTP(S)");return;}
    setLoading(true);setError("");
    try{
      const uploadedFiles:UploadedFile[]=[];
      for(const file of files){
        const result=await apiRequest<UploadedFile>(
          `/api/v1/me/assignments/${encodeURIComponent(assignmentId)}/checkpoints/${encodeURIComponent(checkpoint.key)}/files`,
          {method:"POST",headers:{"X-CSRF-Token":sessionStorage.getItem("impulse_csrf")??""},
            body:JSON.stringify({
              filename:file.name,content_type:file.type||({".txt":"text/plain",".zip":"application/zip"}[file.name.toLowerCase().slice(file.name.lastIndexOf("."))]??"application/octet-stream"),
              base64_data:await fileContent(file),
            })},
        );
        uploadedFiles.push(result);
        setUploaded([...uploadedFiles]);
      }
      await apiRequest(
        `/api/v1/me/assignments/${encodeURIComponent(assignmentId)}/checkpoints/${encodeURIComponent(checkpoint.key)}/submit`,
        {method:"POST",headers:{"X-CSRF-Token":sessionStorage.getItem("impulse_csrf")??""},
          body:JSON.stringify({
            summary:normalizedDescription,artifact_key:artifactKey,
            file_ids:uploadedFiles.map(file=>file.id),external_url:url.trim()||null,
          })},
      );
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["my-work"]}),
        queryClient.invalidateQueries({queryKey:["workspace-task-detail"]}),
        queryClient.invalidateQueries({queryKey:["checkpoint-submissions",assignmentId]}),
      ]);
      setSuccess(true);
    }catch(err){
      setError(err instanceof Error?err.message:"Не удалось отправить решение. Попробуйте ещё раз.");
    }finally{setLoading(false);}
  };
  const onDrop=(event:DragEvent<HTMLDivElement>)=>{
    event.preventDefault();setDragging(false);if(canSubmit)addFiles(event.dataTransfer.files);
  };
  const showUpload=assignmentStatus==="in_progress"&&!isDone&&!isInReview;
  const expectations=checkpoint.acceptance_criteria?.length?checkpoint.acceptance_criteria:criteria;

  return <div className="mpc-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!loading)onClose();}}>
    <section className="mpc-dialog" role="dialog" aria-modal="true" aria-labelledby="mpc-heading" data-testid="checkpoint-solution-popup">
      <header className="mpc-header">
        <div className="mpc-heading">
          <div className="mpc-kicker"><span>ЧЕКПОИНТ {stageIndex} / {stageCount}</span><span className="mpc-indicator">{currentStatus}</span></div>
          <h2 id="mpc-heading">{checkpoint.title}</h2>
          <p>Разберись с постановкой, подготовь результат и передай его заказчику на проверку</p>
        </div>
        <button ref={closeButton} className="mpc-close" type="button" aria-label="Закрыть чекпоинт" disabled={loading} onClick={onClose}><X size={20}/></button>
      </header>
      <div className="mpc-scroll">
        <div className="mpc-left">
          <section className="mpc-card mpc-brief">
            <div className="mpc-card-heading"><span className="mpc-icon"><ClipboardCheck size={19}/></span><h3>Что нужно сделать</h3></div>
            <p className="mpc-action-lead">{checkpoint.title}</p>
            <p className="mpc-description">{checkpoint.description?.trim()||"Заказчик указал название этапа, но не добавил отдельную инструкцию. Уточни детали у заказчика и подготовь результат, который можно проверить."}</p>
            <div className="mpc-outcome"><strong>{checkpoint.deliverable?.trim()?"Что нужно сдать по этому этапу":"Общий ожидаемый результат проекта"}</strong><span>{checkpoint.deliverable?.trim()||deliverable}</span></div>
          </section>
          <section className="mpc-card">
            <div className="mpc-card-heading"><span className="mpc-icon"><CheckCircle2 size={19}/></span><h3>По каким критериям проверят</h3></div>
            <small className="mpc-muted">{checkpoint.acceptance_criteria?.length?"Критерии, опубликованные заказчиком для этого чекпоинта":"Общие критерии проекта — для этапа отдельные условия не опубликованы"}</small>
            {expectations.length?<ol className="mpc-criteria">{expectations.map((item,index)=><li key={index}><span>{index+1}</span>{item}</li>)}</ol>:
              <p className="mpc-muted">Отдельные критерии ещё не опубликованы. Уточни ожидаемый результат у заказчика перед отправкой.</p>}
          </section>
          <section className="mpc-card mpc-guide">
            <div className="mpc-card-heading"><span className="mpc-icon"><Info size={19}/></span><h3>Как подготовить сдачу</h3></div>
            <div className="mpc-guide-list"><div><b>01</b><span><strong>Выполни этап</strong><small>Подготовь результат, который можно воспроизвести или проверить</small></span></div>
              <div><b>02</b><span><strong>Собери доказательства</strong><small>Добавь отчёт, исходный код, изображения или ссылку</small></span></div>
              <div><b>03</b><span><strong>Передай на проверку</strong><small>Заказчик примет работу или укажет, что исправить</small></span></div></div>
          </section>
        </div>
        <div className="mpc-right">
          <section className="mpc-card mpc-submission">
            <div className="mpc-card-heading"><span className="mpc-icon"><CloudUpload size={19}/></span><h3>Сдать решение</h3></div>
            {success?<div className="mpc-submitted" role="status"><CheckCircle2 size={38}/><strong>Решение отправлено</strong><p>Версия зарегистрирована и ожидает решения заказчика. Файлы сохранены в проекте.</p><button type="button" onClick={onClose}>Вернуться к проекту <ArrowRight size={16}/></button></div>:
            showUpload?<div className="mpc-form">
              <label htmlFor="mpc-description"><strong>Что ты сделал лично? <em>*</em></strong><small>Опиши результат и вклад. Минимум 20 символов</small></label>
              <textarea id="mpc-description" rows={4} maxLength={1500} placeholder="Что подготовил, как проверил результат, где посмотреть доказательства…" value={description} onChange={event=>{setDescription(event.target.value);}}/>
              <div className="mpc-field-title"><strong>Файлы решения или ссылка <em>*</em></strong><small>Сохраняются в проекте</small></div>
              <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.zip" multiple hidden aria-label="Выбрать файлы решения" onChange={event=>{if(event.target.files)addFiles(event.target.files);event.target.value="";}}/>
              <div className={`mpc-dropzone ${dragging?"is-dragging":""}`} role="button" tabIndex={0} aria-label="Загрузить файлы решения"
                onClick={()=>{inputRef.current?.click();}}
                onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();inputRef.current?.click();}}}
                onDragOver={event=>{event.preventDefault();setDragging(true);}}
                onDragLeave={()=>{setDragging(false);}}
                onDrop={onDrop}>
                <CloudUpload size={29}/><strong>Перетащи файлы сюда</strong>
                <span>или <u>выбери с устройства</u></span><small>До 5 файлов · PDF, JPG, PNG, TXT, ZIP · до 5 МБ каждый</small>
              </div>
              {files.length>0&&<div className="mpc-files">{files.map((file,index)=><div key={file.name+String(index)}><FileArchive size={16}/><strong>{file.name}</strong><small>{formatSize(file.size)}</small><button type="button" aria-label={`Убрать файл ${file.name}`} onClick={()=>{setFiles(items=>items.filter((_,i)=>i!==index));}}><Trash2 size={15}/></button></div>)}</div>}
              <label className="mpc-link" htmlFor="mpc-link"><Link2 size={16}/> Ссылка на репозиторий или результат</label>
              <input id="mpc-link" type="url" placeholder="https://…" value={url} onChange={event=>{setUrl(event.target.value);}}/>
              {allowedArtifacts.length>0&&<label className="mpc-artifact-type" htmlFor="mpc-artifact-kind">Тип доказательства<select id="mpc-artifact-kind" value={artifactKey} onChange={event=>{setArtifactKey(event.target.value);}}>{allowedArtifacts.map(key=><option key={key} value={key}>{key}</option>)}</select></label>}
              {uploaded.length>0&&loading&&<p className="mpc-muted"><Check size={15}/> Загружено файлов: {uploaded.length} из {files.length}</p>}
              {error&&<p className="mpc-error" role="alert">{error}</p>}
              <button className="mpc-submit" type="button" disabled={!canSend||!canSubmit} onClick={()=>{void submit();}}>
                {loading?"Загружаем и отправляем…":"Отправить на проверку"} <ArrowRight size={17}/>
              </button>
              <p className="mpc-security"><LockKeyhole size={13}/> Файлы видны тебе и ответственному заказчику</p>
            </div>:
            <div className="mpc-restricted"><span className="mpc-icon"><ShieldCheck size={22}/></span>
              <strong>{isDone?"Этап подтверждён":isInReview?"Решение рассматривает заказчик":assignmentStatus==="staffed"?"Сначала начни работу":"Сейчас нельзя отправить новую версию"}</strong>
              <p>{isDone?"Результат уже принят по данным проекта.":isInReview?"После решения заказчика можно будет внести исправления при необходимости.":assignmentStatus==="staffed"?"Нажми ниже, чтобы приступить к проекту.":"Отправка откроется после начала следующей итерации."}</p>
              {assignmentStatus==="staffed"&&onStartWork&&<button type="button" className="mpc-submit" disabled={loading} onClick={()=>{setLoading(true);setError("");void onStartWork().catch(()=>{setError("Не удалось начать проект");}).finally(()=>{setLoading(false);});}}>Начать работу <ArrowRight size={17}/></button>}
              {error&&<p role="alert" className="mpc-error">{error}</p>}
              {previous&&<small>Последняя версия по этапу: {previous.version} · {statusLabels[previous.status]??previous.status}</small>}
            </div>}
          </section>
          <section className="mpc-card mpc-facts"><div className="mpc-card-heading"><span className="mpc-icon"><FileCheck2 size={19}/></span><h3>Условия сдачи</h3></div>
            <div><CalendarDays size={15}/><span>Срок проекта</span><strong>{validDue?due.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"}):"Уточняется"}</strong></div>
            {checkpoint.estimated_minutes!=null&&<div><Info size={15}/><span>Оценка времени</span><strong>{Math.ceil(checkpoint.estimated_minutes/60)} ч.</strong></div>}
            <div><Paperclip size={15}/><span>Формат</span><strong>Файлы или ссылка</strong></div>
            <div><ShieldCheck size={15}/><span>Подтверждение</span><strong>После проверки заказчиком</strong></div>
            <p><ExternalLink size={13}/> Отправка не завершает этап автоматически</p>
          </section>
        </div>
      </div>
      <footer className="mpc-footer"><span><ShieldCheck size={14}/> Изменения сохраняются только после успешной отправки</span><button type="button" onClick={onClose} disabled={loading}>Вернуться к проекту</button></footer>
    </section>
  </div>;
}
