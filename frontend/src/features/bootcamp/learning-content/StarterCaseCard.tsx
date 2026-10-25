import { ArrowUpRight, BookOpenCheck, ClipboardCheck, Code2, ShieldAlert } from "lucide-react";
import { starterCaseFor } from "./starter-cases";
import "./starter-case.scss";

export function StarterCaseCard({ courseKey, unitTitle }: { courseKey: string; unitTitle: string }) {
  const lab = starterCaseFor(courseKey);
  if (!lab) return null;
  return <details className="starter-case" data-testid="course-starter-case">
    <summary><span className="starter-case__icon"><Code2 size={18}/></span>
      <span><strong>Сквозной кейс: попробуйте на тестовых данных</strong><small>Готовый контекст и исходный пример для применения темы «{unitTitle}»</small></span>
      <span className="starter-case__badge">Развернуть</span>
    </summary>
    <div className="starter-case__body">
      <p>{lab.scenario}</p>
      <div className="starter-case__head"><Code2 size={16}/><strong>{lab.starterLabel}</strong><span>Учебный пример</span></div>
      <pre><code>{lab.starter}</code></pre>
      <h5><ClipboardCheck size={17}/> Как проверить результат</h5>
      <ol>{lab.checkpoints.map(item=><li key={item}>{item}</li>)}</ol>
      <div className="starter-case__warning"><ShieldAlert size={17}/><p><strong>Типичная ошибка</strong> {lab.commonPitfall}</p></div>
      <div className="starter-case__source"><BookOpenCheck size={17}/><span>Принцип в первоисточнике:</span> <a href={lab.reference.url} target="_blank" rel="noopener noreferrer">{lab.reference.label} <ArrowUpRight size={14}/></a></div>
      <small className="starter-case__note">Материал Impulse — самостоятельный учебный пример. Код или документ нужно выполнить и проверить в собственной безопасной среде: интерфейс не запускает его и не ставит оценку автоматически.</small>
    </div>
  </details>;
}
