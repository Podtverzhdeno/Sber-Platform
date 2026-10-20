import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api/client";
import { Badge, StatePanel } from "../components/ui";
import "./customer-candidates.css";

type Task = {
  id: string;
  title: string;
  status: string;
  mode: "open" | "invitation_only";
  competency_tags: string[];
  places?: number;
};
type TeamRequest = {
  id: string;
  version: number;
  title: string;
  required_tags: string[];
  preferred_tags: string[];
  relevant_case_task_ids: string[];
};
type CandidateMatch = {
  person_id: string;
  display_name: string;
  request_version: number;
  matched_required: string[];
  matched_preferred: string[];
  evidence: {
    task_id: string;
    contribution_id: string;
    personal_summary: string;
    competency_tags: string[];
    artifact_keys: string[];
  }[];
};
type SavedCandidate = { id: string; request_id: string; person_id: string; created_at: string; match: CandidateMatch };

const csrfHeaders = (): HeadersInit => ({ "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" });
const tags = (value: string) => value.split(",").map((tag) => tag.trim()).filter(Boolean);

export function CustomerCandidates() {
  const client = useQueryClient();
  const tasks = useQuery({ queryKey: ["customer-tasks"], queryFn: () => apiRequest<Task[]>("/api/v1/customer/tasks") });
  const cases = useQuery({ queryKey: ["customer-case-catalog"], queryFn: () => apiRequest<Task[]>("/api/v1/customer/cases") });
  const [title, setTitle] = useState("");
  const [required, setRequired] = useState("");
  const [preferred, setPreferred] = useState("");
  const [caseTaskId, setCaseTaskId] = useState("");
  const [targetTaskId, setTargetTaskId] = useState("");
  const [request, setRequest] = useState<TeamRequest | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [unselected, setUnselected] = useState<Record<string, boolean>>({});
  const matches = useQuery({
    queryKey: ["customer-matches", request?.id],
    enabled: request !== null,
    queryFn: () => apiRequest<CandidateMatch[]>(`/api/v1/customer/team-requests/${request?.id ?? ""}/matches`),
    refetchOnMount: "always",
  });
  const savedCandidates = useQuery({ queryKey: ["customer-saved-candidates"], queryFn: () => apiRequest<SavedCandidate[]>("/api/v1/customer/saved-candidates"), refetchOnMount: "always" });
  const createRequest = useMutation({
    mutationFn: () => apiRequest<TeamRequest>("/api/v1/customer/team-requests", {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify({
        title,
        required_tags: tags(required),
        preferred_tags: tags(preferred),
        relevant_case_task_ids: [caseTaskId],
      }),
    }),
    onSuccess: async (saved) => {
      setRequest(saved);
      setNotice(`Запрос команды сохранён, версия ${String(saved.version)}.`);
      setUnselected({});
      setSearch("");
      await client.invalidateQueries({ queryKey: ["customer-matches"] });
    },
  });
  const invite = useMutation({
    mutationFn: ({ personId, evidenceId }: { personId: string; evidenceId: string }) => apiRequest(`/api/v1/customer/tasks/${targetTaskId}/invitations`, {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify({ person_id: personId, evidence_contribution_id: evidenceId, request_id: request?.id }),
    }),
    onSuccess: () => { setNotice("Приглашение отправлено. Участник увидит условия задачи."); },
  });
  const inviteSelected = useMutation({
    mutationFn: async (candidates: { personId: string; evidenceId: string }[]) => {
      for (const target of candidates) await invite.mutateAsync(target);
    },
    onSuccess: async () => {
      setNotice("Приглашения отправлены. Участники увидят условия задачи и решат сами.");
      await client.invalidateQueries({ queryKey: ["customer-matches"] });
    },
  });
  const saveCandidate = useMutation({
    mutationFn: (personId: string) => apiRequest(`/api/v1/customer/team-requests/${request?.id ?? ""}/saved/${personId}`, { method: "POST", headers: csrfHeaders() }),
    onSuccess: async () => { setNotice("Кандидат сохранён в резерве."); await client.invalidateQueries({ queryKey: ["customer-saved-candidates"] }); },
  });

  const allMatches = matches.data ?? [];
  const visibleMatches = allMatches.filter((candidate) => {
    const query = search.trim().toLowerCase();
    if (query === "") return true;
    return candidate.display_name.toLowerCase().includes(query)
      || candidate.matched_required.some((tag) => tag.toLowerCase().includes(query))
      || candidate.matched_preferred.some((tag) => tag.toLowerCase().includes(query));
  });
  const selectedMatches = allMatches.filter((candidate) => !(unselected[candidate.person_id] ?? false));
  const targetTask = tasks.data?.find((task) => task.id === targetTaskId) ?? null;
  const placesLimit = targetTask?.places ?? null;
  const overLimit = placesLimit !== null && selectedMatches.length > placesLimit;
  const missingEvidence = selectedMatches.filter((candidate) => !candidate.evidence[0]?.contribution_id).length;
  const selectionBlocked = targetTaskId === "" || placesLimit === 0 || overLimit || missingEvidence > 0;

  if (tasks.isLoading || cases.isLoading) return <StatePanel kind="loading" />;
  if (!tasks.data || tasks.isError || !cases.data || cases.isError) return <StatePanel kind="error" action="Повторить" onAction={() => { void tasks.refetch(); void cases.refetch(); }} />;

  const caseTasks = cases.data;
  const closedTasks = tasks.data.filter((task) => task.status === "published" && task.mode === "invitation_only");
  return <div className="feature-stack customer-candidates">
    <header className="dashboard-heading"><div><p className="eyebrow">Заказчик · база участников</p><h1 id="workspace-title">Подбор по подтверждённым кейсам</h1><p className="lead">Укажите навыки и кейс, в котором участник уже подтвердил личный вклад. Подборка ограничена десятью людьми с действующим согласием.</p></div></header>
    <section className="task-wizard" aria-labelledby="team-request-title"><h2 id="team-request-title">Запрос команды</h2>
      {caseTasks.length === 0 ? <p>Опубликуйте хотя бы один кейс с тегами компетенций, чтобы начать подбор.</p> : <form className="wizard-form" onSubmit={(event) => { event.preventDefault(); createRequest.mutate(); }}>
        <label className="span-2">Задача команды<input required value={title} onChange={(event) => { setTitle(event.target.value); }} /></label>
        <label>Обязательные навыки через запятую<input required value={required} onChange={(event) => { setRequired(event.target.value); }} /></label>
        <label>Желательные навыки через запятую<input value={preferred} onChange={(event) => { setPreferred(event.target.value); }} /></label>
        <label>Релевантный завершённый кейс<select required value={caseTaskId} onChange={(event) => { setCaseTaskId(event.target.value); }}><option value="">Выберите кейс</option>{caseTasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {task.competency_tags.join(", ")}</option>)}</select></label>
        <div className="wizard-actions span-2"><button type="submit" disabled={createRequest.isPending || tags(required).length === 0}>Показать кандидатов</button></div>
      </form>}
      {createRequest.isError && <p role="alert">Не удалось сохранить запрос команды. Проверьте критерии и кейс.</p>}
    </section>
    {request && <section className="customer-task-list" aria-labelledby="matches-title"><header><div><p className="eyebrow">Запрос версии {request.version}</p><h2 id="matches-title">Подходящие участники</h2></div><Badge>{selectedMatches.length} выбрано</Badge></header>
      <section className="candidate-summary" aria-label="Выбор адресатов" data-testid="candidate-summary">
        <label className="candidate-search" htmlFor="candidate-search-input">Поиск кандидата<input id="candidate-search-input" value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Имя или навык" /></label>
        {closedTasks.length > 0 && <label className="candidate-search">Закрытая задача для приглашения<select required value={targetTaskId} onChange={(event) => { setTargetTaskId(event.target.value); }}><option value="">Выберите задачу</option>{closedTasks.map((task) => <option key={task.id} value={task.id}>{task.title} · мест {String(task.places ?? "?")}</option>)}</select></label>}
        <p data-testid="selection-count">Адресаты к приглашению: {selectedMatches.length} из {allMatches.length}. Основание выбора: принятый релевантный кейс и действующее согласие участника.</p>
        {targetTask && <p>Задача приглашения: {targetTask.title} · мест {String(targetTask.places ?? "?")}. Приглашение не назначает участие — участник сам принимает условия задачи.</p>}
        {overLimit && <p role="alert" data-testid="invitation-blocked">Правило приглашений: выбрано больше адресатов, чем мест ({String(placesLimit)}). Сократите выбор или измените условия задачи — выбор не удаляется автоматически.</p>}
        {missingEvidence > 0 && <p role="alert" data-testid="invitation-missing-evidence">У {String(missingEvidence)} выбранных адресатов нет доступных доказательств принятого вклада. Приглашайте по одному или выберите кандидата с кейсом.</p>}
        <div className="row-actions">
          <button type="button" className="secondary-button" data-testid="invite-selected" disabled={selectionBlocked || selectedMatches.length === 0 || inviteSelected.isPending} onClick={() => { void inviteSelected.mutateAsync(selectedMatches.map((candidate) => { const evidence = candidate.evidence[0]; if (!evidence) throw new Error("evidence missing"); return { personId: candidate.person_id, evidenceId: evidence.contribution_id }; })); }}>Отправить приглашения ({selectedMatches.length})</button>
          <button type="button" className="secondary-button" data-testid="save-selected" disabled={selectedMatches.length === 0 || saveCandidate.isPending} onClick={() => { for (const candidate of selectedMatches) saveCandidate.mutate(candidate.person_id); }}>Сохранить выбранных в резерв</button>
        </div>
      </section>
      {matches.isLoading && <StatePanel kind="loading" />}{matches.isError && <StatePanel kind="error" action="Повторить" onAction={() => { void matches.refetch(); }} />}
      {matches.data?.length === 0 && <p>По этим критериям пока нет участников с принятым вкладом и разрешёнными доказательствами.</p>}
      {visibleMatches.length === 0 && matches.data && matches.data.length > 0 && <p>Под этот поиск кандидатов нет: показать всех адресатов можно очистив поле поиска.</p>}
      {visibleMatches.map((candidate) => { const isSelected = !(unselected[candidate.person_id] ?? false); const evidenceId = candidate.evidence[0]?.contribution_id; return <article className="customer-task-row candidate-row" key={candidate.person_id}>
        <label className="candidate-select" title="Выбрать адресата">
          <input type="checkbox" className="candidate-select-input" checked={isSelected} aria-label={`Выбрать адресата ${candidate.display_name}`} onChange={(event) => { setUnselected({ ...unselected, [candidate.person_id]: !event.target.checked }); }} />
          <span aria-hidden="true" className={isSelected ? "candidate-mark candidate-mark--on" : "candidate-mark"}>{isSelected ? "✓" : ""}</span>
        </label>
        <div>
          <strong>{candidate.display_name}</strong>
          <small>Подтверждено: {candidate.matched_required.join(", ")}; дополнительно: {candidate.matched_preferred.join(", ") || "нет"}</small>
          <small>Причина совпадения: обязательные навыки {candidate.matched_required.join(", ")} совпали с принятым вкладом. Согласие участника действительно — подбор показывает только кандидатов с действующими согласиями.</small>
          {candidate.evidence.map((evidence) => <p key={evidence.contribution_id}>{caseTasks.find((caseTask) => caseTask.id === evidence.task_id)?.title ?? "Завершённый кейс"}: {evidence.personal_summary} · доказательства: {evidence.artifact_keys.join(", ")}</p>)}
        </div>
        <div className="row-actions">
          <button type="button" className="secondary-button" disabled={saveCandidate.isPending} onClick={() => { saveCandidate.mutate(candidate.person_id); }}>Сохранить в резерв</button>
          <button type="button" disabled={!targetTaskId || invite.isPending} onClick={() => { if (evidenceId) invite.mutate({ personId: candidate.person_id, evidenceId }); }}>Пригласить в задачу</button>
        </div>
      </article>; })}
      {invite.isError && <p role="alert">Приглашение не отправлено: проверьте согласие кандидата и условия задачи.</p>}
      {inviteSelected.isError && <p role="alert">Часть приглашений не отправлена: проверьте согласие и условия каждой задачи и повторите.</p>}
      {saveCandidate.isError && <p role="alert">Не удалось сохранить кандидата.</p>}
    </section>}
    <section className="customer-task-list" aria-labelledby="reserve-title"><header><h2 id="reserve-title">Кадровый резерв</h2></header>{savedCandidates.isLoading && <StatePanel kind="loading" />}{savedCandidates.isError && <StatePanel kind="error" action="Повторить" onAction={() => { void savedCandidates.refetch(); }} />}{savedCandidates.data?.length === 0 && <p>Пока нет сохранённых кандидатов.</p>}{savedCandidates.data?.map((item) => <article className="customer-task-row" key={item.id}><div><strong>{item.match.display_name}</strong><small>Подтверждено: {item.match.matched_required.join(", ")}</small></div><Badge>В резерве</Badge></article>)}</section>
    {notice && <p role="status">{notice}</p>}
  </div>;
}
