import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Award, BookOpen, Check, CheckCircle2, ChevronRight,
  ClipboardCheck, Clock3, Code2, Copy, Download, FileCode2, FileText, GraduationCap,
  LockKeyhole, Medal, ShieldCheck, Sparkles, Target, Trophy,
} from "lucide-react";
import { apiRequest, type RuntimeApiPath } from "../../../api/client";
import { learningProgramFor } from "./programs";
import { knowledgeCheckFor } from "./knowledge-checks";
import "./immersive-course.scss";

type Progress = {
  course_key: string;
  completed_units: number;
  total_units: number;
  certificate_id: string | null;
  finished: boolean;
  practice_status?: "pending" | "approved" | "needs_revision" | null;
  practical_certificate_id?: string | null;
};
type View = "overview" | "program" | "theory" | "example" | "practice" | "check" | "finish" | "success" | "certificates";
type Props = {
  courseKey: string;
  courseTitle: string;
  recommendation: string;
  accessible: boolean;
  initialView?: "overview" | "program";
  onReason: () => void;
};
const csrfHeaders = () => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const studyPath = (key: string) => ("/api/v1/me/bootcamp/impulse-study/" + encodeURIComponent(key)) as RuntimeApiPath;

export function ImmersiveCourseExperience({ courseKey, courseTitle, recommendation, accessible, initialView = "overview", onReason }: Props) {
  const program = learningProgramFor(courseKey);
  const client = useQueryClient();
  const [current, setCurrent] = useState(0);
  const [view, setView] = useState<View>(initialView);
  const [checks, setChecks] = useState<ReadonlySet<string>>(() => new Set());
  const [answer, setAnswer] = useState<number | null>(null);
  const [showExpected, setShowExpected] = useState(false);
  const [error, setError] = useState("");
  const [practiceDescription, setPracticeDescription] = useState("");
  const [practiceUrl, setPracticeUrl] = useState("");
  const [printKind, setPrintKind] = useState<"study" | "practice">("study");
  const path = studyPath(courseKey);
  const progress = useQuery({
    queryKey: ["impulse-study", courseKey],
    queryFn: () => apiRequest<Progress>(path),
    enabled: accessible && Boolean(program),
    retry: 1,
  });
  const advance = useMutation({
    mutationFn: (lessonIndex: number) => apiRequest<Progress>(
      (path + "/lessons/" + String(lessonIndex) + "/complete") as RuntimeApiPath,
      { method: "POST", headers: csrfHeaders() },
    ),
    onSuccess: (state) => { client.setQueryData(["impulse-study", courseKey], state); },
  });
  const submitPractice = useMutation({
    mutationFn: () => apiRequest<Progress>((path + "/practice") as RuntimeApiPath, {
      method: "POST", headers: { ...csrfHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ description: practiceDescription, artifact_url: practiceUrl || null }),
    }),
    onSuccess: (state) => { client.setQueryData(["impulse-study", courseKey], state); },
  });
  const finish = useMutation({
    mutationFn: () => apiRequest<Progress>((path + "/finish") as RuntimeApiPath,
      { method: "POST", headers: csrfHeaders() }),
    onSuccess: (state) => {
      client.setQueryData(["impulse-study", courseKey], state);
      setView("success");
    },
  });
  if (!program) return <p>Для этого курса программа Impulse пока не подготовлена.</p>;

  const total = program.units.length;
  const completed = Math.min(total, progress.data?.completed_units ?? 0);
  const percent = Math.round(100 * completed / total);
  const certificateId = progress.data?.certificate_id;
  const practiceState = progress.data?.practice_status;
  const practicalCertificateId = progress.data?.practical_certificate_id;
  const unit = program.units[current] ?? program.units[0];
  if (!unit) return null;
  const currentUnitId = unit.id;
  const question = knowledgeCheckFor(courseKey, unit.id);
  const ready = completed === total;
  const busy = advance.isPending || finish.isPending;

  function openView(next: View) {
    if (next === "certificates" && !certificateId) return;
    setView(next);
    setError("");
  }
  function selectLesson(index: number) {
    if (index > completed && !certificateId) return;
    setCurrent(index);
    setAnswer(null);
    setShowExpected(false);
    openView("theory");
  }
  async function nextLesson() {
    setError("");
    if (!accessible || progress.isError) { setError("Прогресс недоступен. Повторите попытку после восстановления соединения."); return; }
    try {
      if (current === completed) await advance.mutateAsync(current);
      if (current < total - 1) {
        setCurrent(current + 1);
        setView("theory");
        setAnswer(null);
        setShowExpected(false);
      } else {
        setView("finish");
      }
    } catch {
      setError("Не удалось сохранить завершение урока. Прогресс не изменён.");
    }
  }
  async function completeCourse() {
    setError("");
    if (!accessible || progress.isError) { setError("Для выдачи сертификата необходимо подключение к серверу."); return; }
    try {
      if (completed < total && current === total - 1) await advance.mutateAsync(current);
      await finish.mutateAsync();
    } catch {
      setError("Сертификат не выдан: сначала завершите все уроки и повторите попытку.");
    }
  }
  function toggleCheck(index: number) {
    const key = currentUnitId + ":" + String(index);
    setChecks(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const checkedCount = unit.checklist.filter((_, i) => checks.has(unit.id + ":" + String(i))).length;

  function printCertificate(kind: "study" | "practice") {
    setPrintKind(kind);
    window.requestAnimationFrame(() => { window.print(); });
  }
  const sectionTabs: Array<{ id: View; name: string; Icon: typeof BookOpen }> = [
    { id: "theory", name: "Теория", Icon: BookOpen },
    { id: "example", name: "Пример", Icon: Code2 },
    { id: "practice", name: "Практическое задание", Icon: FileCode2 },
    { id: "check", name: "Самопроверка", Icon: ClipboardCheck },
  ];
  const isLearning = ["overview", "theory", "example", "practice", "check"].includes(view);

  return <div className="imp-study" data-view={view} data-testid="impulse-immersive-reader">
    <div className="imp-study__hero">
      <div className="imp-study__intro">
        <span className="imp-study__chips"><span>Нужно для роли</span>{accessible ? <span className="ok"><Check size={13}/> Доступен</span> : <span className="locked"><LockKeyhole size={13}/> Доступ ограничен</span>}</span>
        <h2>{courseTitle}</h2>
        <p>{program.description}</p>
        <p className="imp-study__recommendation">{recommendation}</p>
        <div className="imp-study__hero-facts"><span><BookOpen size={15}/>{total} уроков</span><span><Clock3 size={15}/>{program.units.reduce((sum,u) => sum + u.minutes, 0)} мин</span></div>
        <div className="imp-study__hero-actions">
          <button type="button" className="imp-study__primary" onClick={() => { openView("program"); }}>
            Перейти к программе <ArrowRight size={18}/>
          </button>
          <button type="button" className="imp-study__secondary" onClick={onReason}>Почему рекомендован</button>
        </div>
      </div>
      <div className="imp-study__shield" aria-hidden="true"><ShieldCheck size={124} strokeWidth={1.2}/><div className="imp-study__glow"/></div>
      <div className="imp-study__hero-aside">
        <p><CheckCircle2/> Практические задания и реальные сценарии</p>
        <p><CheckCircle2/> Интерактивные задания и проверка понимания</p>
        <p><CheckCircle2/> Два отдельных вида сертификатов</p>
        <div className="imp-study__progress-mini"><strong>{percent}%</strong><div className="imp-study__bar"><span style={{ width: String(percent) + "%" }}/></div></div>
      </div>
    </div>
    <div className="imp-study__grid">
      <aside className="imp-study__aside" aria-label="Программа курса">
        <div className="imp-study__aside-heading"><strong>Программа курса</strong><span>{percent}%</span></div>
        <div className="imp-study__bar"><span style={{ width: String(percent) + "%" }}/></div>
        <small>{completed} из {total} уроков завершено</small>
        <ol className="imp-study__lesson-list">
          {program.units.map((lesson,index) => {
            const done = index < completed;
            const locked = index > completed && !certificateId;
            return <li key={lesson.id}>
              <button type="button" aria-current={index === current ? "step" : undefined}
                className={(index === current ? "active " : "") + (done ? "done" : "")}
                disabled={locked || !accessible}
                onClick={() => { selectLesson(index); }}>
                <span className="imp-study__lesson-number">{done ? <Check size={16}/> : locked ? <LockKeyhole size={15}/> : index + 1}</span>
                <span className="imp-study__lesson-text"><strong>{lesson.title}</strong><small>{lesson.minutes} мин · {done ? "пройден" : index === current ? "сейчас" : "не открыт"}</small></span>
                {index === current && <span className="imp-study__active-dot" />}
              </button>
            </li>;
          })}
        </ol>
      </aside>
      <main className="imp-study__main">
        {view === "program" ? <>
          <div className="imp-study__section-heading"><span>Программа курса</span><h2>{courseTitle}</h2>
            <p>{program.description}</p></div>
          <div className="imp-study__program-intro"><BookOpen/><div><strong>Практикум Impulse · самостоятельное обучение</strong><p>{total} уроков · {program.result}</p></div></div>
          <p className="imp-study__disclaimer">Учебные материалы Impulse не равны подтверждению практических компетенций. Сертификат прохождения и проверка навыков выдаются раздельно.</p>
          <div className="imp-study__program-list">{program.units.map((lesson,index)=><button type="button" key={lesson.id} disabled={index > completed && !certificateId} onClick={()=>{ selectLesson(index); }}>
            <span className="imp-study__lesson-number">{index+1}</span><strong>{lesson.title}</strong><small>{lesson.minutes} мин</small><span>{index < completed ? "Пройден" : index === completed ? "Начать" : "Закрыт"}</span><ChevronRight size={17}/></button>)}</div>
        </> : view === "finish" || view === "success" || view === "certificates" ? <>
          <div className="imp-study__final-head">
            <div className="imp-study__final-ring"><strong>{percent}%</strong><span>{completed} из {total}</span></div>
            <div><span className="imp-study__eyebrow">Результат обучения</span>
              <h2>{view === "finish" ? "Завершение обучения" : view === "success" ? "Обучение завершено!" : "Ваши сертификаты"}</h2>
              <p>{view === "finish" ? "После завершения курса система проверит, что все восемь уроков пройдены, и автоматически выпустит учебный сертификат Impulse." :
                  "Теоретическое прохождение и подтверждение практических знаний — два разных достижения."}</p></div>
          </div>
          <div className="imp-study__cert-grid">
            <section className="imp-study__cert-card is-ready"><GraduationCap size={29}/><h3>Сертификат прохождения курса</h3>
              <p>Подтверждает завершение всех учебных материалов курса «{courseTitle}»</p>
              <span className="imp-study__cert-status">{certificateId ? "Выдан автоматически" : "После завершения всех уроков"}</span>
              {certificateId && <><small>Идентификатор: {certificateId}</small><button type="button" className="imp-study__primary" onClick={() => { printCertificate("study"); }}><Download size={17}/> Сохранить сертификат PDF</button></>}
            </section>
            <section className="imp-study__cert-card"><Medal size={29}/><h3>Сертификат подтверждения знаний</h3>
              <p>Требует практического задания и проверки результата наставником. Не выдаётся автоматически за просмотр уроков.</p><span className="imp-study__cert-status">{practiceState === "approved" ? "Практика подтверждена" : practiceState === "pending" ? "Работа отправлена на проверку" : "Требуется проверка практики"}</span>
              {practicalCertificateId && <><small>Идентификатор: {practicalCertificateId}</small>
                <button type="button" className="imp-study__primary" onClick={() => { printCertificate("practice"); }}>
                  <Download size={17}/> Сохранить сертификат PDF
                </button></>}
              {!practicalCertificateId && <button type="button" className="imp-study__secondary" onClick={() => { setView("practice"); setCurrent(total-1); }}>Перейти к практике <ArrowRight size={16}/></button>}
            </section>
          </div>
          {view === "finish" && <button type="button" className="imp-study__primary imp-study__finish" disabled={busy || !ready} onClick={() => { void completeCourse(); }}><CheckCircle2/> {busy ? "Проверяем и выдаём…" : "Завершить обучение"}</button>}
          {view === "success" && <button type="button" className="imp-study__secondary imp-study__finish" onClick={() => { openView("certificates"); }}>Посмотреть два сертификата <ArrowRight size={18}/></button>}
          <div className="imp-study__print-certificate" aria-hidden="true"><h2>IMPULSE · {printKind === "study" ? "Сертификат прохождения" : "Сертификат подтверждения знаний"}</h2><p>{printKind === "study" ? "Подтверждается прохождение курса" : "Подтверждается проверка практической работы по курсу"} «{courseTitle}»</p><p>Номер {printKind === "study" ? certificateId : practicalCertificateId}</p></div>
        </> : <>
          <div className="imp-study__lesson-heading"><div><span className="imp-study__eyebrow">Урок {current+1} из {total}</span><h2>{unit.title}</h2><p>{unit.purpose}</p></div><div className="imp-study__progress-top"><strong>{percent}% прохождения</strong><div className="imp-study__bar"><span style={{width:String(percent)+"%"}}/></div></div></div>
          <nav className="imp-study__tabs" aria-label="Разделы урока">{sectionTabs.map(({id,name,Icon})=><button type="button" key={id} aria-current={(view===id || (view==="overview" && id==="check")) ? "page" : undefined} className={(view===id || (view==="overview" && id==="check"))?"active":""} onClick={() => { openView(id); }}><Icon size={18}/>{name}</button>)}</nav>
          {view === "theory" && <section className="imp-study__content" aria-label="Теория"><h3>Теория</h3><h4>{unit.title}</h4>
            {unit.theory.map((text,index)=><p key={index}>{text}</p>)}
            <div className="imp-study__callout"><Sparkles size={21}/><p><strong>Важно</strong>Используйте принципы из урока на реальных задачах и проверяйте результат самостоятельно.</p></div>
          </section>}
          {view === "example" && <section className="imp-study__content" aria-label="Пример"><h3>Пример</h3><p>Практический пример применения материала урока</p>
            <div className="imp-study__example-head"><Code2 size={17}/> Пример решения <button type="button" onClick={() => { void navigator.clipboard.writeText(unit.example); }}><Copy size={14}/> Копировать</button></div>
            <pre className="imp-study__code"><code>{unit.example}</code></pre>
            <div className="imp-study__callout"><CheckCircle2 size={18}/><p><strong>Разбор</strong>Сравните пример с задачей и объясните каждый ключевой шаг.</p></div>
          </section>}
          {view === "practice" && <section className="imp-study__content" aria-label="Практическое задание"><h3>Практическое задание</h3><p>{unit.practice}</p>
            <div className="imp-study__practice-columns"><div><h4><Target size={18}/> Требования</h4>
              {unit.checklist.map((item,index)=><div className="imp-study__requirement" key={item}><span>{index+1}</span>{item}</div>)}</div>
              <div><h4><ClipboardCheck size={18}/> Критерии проверки</h4><p>{unit.expected}</p>
                <p>Должны быть продемонстрированы работоспособность, полнота решения и корректность обработки ошибок.</p></div></div>
            <p className="imp-study__disclaimer">Практическая работа требует отдельной проверки для сертификата подтверждения знаний.</p>
            <form className="imp-study__submission" onSubmit={event => { event.preventDefault(); void submitPractice.mutateAsync(); }}>
              <h4>Отправить практическую работу на проверку</h4>
              <label>Опишите, что сделали и как проверили результат
                <textarea value={practiceDescription} minLength={50} required
                  onChange={event => { setPracticeDescription(event.target.value); }}
                  placeholder="Опишите решение, тестирование и выявленные ограничения (не менее 50 символов)"/>
              </label>
              <label>Ссылка на результат (HTTPS, необязательно)
                <input type="url" value={practiceUrl} pattern="https://.*" placeholder="https://..."
                  onChange={event => { setPracticeUrl(event.target.value); }}/>
              </label>
              <button className="imp-study__primary" type="submit"
                disabled={!certificateId || submitPractice.isPending || practiceDescription.trim().length < 50}>
                {submitPractice.isPending ? "Отправляем…" : practiceState === "pending" ? "Обновить работу на проверке" : "Отправить на проверку"} <ArrowRight size={17}/>
              </button>
              {!certificateId && <small>Отправка откроется после завершения всех уроков.</small>}
              {practiceState === "pending" && <p role="status">Практическая работа получена. Сертификат знаний будет доступен только после проверки.</p>}
              {submitPractice.isError && <p role="alert">Не удалось отправить работу. Проверьте соединение и повторите попытку.</p>}
            </form>
          </section>}
          {(view === "check" || view === "overview") && <section className="imp-study__content" aria-label="Самопроверка"><h3>Проверьте себя</h3>
            <p>Отметьте пункты, которые действительно проверили на своём примере. Галочки не увеличивают процент прохождения и не подтверждают компетенции.</p>
            <div className="imp-study__check-status"><CheckCircle2 size={19}/>{checkedCount} из {unit.checklist.length} пунктов отмечено
              <strong>{unit.checklist.length ? Math.round(checkedCount / unit.checklist.length * 100) : 0}%</strong></div>
            <div className="imp-study__check-grid">{unit.checklist.map((item,index) => {
              const active=checks.has(unit.id+":"+String(index));
              return <button type="button" aria-pressed={active} className={active?"checked":""} key={item} onClick={() => { toggleCheck(index); }}>
                <span className="imp-study__check-square">{active && <Check size={18}/>}</span><strong>{item}</strong><small>{active?"Проверено":"Отметить после проверки"}</small></button>;
            })}</div>
            {question && <section className="imp-study__quiz"><h4>Проверьте понимание на примере</h4><p>{question.question}</p>{question.options.map((option,index)=><button key={option} type="button" aria-pressed={answer===index} onClick={() => { setAnswer(index); }}>{index+1}. {option}</button>)}
              {answer!==null && <p role="status"><strong>{answer === question.correctIndex ? "Верно!" : "Попробуйте ещё раз."}</strong> {question.explanation}</p>}</section>}
            <button type="button" className="imp-study__secondary" onClick={() => { setShowExpected(value=>!value); }}>{showExpected?"Скрыть ожидаемый результат":"Показать ожидаемый результат"}</button>
            {showExpected && <div role="status" className="imp-study__callout">{unit.expected}</div>}
          </section>}
        </>}
        {isLearning && <div className="imp-study__navigation"><button type="button" className="imp-study__secondary" disabled={current===0} onClick={() => { selectLesson(current-1); }}><ArrowLeft size={17}/> Предыдущий урок</button>
          <span>{current+1} / {total}</span><button type="button" className="imp-study__primary" disabled={busy || !accessible || progress.isPending} onClick={() => { void nextLesson(); }}>{busy?"Сохраняем…":current===total-1 ? "Завершить обучение" : "Следующий урок"} <ArrowRight size={18}/></button></div>}
        {error && <p role="alert" className="imp-study__error">{error}</p>}
        {progress.isError && <p role="alert" className="imp-study__error">Не удалось загрузить прогресс с сервера. Для прохождения и выдачи сертификата требуется соединение.</p>}
      </main>
      <aside className="imp-study__right">
        <span className="imp-study__eyebrow">Финальный урок ({total} из {total})</span><h3>{program.units[total-1]?.title}</h3>
        <div className="imp-study__trophy" aria-hidden="true"><Trophy size={103}/></div>
        <h3>{certificateId ? "Курс успешно пройден!" : "Ваш результат"}</h3>
        <p>{certificateId ? "Вы завершили учебную программу и получили сертификат Impulse." : "Изучите восемь уроков, чтобы завершить программу и получить сертификат прохождения."}</p>
        <div className="imp-study__cert-mini"><FileText size={23}/><div><strong>Сертификат прохождения курса</strong><small>{certificateId?"Выдан":"Автоматически после завершения"}</small></div><CheckCircle2 size={19}/></div>
        <div className="imp-study__cert-mini"><Award size={23}/><div><strong>Подтверждение знаний</strong><small>После практической работы и проверки</small></div><LockKeyhole size={17}/></div>
        <button type="button" className="imp-study__primary" disabled={!ready || busy} onClick={() => { if (certificateId) openView("certificates"); else if (ready) openView("finish"); }}>{certificateId?"Ваши сертификаты":"Завершить обучение"} <ArrowRight size={16}/></button>
      </aside>
    </div>
  </div>;
}
