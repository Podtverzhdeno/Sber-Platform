import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Award, BookOpen, Check, CheckCircle2, ChevronRight,
  Clock3, ClipboardCheck, Code2, Copy, Download, FileCode2, FileText, GraduationCap,
  LockKeyhole, Medal, BadgeCheck, ShieldCheck, Sparkles, Target, Trophy,
} from "lucide-react";
import { apiRequest, type RuntimeApiPath } from "../../../api/client";
import { invalidateLearningProjections } from "../../learning-progress";
import { learningProgramFor } from "./programs";
import { knowledgeCheckFor } from "./knowledge-checks";
import { LessonFrame } from "./LessonFrame";
import { StarterCaseCard } from "./StarterCaseCard";
import { ManualCompanionCard } from "./ManualCompanionCard";
import "./learning-content.scss";
import { authorizationMethods, authorizationWalkthrough, authorizationRequirements, authorizationCriteria, authorizationExample } from "./security-lesson-reference";
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
type View = "overview" | "program" | "skills" | "reviews" | "theory" | "example" | "practice" | "check" | "finish" | "success" | "certificates";
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
  const resumedCourse = useRef<string | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [checks, setChecks] = useState<ReadonlySet<string>>(() => new Set());
  const [answer, setAnswer] = useState<number | null>(null);
  const [showExpected, setShowExpected] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
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
  // Resume from the server-confirmed first uncompleted lesson on a new reader.
  // Keep the user's manual lesson selection after the first hydration.
  useEffect(() => {
    if (!program || !progress.data || progress.data.course_key !== courseKey) return;
    if (resumedCourse.current === courseKey) return;
    resumedCourse.current = courseKey;
    setCurrent(Math.min(progress.data.completed_units, Math.max(0, program.units.length - 1)));
  }, [courseKey, program, progress.data]);
    const advance = useMutation({
    mutationFn: (lessonIndex: number) => apiRequest<Progress>(
      (path + "/lessons/" + String(lessonIndex) + "/complete") as RuntimeApiPath,
      { method: "POST", headers: csrfHeaders() },
    ),
    onSuccess: (state) => {
      client.setQueryData(["impulse-study", courseKey], state);
      invalidateLearningProjections(client);
    },
  });
  const submitPractice = useMutation({
    mutationFn: () => apiRequest<Progress>((path + "/practice") as RuntimeApiPath, {
      method: "POST", headers: { ...csrfHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ description: practiceDescription, artifact_url: practiceUrl || null }),
    }),
    onSuccess: (state) => {
      client.setQueryData(["impulse-study", courseKey], state);
      invalidateLearningProjections(client);
    },
  });
  const finish = useMutation({
    mutationFn: () => apiRequest<Progress>((path + "/finish") as RuntimeApiPath,
      { method: "POST", headers: csrfHeaders() }),
    onSuccess: (state) => {
      client.setQueryData(["impulse-study", courseKey], state);
      invalidateLearningProjections(client);
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
  const authReference = courseKey === "demo-course-10" && unit.id === "authorization";
  const exampleText = authReference ? authorizationExample : unit.example;
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

  async function copyExampleCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function printCertificate(kind: "study" | "practice") {
    setPrintKind(kind);
    window.requestAnimationFrame(() => { window.print(); });
  }
  const isLearning = ["overview", "theory", "example", "practice", "check"].includes(view);

  return <div className="imp-study" data-course={courseKey} data-view={view} data-testid="impulse-immersive-reader">
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
    {view === "practice" && <div className="imp-study__compact-course">
      <div className="imp-study__compact-shield"><ShieldCheck size={28}/></div>
      <div className="imp-study__compact-identity"><h3>{courseTitle}</h3><p>{program.description}</p></div>
      <div className="imp-study__compact-progress"><span>Прогресс курса <strong>{percent}%</strong></span>
        <div className="imp-study__bar"><span style={{width:String(percent)+"%"}}/></div>
        <small>{completed} из {total} уроков завершено</small>
      </div>
    </div>}
    <div className="imp-study__grid">
      <aside className="imp-study__aside" aria-label="Программа курса">
        {view !== "overview" && <div className="imp-study__course-summary">
          <div className="imp-study__course-emblem"><ShieldCheck size={26} aria-hidden="true"/></div>
          <div className="imp-study__course-identity"><strong>{courseTitle}</strong>
            <small>Практикум · {total} уроков · {program.units.reduce((sum, lesson) => sum + lesson.minutes, 0)} мин</small>
          </div>
        </div>}
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
        </> : view === "finish" || view === "success" || view === "certificates" || view === "skills" || view === "reviews" ? <>
          <div className={"imp-study__final-head imp-study__final-head--" + view}>
            <div className="imp-study__final-ring"><strong>{percent}%</strong><span>{completed} из {total} уроков</span></div>
            <div className="imp-study__final-copy">
              <span className="imp-study__eyebrow"><CheckCircle2 size={15}/> {certificateId ? "Курс пройден" : "Последний шаг"}</span>
              <h2>{view === "finish" ? "Завершение обучения" : view === "success" ? "Обучение завершено!" : view === "skills" ? "Навыки курса" : view === "reviews" ? "Отзывы о курсе" : "Ваши сертификаты"}</h2>
              <p>{view === "finish"
                ? "Все уроки изучены. Подтвердите завершение: платформа проверит прогресс и автоматически выдаст сертификат прохождения."
                : view === "success"
                  ? "Поздравляем! Вы прошли учебную программу и получили сертификат прохождения. Следующий шаг — подтвердить навыки на практике."
                  : view === "skills" ? "Учебные цели и практические навыки, формируемые на протяжении восьми уроков."
                  : view === "reviews" ? "Отзывы публикуются только после поступления проверенных оценок реальных участников."
                  : "Два независимых достижения: завершение учебной программы и подтверждение практических знаний после проверки."}</p>
            </div>
            {view === "success" && <div className="imp-study__final-art" aria-hidden="true">
              <div className="imp-study__final-art-paper"><FileText size={64}/><BadgeCheck size={38}/></div>
            </div>}
          </div>
          {(view === "certificates" || view === "skills" || view === "reviews") && <nav className="imp-study__course-tabs" aria-label="Разделы информации о курсе">
            {([
              ["overview","О курсе"],["program","Программа"],["skills","Навыки"],["reviews","Отзывы"],["certificates","Сертификаты"],
            ] as const).map(([target,label]) => <button type="button" key={target}
              className={view===target ? "active" : ""}
              aria-current={view===target ? "page" : undefined}
              onClick={() => { openView(target); }}>{label}</button>)}
          </nav>}
          {view === "skills" && <section className="imp-study__skills-panel" aria-label="Навыки курса">
            <h3>Что вы изучите</h3><p>Темы основаны на учебной программе курса «{courseTitle}».</p>
            <div>{program.units.map((lesson,index) => <article key={lesson.id}>
              <span>{index+1}</span><div><strong>{lesson.title}</strong><p>{lesson.purpose}</p></div>
              {index < completed && <CheckCircle2 size={20} aria-label="Изучено"/>}
            </article>)}</div>
            <button type="button" className="imp-study__primary" onClick={() => { openView("program"); }}>Посмотреть программу <ArrowRight size={17}/></button>
          </section>}
          {view === "reviews" && <section className="imp-study__reviews-panel" aria-label="Отзывы о курсе">
            <BookOpen size={42}/><h3>Проверенных отзывов пока нет</h3>
            <p>Здесь будут отображаться только опубликованные отзывы реальных участников. Учебные отметки самопроверки не считаются отзывами и не подменяют оценку качества курса.</p>
            <button type="button" className="imp-study__secondary" onClick={() => { openView("program"); }}>Вернуться к программе <ArrowRight size={17}/></button>
          </section>}
          {view === "success" && <div className="imp-study__final-milestones">
            <div><BookOpen size={26}/><strong>{total} из {total} уроков</strong><span>Все уроки завершены</span></div>
            <div><CheckCircle2 size={26}/><strong>{percent}%</strong><span>Учебная программа пройдена</span></div>
            <div><Award size={26}/><strong>Сертификат выдан</strong><span>Автоматически после проверки</span></div>
          </div>}
          {view !== "skills" && view !== "reviews" && <>
          <div className="imp-study__cert-grid">
            <section className="imp-study__cert-card is-ready">
              <div className="imp-study__cert-card-top"><GraduationCap size={29}/>
                <span className="imp-study__cert-status"><Check size={14}/>{certificateId ? "Получен автоматически" : "После завершения уроков"}</span>
              </div>
              <div className="imp-study__cert-body"><div className="imp-study__cert-details">
                <h3>Сертификат прохождения курса</h3>
                <p>Подтверждает завершение учебной программы «{courseTitle}» и изучение всех {total} уроков.</p>
                <ul>
                  <li><CheckCircle2 size={16}/> Все {total} уроков изучены</li>
                  <li><CheckCircle2 size={16}/> {percent}% прогресса обучения</li>
                  <li><CheckCircle2 size={16}/> Отдельная проверка проекта не требуется</li>
                </ul>
              </div>
              <div className="imp-study__cert-preview" aria-hidden="true"><span>IMPULSE</span><FileText size={48}/><strong>СЕРТИФИКАТ</strong><BadgeCheck size={32}/></div></div>
              {certificateId && <small className="imp-study__cert-id">Номер: {certificateId}</small>}
              {certificateId ? <button type="button" className="imp-study__primary" onClick={() => { printCertificate("study"); }}><Download size={17}/> Распечатать / сохранить PDF</button>
                : <p className="imp-study__cert-await">Будет выдан автоматически после завершения курса</p>}
            </section>
            <section className="imp-study__cert-card imp-study__cert-card--practice">
              <div className="imp-study__cert-card-top"><Medal size={29}/>
                <span className="imp-study__cert-status imp-study__cert-status--practice">
                  {practiceState === "approved" ? "Знания подтверждены" : practiceState === "pending" ? "На проверке" : "Нужна практика"}
                </span>
              </div>
              <div className="imp-study__cert-body"><div className="imp-study__cert-details">
                <h3>Сертификат подтверждения знаний</h3>
                <p>Подтверждает практические навыки после выполнения задания и независимой проверки результата.</p>
                <ul>
                  <li><CheckCircle2 size={16}/> Теоретическая программа завершена</li>
                  <li className={practiceState ? "complete" : "pending"}><Clock3 size={16}/> {practiceState === "pending" ? "Работа ожидает проверки" : practiceState === "approved" ? "Практика принята" : "Выполните практическое задание"}</li>
                  <li className={practicalCertificateId ? "complete" : "pending"}><Medal size={16}/> {practicalCertificateId ? "Компетенции подтверждены" : "Требуется решение проверяющего"}</li>
                </ul>
              </div><div className="imp-study__cert-preview imp-study__cert-preview--practice" aria-hidden="true">
                <span>IMPULSE</span><Medal size={48}/><strong>СЕРТИФИКАТ</strong><Clock3 size={30}/>
              </div></div>
              {practicalCertificateId && <small className="imp-study__cert-id">Номер: {practicalCertificateId}</small>}
              {practicalCertificateId
                ? <button type="button" className="imp-study__primary" onClick={() => { printCertificate("practice"); }}><Download size={17}/> Распечатать / сохранить PDF</button>
                : <button type="button" className="imp-study__secondary" disabled={!certificateId} onClick={() => { setView("practice"); setCurrent(total-1); }}>
                  {practiceState === "pending" ? "Посмотреть отправленную практику" : "Перейти к практике"} <ArrowRight size={16}/>
                </button>}
            </section>
          </div>
          </>}
          {view === "certificates" && <section className="imp-study__cert-timeline" aria-label="Как получить сертификаты">
            <h3>Как получить каждый сертификат</h3><div>
              <div><BookOpen size={22}/><span><strong>1. Пройти все уроки</strong><small>Завершить {total} из {total} уроков</small></span><ChevronRight size={18}/><CheckCircle2 size={25}/><span><strong>Сертификат прохождения</strong><small>Выдаётся автоматически</small></span></div>
              <div><Code2 size={22}/><span><strong>2. Выполнить практику</strong><small>Отправить решение на проверку</small></span><ChevronRight size={18}/><Medal size={25}/><span><strong>Подтверждение знаний</strong><small>Только после успешной проверки</small></span></div>
            </div>
          </section>}
          {view === "finish" && <button type="button" className="imp-study__primary imp-study__finish" disabled={busy || !ready} onClick={() => { void completeCourse(); }}><CheckCircle2/> {busy ? "Проверяем и выдаём…" : "Завершить обучение"} <ArrowRight size={17}/></button>}
          {view === "success" && <div className="imp-study__success-actions">
            <button type="button" className="imp-study__secondary" onClick={() => { openView("certificates"); }}>Посмотреть два сертификата <ArrowRight size={18}/></button>
            <button type="button" className="imp-study__primary" disabled={!certificateId} onClick={() => { printCertificate("study"); }}><Download size={17}/> Распечатать / сохранить PDF</button>
          </div>}
          <div className="imp-study__print-certificate" aria-hidden="true"><h2>IMPULSE · {printKind === "study" ? "Сертификат прохождения" : "Сертификат подтверждения знаний"}</h2><p>{printKind === "study" ? "Подтверждается прохождение курса" : "Подтверждается проверка практической работы по курсу"} «{courseTitle}»</p><p>Номер {printKind === "study" ? certificateId : practicalCertificateId}</p></div>
        </> : <>
          <div className="imp-study__lesson-heading"><div><span className="imp-study__eyebrow">Урок {current+1} из {total}</span><h2>{unit.title}</h2><p>{unit.purpose}</p></div><div className="imp-study__progress-top"><strong>{percent}% прохождения</strong><div className="imp-study__bar"><span style={{width:String(percent)+"%"}}/></div></div></div>
          <div className="lesson-frames" data-testid="unified-course-lesson">
            <div className="lesson-frames__intro"><strong>Изучай и сразу применяй</strong>Все материалы урока собраны ниже: теория, разобранный пример, самостоятельное задание и скрытая до открытия самопроверка. Блоки можно сворачивать. Серверный прогресс сохраняется отдельно кнопкой «Следующий урок».</div>
          <LessonFrame key={unit.id + "-theory"} unitId={unit.id} kind="theory">{() => <section className="imp-study__content" aria-label="Теория"><h3>Теория</h3><h4>{unit.title}</h4>
            <ManualCompanionCard courseKey={courseKey} lessonIndex={current} />
            {unit.theory.map((text,index)=><p key={index}>{text}</p>)}
            {authReference && <><h4>Основные способы аутентификации</h4><div className="imp-study__methods-grid">{authorizationMethods.map((method,index)=><article key={method.title} className="imp-study__method-card"><span>{index+1}</span><div><strong>{method.title}</strong><p>{method.detail}</p></div></article>)}</div></>}
            <div className="imp-study__callout"><Sparkles size={21}/><p><strong>Важно</strong>Используйте принципы из урока на реальных задачах и проверяйте результат самостоятельно.</p></div>
          </section>}</LessonFrame>
          <LessonFrame key={unit.id + "-example"} unitId={unit.id} kind="example">{() => <section className="imp-study__content" aria-label="Пример"><h3>Пример</h3><h4>{authReference ? "JWT-аутентификация в API" : "Применение материала урока"}</h4>
            <p>{authReference ? "Разберём проверку JWT в FastAPI. Токен подтверждает личность, а доступ к отдельным объектам проверяется дополнительно." : "Практический пример применения материала урока"}</p>
            <div className={authReference ? "imp-study__example-grid" : ""}>
              <div className="imp-study__code-column"><div className="imp-study__example-head"><Code2 size={17}/> Пример · {authReference ? "main.py" : "сценарий"} <button type="button" onClick={() => { void copyExampleCode(exampleText); }}><Copy size={14}/> {copyStatus === "copied" ? "Скопировано" : copyStatus === "failed" ? "Не удалось скопировать" : "Копировать пример"}</button></div>
                <pre className="imp-study__code"><code>{exampleText}</code></pre></div>
              {authReference ? <div className="imp-study__walkthrough"><h4>Разбор</h4>{authorizationWalkthrough.map((step,index)=><article key={step.title}><span>{index+1}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div></article>)}</div>
              : <div className="imp-study__callout"><CheckCircle2 size={18}/><p><strong>Разбор</strong>Сравните пример с задачей и объясните каждый ключевой шаг.</p></div>}
            </div>
          </section>}</LessonFrame>
          <LessonFrame key={unit.id + "-practice"} unitId={unit.id} kind="practice">{() => <section className="imp-study__content" aria-label="Практическое задание"><h3>Практическое задание</h3><p>{authReference ? "Реализуйте защищённый API на FastAPI: проверяйте JWT и возвращайте профиль текущего пользователя только по доверенному токену. Добавьте негативные проверки и запрет доступа к чужим объектам." : unit.practice}</p>
            <StarterCaseCard courseKey={courseKey} unitTitle={unit.title}/>
            <div className="imp-study__practice-columns"><div><h4><Target size={18}/> Требования</h4>
              {authReference ? authorizationRequirements.map((item,index)=><div className="imp-study__requirement" key={item.title}><span>{index+1}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></div>)
              : unit.checklist.map((item,index)=><div className="imp-study__requirement" key={item}><span>{index+1}</span>{item}</div>)}</div>
              <div><h4><ClipboardCheck size={18}/> Критерии проверки</h4>
                {authReference ? authorizationCriteria.map((item,index)=><div className="imp-study__requirement" key={item.title}><span>{index+1}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></div>) : <><p>{unit.expected}</p><p>Должны быть продемонстрированы работоспособность, полнота решения и корректность обработки ошибок.</p></>}</div></div>
            {authReference && <div className="imp-study__template">
              <FileCode2 size={30}/><div><strong>Шаблон проекта</strong><p>Базовая структура FastAPI, проверка JWT и подготовленные места для авторизации объектов.</p></div>
              <a href="/bootcamp/templates/security-auth-fastapi-starter.py" download="security-auth-fastapi-starter.py">
                <Download size={17}/> Скачать шаблон
              </a>
            </div>}
            <p className="imp-study__disclaimer">Практическая работа требует отдельной проверки для сертификата подтверждения знаний.</p>
            <form className="imp-study__submission" onSubmit={event => { event.preventDefault(); void submitPractice.mutateAsync(); }}>
              <h4>Отправить практическую работу на проверку</h4>
              <label>Опишите, что сделали и как проверили результат
                <textarea value={practiceDescription} minLength={50} required
                  onChange={event => { setPracticeDescription(event.target.value); }}
                  placeholder="Опишите решение, тестирование и выявленные ограничения (не менее 50 символов)"/>
              </label>
              <label>Ссылка на результат (HTTPS, необязательно)
                <input type="url" value={practiceUrl} pattern="https://.*" placeholder="Ссылка на результат по HTTPS"
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
          </section>}</LessonFrame>
          <LessonFrame key={unit.id + "-check"} unitId={unit.id} kind="check">{() => <section className="imp-study__content" aria-label="Самопроверка"><h3>Проверьте себя</h3>
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
          </section>}</LessonFrame>
          </div>
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
