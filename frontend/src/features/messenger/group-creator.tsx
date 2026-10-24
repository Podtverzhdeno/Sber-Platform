import { useEffect, useRef, useState } from "react";
import { UsersRound, X } from "lucide-react";

export type DirectoryContact = { id: string; display_name: string; role: string };

export function GroupCreator({
  contacts, onCreate, onClose,
}: {
  contacts: readonly DirectoryContact[];
  onCreate: (title: string, ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const submit = async () => {
    if (name.trim().length < 2 || chosen.length < 1) {
      setError("Укажите название и выберите хотя бы одного участника.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate(name.trim(), chosen);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать группу.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="msg-group-layer">
      <button className="msg-group-backdrop" type="button" aria-label="Закрыть создание группы" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="group-dialog-title" className="msg-group-dialog" onKeyDown={(event) => {
        if (event.key === "Escape") {event.preventDefault(); onClose();}
        if (event.key === "Tab") {
          const focusables = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
          else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
        }
      }}>
        <header>
          <span><UsersRound size={21} aria-hidden="true" /> <strong id="group-dialog-title">Создать групповой чат</strong></span>
          <button type="button" aria-label="Закрыть" onClick={onClose} ref={closeRef}><X size={20}/></button>
        </header>
        <label className="msg-group-label">Название группы
          <input value={name} maxLength={120} onChange={(event)=>{setName(event.target.value);}} placeholder="Например, Команда AI-проекта" />
        </label>
        <fieldset>
          <legend>Добавить участников ({chosen.length})</legend>
          <div className="msg-group-contacts">
            {contacts.length ? contacts.map((person) => (
              <label key={person.id} className="msg-group-contact">
                <input type="checkbox" checked={chosen.includes(person.id)}
                  onChange={(event) => {
                    setChosen((current) => event.target.checked
                      ? [...current, person.id]
                      : current.filter((id) => id !== person.id));
                  }} />
                <span className="msg-group-contact-avatar">{person.display_name.trim().slice(0, 1)}</span>
                <span>{person.display_name}<small>{person.role}</small></span>
              </label>
            )) : <p>Нет доступных контактов. Проверьте подключение к справочнику.</p>}
          </div>
        </fieldset>
        {error && <p role="alert" className="msg-group-error">{error}</p>}
        <footer>
          <button type="button" onClick={onClose} disabled={busy}>Отмена</button>
          <button type="button" onClick={() => {void submit();}} disabled={busy || chosen.length === 0 || name.trim().length < 2}>
            {busy ? "Создаём…" : "Создать чат"}
          </button>
        </footer>
      </section>
    </div>
  );
}
