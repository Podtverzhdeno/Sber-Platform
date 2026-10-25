import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, ChevronRight, Copy, ExternalLink, FileText, Image as ImageIcon, Link2, MoreHorizontal, Plus, Search, UsersRound, X, Bot, MessageSquareText } from "lucide-react";
import type { ApiChannelView, ApiMessageView, ApiParticipantView } from "./contracts";
import { participantRoleLabel } from "./view-model";
import type { DirectoryContact } from "./group-creator";
import "./community-details.scss";

type Tab = "members" | "media" | "files" | "links" | "bots";
const tabs: { id: Tab; label: string }[] = [
  { id: "members", label: "Участники" },
  { id: "media", label: "Медиа" },
  { id: "files", label: "Файлы" },
  { id: "links", label: "Ссылки" },
  { id: "bots", label: "Боты" },
];
const imagePattern = /\.(?:png|jpe?g|gif|webp|svg)(?:[?#]|$)/i;
const safeUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname ? url.href : null;
  } catch { return null; }
};
function initials(name: string) {
  return name.trim().split(/\s+/u).slice(0, 2).map(word => word[0] ?? "").join("").toUpperCase() || "У";
}
function refLabel(ref: string) {
  return ref.split(/[?#]/u)[0]?.split("/").pop() || ref;
}
function collectShared(messages: readonly ApiMessageView[]) {
  const refs = [...new Set(messages.flatMap(message => message.artifact_refs))];
  const urls = [...new Set(messages.flatMap(message =>
    [...message.body.matchAll(/https:\/\/[^\s<>"']+/gu)].map(match => match[0].replace(/[),.!?]+$/u, ""))
  ))].filter(value => safeUrl(value) !== null);
  return { media: refs.filter(ref => imagePattern.test(ref)), files: refs.filter(ref => !imagePattern.test(ref)), links: [...new Set([...urls, ...refs.filter(ref => safeUrl(ref) !== null)])] };
}

export function CommunityDetails({
  channel, viewerId, messages, attachmentRefs = [], contacts, onClose, onToggleMute, onOpenMember, onInvite,
}: {
  channel: ApiChannelView;
  viewerId: string | null;
  messages: readonly ApiMessageView[];
  attachmentRefs?: readonly string[];
  contacts: readonly DirectoryContact[];
  onClose?: () => void;
  onToggleMute?: () => void;
  onOpenMember?: (personId: string) => Promise<void>;
  onInvite?: (ids: string[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("members");
  const [filter, setFilter] = useState("");
  const [profile, setProfile] = useState<ApiParticipantView | null>(null);
  const [more, setMore] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [inviteError, setInviteError] = useState("");
  const dialogClose = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (inviteOpen) dialogClose.current?.focus(); }, [inviteOpen]);
  const participants = [...channel.participants].sort((a,b) => {
    const priority = (person: ApiParticipantView) => ["owner","admin","moderator"].includes(person.role) ? 0 : 1;
    return priority(a) - priority(b) || a.display_name.localeCompare(b.display_name, "ru");
  });
  const visible = participants.filter(person => person.display_name.toLocaleLowerCase("ru").includes(filter.toLocaleLowerCase("ru")));
  const shared = collectShared(messages);
  for (const ref of attachmentRefs) {
    if (imagePattern.test(ref)) { if (!shared.media.includes(ref)) shared.media.push(ref); }
    else if (!shared.files.includes(ref)) shared.files.push(ref);
  }
  const bots = participants.filter(person => person.role === "bot");
  const canInvite = Boolean(onInvite && channel.status === "active" && channel.sender_enabled);
  const eligible = contacts.filter(person =>
    person.id !== viewerId && !channel.participants.some(member => member.id === person.id)
    && person.display_name.toLocaleLowerCase("ru").includes(filter.toLocaleLowerCase("ru"))
  );
  const closeInvite = () => { if (!busy) { setInviteOpen(false); setChosen([]); setInviteError(""); } };
  const doInvite = async () => {
    if (!onInvite || chosen.length === 0) return;
    setBusy(true);setInviteError("");
    try {
      await onInvite(chosen);
      setChosen([]);setInviteOpen(false);setFilter("");setFeedback("Участники добавлены в сообщество");
    } catch (reason) {
      setInviteError(reason instanceof Error ? reason.message : "Не удалось добавить участников");
    } finally {setBusy(false);}
  };
  const copyText = (value: string, success = "Скопировано") => {
    void navigator.clipboard.writeText(value).then(() => {setFeedback(success);})
      .catch(() => {setFeedback("Не удалось скопировать");});
  };
  const openPerson = (person: ApiParticipantView) => {setFeedback("");setProfile(person);};
  const openDialog = () => {setMore(false);setFilter("");setChosen([]);setInviteError("");setInviteOpen(true);};
  return (
    <aside className="msg-context msg-community" id="messenger-context-panel" aria-label="Контекст диалога">
      <header className="msg-community__top">
        <span>О сообществе</span>
        {onClose && <button type="button" aria-label="К чату" title="Закрыть информацию" onClick={onClose}><X size={20}/></button>}
      </header>
      <section className="msg-community__hero" aria-label="Профиль сообщества">
        <div className="msg-community__hero-avatar" aria-hidden="true">
          {channel.title.trim().toLocaleLowerCase("ru") === "маяки" ? <img src="/messages-reference/mayaki-avatar.svg" alt="" /> : initials(channel.title)}
        </div>
        <h2>{channel.title}</h2>
        <p>{channel.participants.length} {channel.participants.length % 10 === 1 && channel.participants.length % 100 !== 11 ? "участник" : [2,3,4].includes(channel.participants.length % 10) && ![12,13,14].includes(channel.participants.length % 100) ? "участника" : "участников"}</p>
        {channel.title.trim().toLocaleLowerCase("ru") === "маяки" && <small>Сообщество для развития, проектов и новых возможностей</small>}
        <div className="msg-community__hero-actions">
          <button type="button" onClick={onToggleMute} disabled={!onToggleMute} aria-pressed={channel.muted}>
            {channel.muted ? <Bell size={18}/> : <BellOff size={18}/>}
            <span>{channel.muted ? "Включить звук" : "Без звука"}</span>
          </button>
          <button type="button" aria-expanded={more} onClick={() => {setMore(value => !value);}}>
            <MoreHorizontal size={20}/><span>Ещё</span>
          </button>
          {more && <div className="msg-community__more" role="menu">
            <button role="menuitem" type="button" onClick={() => {
              copyText((window.location.href.split("?")[0] ?? window.location.href) + "?channel=" + encodeURIComponent(channel.id), "Ссылка на чат скопирована. Доступ есть только у участников");
              setMore(false);
            }}><Copy size={15}/>Скопировать ссылку на чат</button>
            <button role="menuitem" type="button" onClick={() => {setTab("members");setMore(false);}}><UsersRound size={15}/>Открыть участников</button>
          </div>}
        </div>
      </section>
      <div className="msg-community__tabs" role="tablist" aria-label="Материалы и участники сообщества">
        {tabs.map(item => <button key={item.id} type="button" role="tab"
          aria-selected={tab === item.id} onClick={() => {setTab(item.id);setProfile(null);setFilter("");}}
          className={tab === item.id ? "active" : ""}>
          {item.label}
        </button>)}
      </div>
      <div className="msg-community__content" role="tabpanel" aria-label={tabs.find(item=>item.id===tab)?.label}>
        {tab === "members" && <>
          <div className="msg-community__section-head">
            <strong>Участники <span>{channel.participants.length}</span></strong>
          </div>
          {canInvite && <button className="msg-community__add" type="button" onClick={openDialog}><Plus size={20}/>Добавить участников</button>}
          <label className="msg-community__search"><Search size={16}/><input type="search" aria-label="Найти участника" placeholder="Поиск по участникам" value={filter} onChange={event=>{setFilter(event.target.value);}}/></label>
          <ul className="msg-community__members">
            {visible.map((person,index) => <li key={person.id} data-testid="context-participant">
              <button type="button" onClick={() => {openPerson(person);}} aria-label={`Открыть профиль: ${person.display_name}`}>
                <span className={`msg-community__person-avatar tone-${String(index%5)}`} aria-hidden="true">{initials(person.display_name)}</span>
                <span className="msg-community__person-name"><strong>{person.display_name || "Без имени"}</strong>
                  <small>{person.id === viewerId ? "Вы · " : ""}{participantRoleLabel(person.role)}</small>
                </span>
                <ChevronRight size={15} className="msg-community__person-next" aria-hidden="true"/>
              </button>
            </li>)}
          </ul>
          {visible.length === 0 && <p className="msg-community__empty">По вашему запросу участников не найдено</p>}
        </>}
        {tab === "media" && <SharedList refs={shared.media} empty="В переписке пока нет изображений" kind="media" onCopy={copyText}/>}
        {tab === "files" && <SharedList refs={shared.files} empty="В переписке пока нет прикреплённых файлов" kind="files" onCopy={copyText}/>}
        {tab === "links" && <SharedList refs={shared.links} empty="В сообщениях пока нет ссылок" kind="links" onCopy={copyText}/>}
        {tab === "bots" && <>
          <h3 className="msg-community__section-title">Боты сообщества</h3>
          {bots.length ? bots.map(bot => <button type="button" className="msg-community__resource" key={bot.id} onClick={()=>{openPerson(bot);}}><Bot size={19}/><span>{bot.display_name}</span><ChevronRight size={16}/></button>)
            : <p className="msg-community__empty">Боты не подключены. Здесь появятся только участники с ролью бота.</p>}
        </>}
      </div>
      {feedback && <p className="msg-community__feedback" role="status">{feedback}</p>}
      {profile && <div className="msg-community__profile" role="dialog" aria-label={`Профиль участника: ${profile.display_name}`}>
        <button type="button" className="msg-community__profile-close" aria-label="Закрыть профиль" onClick={() => {setProfile(null);}}><X size={18}/></button>
        <span className="msg-community__profile-avatar">{initials(profile.display_name)}</span>
        <h3>{profile.display_name || "Без имени"}</h3>
        <p>{participantRoleLabel(profile.role)}{profile.id === viewerId ? " · это вы" : ""}</p>
        <small>Данные о присутствии в сети недоступны</small>
        <div className="msg-community__profile-actions">
          {profile.id !== viewerId && onOpenMember && <button type="button" disabled={busy} onClick={() => {
            setBusy(true);setFeedback("");
            void onOpenMember(profile.id).then(()=>{setProfile(null);})
              .catch(()=>{setFeedback("Не удалось открыть личный чат");})
              .finally(()=>{setBusy(false);});
          }}><MessageSquareText size={17}/>Написать</button>}
          <button type="button" onClick={() => {copyText(profile.id, "Идентификатор скопирован");}}><Copy size={16}/>Скопировать ID</button>
        </div>
      </div>}
      {inviteOpen && <div className="msg-community__layer">
        <button type="button" className="msg-community__backdrop" aria-label="Отменить приглашение" onClick={() => {closeInvite();}}/>
        <section className="msg-community__invite" role="dialog" aria-modal="true" aria-label="Добавить участников" onKeyDown={event => {if(event.key==="Escape")closeInvite();}}>
          <header><strong>Добавить участников</strong><button type="button" ref={dialogClose} aria-label="Закрыть" disabled={busy} onClick={closeInvite}><X size={19}/></button></header>
          <p>Выберите коллег из вашей программы, которые ещё не состоят в сообществе.</p>
          <label className="msg-community__search"><Search size={16}/><input type="search" placeholder="Поиск контактов" aria-label="Поиск контактов" value={filter} onChange={event=>{setFilter(event.target.value);}}/></label>
          <div className="msg-community__invites">
            {eligible.map(person=><label key={person.id}><input type="checkbox" checked={chosen.includes(person.id)} onChange={event=>{setChosen(current=>event.target.checked?[...current,person.id]:current.filter(id=>id!==person.id));}}/><span className="msg-community__person-avatar">{initials(person.display_name)}</span><span>{person.display_name}<small>{person.role}</small></span></label>)}
            {!eligible.length && <p className="msg-community__empty">Нет подходящих контактов для добавления</p>}
          </div>
          {inviteError && <p role="alert">{inviteError}</p>}
          <footer><button type="button" disabled={busy} onClick={closeInvite}>Отмена</button><button type="button" disabled={busy || !chosen.length} onClick={()=>{void doInvite();}}>{busy?"Добавляем…":`Добавить (${String(chosen.length)})`}</button></footer>
        </section>
      </div>}
    </aside>
  );
}

function SharedList({ refs, empty, kind, onCopy }: {
  refs: string[]; empty: string; kind: "files"|"media"|"links"; onCopy: (value:string)=>void;
}) {
  return <>
    <h3 className="msg-community__section-title">{kind==="media"?"Медиа":kind==="files"?"Файлы":"Ссылки"} <span>{refs.length}</span></h3>
    {refs.length ? <ul className="msg-community__resources">{refs.map(ref=>{
      const url=safeUrl(ref);
      const Icon=kind==="media"?ImageIcon:kind==="links"?Link2:FileText;
      return <li key={ref}>
        <span className="msg-community__resource-icon"><Icon size={19}/></span>
        <span className="msg-community__resource-text" title={ref}><strong>{kind==="links"?ref:refLabel(ref)}</strong><small>{url?"Внешняя ссылка":"Идентификатор вложения"}</small></span>
        {url?<a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть ${refLabel(ref)}`}><ExternalLink size={17}/></a>
          :<button type="button" aria-label={`Скопировать ${refLabel(ref)}`} onClick={()=>{onCopy(ref);}}><Copy size={17}/></button>}
      </li>;
    })}</ul> : <p className="msg-community__empty">{empty}</p>}
  </>;
}
