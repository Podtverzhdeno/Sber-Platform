import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { apiRequest, type RuntimeApiPath } from "../../api/client";
import type { components } from "../../api/schema";
import { Modal, StatePanel } from "../../components/ui";
import { BootcampPage, type BootcampOverview, type CatalogToolbarState } from "./page";
import { CourseLearningContent } from "./learning-content/CourseLearningContent";
import { LearningProgressPanel } from "../learning-progress-panel";
import { parseBootcampUrl } from "./urlState";
import "./bootcamp-approved.scss";

type CourseDetail = components["schemas"]["CourseDetail"];

const OVERVIEW_PATH = "/api/v1/me/bootcamp/overview" as const;

function selectedCourses(overview: BootcampOverview, state: CatalogToolbarState) {
  const query = state.query.trim().toLocaleLowerCase("ru-RU");
  return overview.courses.filter((course) => {
    const role = course.role_contexts.find((item) => item.track_key === overview.selected_track_key);
    if (state.relevance === "relevant" && (
      !role?.relevant || course.card.access_state !== "available" || course.freshness.stale
    )) return false;
    if (state.category === "role" && !role?.relevant) return false;
    if (state.category === "progress" && !["in_progress", "reported"].includes(course.card.completion_state)) return false;
    if (state.category === "completed" && course.card.completion_state !== "verified") return false;
    if (state.track !== "all" && !course.card.track_keys.includes(state.track)) return false;
    // No versioned difficulty classification is published yet. An unknown
    // level must never match a client-invented level.
    if (state.level !== "all") return false;
    return query === "" || course.card.title.toLocaleLowerCase("ru-RU").includes(query);
  });
}

export function BootcampV2Route() {
  const [params, setParams] = useSearchParams();
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const state = parseBootcampUrl(params);
  const track = state.track !== "all" ? state.track : null;
  const query = useQuery({
    queryKey: ["bootcamp-v2-overview", track],
    queryFn: () => apiRequest<BootcampOverview>(
      track ? `${OVERVIEW_PATH}?track=${encodeURIComponent(track)}` as RuntimeApiPath : OVERVIEW_PATH,
    ),
  });
  const courseKey = state.course;
  const detail = useQuery({
    queryKey: ["bootcamp-v2-detail", courseKey, query.data?.snapshot_version],
    queryFn: () => apiRequest<CourseDetail>(`/api/v1/me/bootcamp/courses/${encodeURIComponent(courseKey ?? "")}`),
    enabled: courseKey !== null && query.data !== undefined,
  });
  const toolbar: CatalogToolbarState = {
    relevance: state.relevance === "relevant" ? "relevant" : "all",
    category: state.category ?? "all",
    query: state.q ?? "",
    track: state.track,
    level: state.level ?? "all",
    view: state.view,
  };
  const visibleCourses = query.data ? selectedCourses(query.data, toolbar) : [];
  const editUrl = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || value === "all" || (key === "view" && value === "card")) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    next.set("v2", "1");
    setParams(next);
  };
  const closeOverlay = () => {
    if (requirementsOpen) setRequirementsOpen(false);
    if (courseKey !== null) editUrl({ course: null });
  };
  const classic = () => {
    const next = new URLSearchParams(params);
    next.delete("v2");
    next.delete("course");
    setParams(next);
  };

  if (query.isPending) return <section className="bootcamp-v2-boundary"><h1 id="workspace-title">Bootcamp</h1><StatePanel kind="loading" /></section>;
  if (query.isError) return (
    <section className="bootcamp-v2-boundary" role="status">
      <h1 id="workspace-title">Bootcamp · новый интерфейс</h1>
      <p>Опубликованные версии курсов и серверный обзор для новой страницы пока недоступны. Прогресс и грейды не подменяются демоданными.</p>
      <button type="button" onClick={() => { void query.refetch(); }}>Проверить снова</button>
      <button type="button" onClick={classic}>Открыть действующий Bootcamp</button>
    </section>
  );

  return (
    <section className="bootcamp-v2-boundary">
      <div aria-label="Версии Bootcamp"><button type="button" onClick={classic}>Действующий каталог</button></div>
      <LearningProgressPanel bootcampIndex={2} compact />
      <BootcampPage
        overview={query.data}
        visibleCourses={visibleCourses}
        view={toolbar.view}
        onViewChange={(view) => { editUrl({ view }); }}
        onRoleChange={(trackKey) => { editUrl({ track: trackKey, course: null }); }}
        onContinue={(key) => { editUrl({ course: key }); }}
        onOpenCourse={(key) => { editUrl({ course: key }); }}
        onOpenRequirements={() => { setRequirementsOpen(true); }}
        toolbarState={toolbar}
        onToolbarChange={(change) => {
          editUrl({
            ...(change.relevance !== undefined ? { relevance: change.relevance } : {}),
            ...(change.category !== undefined ? { category: change.category } : {}),
            ...(change.query !== undefined ? { q: change.query } : {}),
            ...(change.track !== undefined ? { track: change.track } : {}),
            ...(change.level !== undefined ? { level: change.level } : {}),
            ...(change.view !== undefined ? { view: change.view } : {}),
          });
        }}
        onToolbarReset={() => { editUrl({ relevance: "all", category: null, q: null, level: null }); }}
      />
      <Modal title="Требования к следующему грейду" open={requirementsOpen} onClose={closeOverlay}>
        {query.data.curriculum.state !== "known" ? (
          <p role="status">{query.data.curriculum.unavailable_reason}</p>
        ) : (
          <ul>{query.data.curriculum.requirements.map((requirement) => (
            <li key={requirement.key}>
              <strong>{requirement.title}</strong> · {requirement.state} · {requirement.kind}
            </li>
          ))}</ul>
        )}
      </Modal>
      <Modal title="Детали курса" open={courseKey !== null} onClose={closeOverlay}>
        {detail.isPending && <p role="status">Загружаем проверенную программу курса…</p>}
        {detail.isError && <p role="alert">Не удалось получить опубликованную программу курса.</p>}
        {detail.data && (detail.data.state !== "known" ? (
          <p role="status">{detail.data.unavailable_reason}</p>
        ) : (
          <div>
            <h3>{detail.data.title}</h3>
            <p>{detail.data.outcome}</p>
            <h4>Программа</h4>
            <ol>{detail.data.modules.map((module) => <li key={module.key}>{module.title}</li>)}</ol>
            <h4>Требования к подтверждению</h4>
            <ul>{detail.data.evidence_requirements.map((item) => <li key={item.key}>{item.title}</li>)}</ul>
            <p>{detail.data.reviews_unavailable_reason}</p>
          </div>
        ))}
        {courseKey !== null && <CourseLearningContent
          key={courseKey}
          courseKey={courseKey}
          courseTitle={query.data.courses.find(item => item.card.key === courseKey)?.card.title}
          sourceUrl={query.data.courses.find(item => item.card.key === courseKey)?.card.source_url}
        />}
      </Modal>
    </section>
  );
}
