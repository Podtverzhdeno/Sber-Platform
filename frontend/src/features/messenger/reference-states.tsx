import { ArrowRight, Folder, MessageCircleMore, MessagesSquare, Plus, Search, Settings, Users } from "lucide-react";

import type { ApiChannelView } from "./contracts";

export function EmptyChatState({
  recent,
  mayaki,
  onOpen,
  onCreate,
  onFindCommunity,
}: {
  recent: ApiChannelView | null;
  mayaki: ApiChannelView | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onFindCommunity: () => void;
}) {
  const openMayaki = () => {
    if (mayaki !== null) onOpen(mayaki.id);
    else onFindCommunity();
  };
  return (
    <section className="msg-reference-empty" aria-label="Выберите диалог">
      <div className="msg-reference-empty__orbit" aria-hidden="true">
        <span className="msg-reference-empty__orbit-ring one" />
        <span className="msg-reference-empty__orbit-ring two" />
        <span className="msg-reference-empty__sparkle s1">✦</span>
        <span className="msg-reference-empty__sparkle s2">✧</span>
        <span className="msg-reference-empty__sparkle s3">✦</span>
        <span className="msg-reference-empty__sparkle s4">✧</span>
        <span className="msg-reference-empty__bubble back"><span /></span>
        <span className="msg-reference-empty__bubble front"><i/><i/><i/></span>
      </div>
      <h2>Выберите диалог или сообщество</h2>
      <p>Слева вы можете открыть личный чат,<br/> рабочую группу или сообщество</p>
      <div className="msg-reference-empty__actions">
        <button type="button" onClick={() => {if (recent !== null) onOpen(recent.id); else onCreate();}}>
          <span className="msg-reference-empty__action-icon">{recent ? (recent.title?.[0] ?? "Ч") : <MessageCircleMore size={22}/>}</span>
          <span><strong>{recent ? "Открыть последний чат" : "Начать общение"}</strong><small>{recent?.title ?? "Контакты и доступные диалоги"}</small></span>
          <ArrowRight size={19} />
        </button>
        <button type="button" className="community" onClick={openMayaki}>
          <span className="msg-reference-empty__action-icon blue">{mayaki ? <img src="/messages-reference/mayaki-avatar.webp" alt="" /> : <Search size={21}/>}</span>
          <span><strong>{mayaki ? "Перейти в Маяки" : "Найти Маяки"}</strong><small>{mayaki ? "Сообщество" : "Поиск среди доступных сообществ"}</small></span>
          <ArrowRight size={19}/>
        </button>
        <button type="button" className="new" onClick={onCreate}>
          <span className="msg-reference-empty__action-icon green"><Plus size={26}/></span>
          <span><strong>Создать новый чат</strong><small>Начните общение с коллегами</small></span>
          <ArrowRight size={19}/>
        </button>
      </div>
    </section>
  );
}

const placeholderBlocks = [
  { label: "Участники", icon: Users },
  { label: "Связанные объекты", icon: Folder },
  { label: "Общие файлы", icon: MessagesSquare },
  { label: "Настройки чата", icon: Settings },
];

export function EmptyContextPlaceholder() {
  return (
    <aside className="msg-reference-context-empty" aria-label="Контекст диалога">
      <header>Контекст</header>
      <div className="msg-reference-context-empty__inner">
        <div className="msg-reference-context-empty__symbol" aria-hidden="true">
          <MessagesSquare size={68} strokeWidth={1.2}/>
          <span>i</span>
        </div>
        <h2>Здесь появится контекст диалога</h2>
        <p>Выберите чат или сообщество, чтобы увидеть информацию о нём: участников, связанные задачи и проекты, общие файлы и другие детали.</p>
        <div className="msg-reference-context-empty__blocks">
          {placeholderBlocks.map(({label,icon:Icon}) => (
            <section key={label} aria-label={label}>
              <Icon size={25} strokeWidth={1.8} aria-hidden="true"/>
              <div><strong>{label}</strong><i/><i/></div>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
