import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Flame,
  Layers3,
  Moon,
  MoonStar,
  Play,
  Search,
  Sun,
  TrendingUp,
} from "lucide-react";
import { nextImpulseVisualMode, type ImpulseVisualMode } from "./visual-modes";
import "./impulse-pixel-reference.scss";

export interface PixelSearchResult {
  readonly id: string;
  readonly title: string;
  readonly context?: string;
}

export interface PixelHomeModel {
  readonly roleTitle: string | null;
  /** The current module track may differ from the selected career role. */
  readonly moduleTrackTitle?: string | null;
  readonly nextTitle: string | null;
  readonly nextKind: "course" | "task" | "trajectory";
  readonly nextState: string;
  readonly nextDescription?: string | null;
  readonly nextActionText: string;
  readonly moduleProgress?: { readonly complete: number; readonly total: number } | null;
  readonly level: number | null;
  readonly nextLevel: number | null;
  readonly completedCourses: number | null;
  readonly requiredCourses: number | null;
  readonly activeTaskCount: number;
  readonly confirmedSkills: number | null;
  readonly requirementsSummary?: string | null;
  readonly weekSummary?: string | null;
  readonly toolsSummary?: string | null;
}

export interface ImpulsePixelReferenceProps {
  readonly mode: ImpulseVisualMode;
  readonly onModeChange: (next: ImpulseVisualMode) => void;
  readonly displayName: string;
  readonly roleName: string;
  readonly avatarUrl?: string | null;
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly searchResults: readonly PixelSearchResult[];
  readonly onSearchSelect: (id: string) => void;
  readonly streakDays?: number | null;
  readonly unreadNotifications?: number;
  readonly onOpenStreak?: () => void;
  readonly onOpenNotifications: () => void;
  readonly onOpenNavigation: () => void;
  readonly onOpenJourney: () => void;
  readonly onContinue: () => void;
  readonly onOpenRequirements: () => void;
  readonly onOpenTasks: () => void;
  readonly onOpenTools: () => void;
  readonly onOpenRanking?: () => void;
  readonly onOpenHelp?: () => void;
  readonly onOpenProfile?: () => void;
  readonly onLogout?: () => void;
  readonly home: PixelHomeModel;
}

/**
 * Reference-quality UI composed only of real values and supplied actions.
 * Callbacks MUST be wired to existing App queries/routing by the integration
 * owner; this module intentionally does not query, mutate or fabricate data.
 */
export function ImpulsePixelReference({
  mode, onModeChange, displayName, roleName, avatarUrl,
  search, onSearchChange, searchResults, onSearchSelect,
  streakDays, unreadNotifications = 0, onOpenStreak,
  onOpenNotifications, onOpenNavigation, onOpenJourney,
  onContinue, onOpenRequirements, onOpenTasks, onOpenTools,
  onOpenRanking, onOpenHelp, onOpenProfile, onLogout, home,
}: ImpulsePixelReferenceProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const progress = home.moduleProgress;
  const modulePercent = progress && progress.total > 0
    ? Math.min(100, Math.max(0, Math.round(progress.complete / progress.total * 100))) : null;
  const coursePercent = home.requiredCourses !== null && home.requiredCourses > 0 && home.completedCourses !== null
    ? Math.min(100, Math.max(0, Math.round(home.completedCourses / home.requiredCourses * 100))) : null;
  const levelLabel = home.level === null ? "—" : `L${String(home.level)}`;
  const nextLevelLabel = home.nextLevel === null ? "—" : `L${String(home.nextLevel)}`;

  return (
    <div className="impulse-pixel" data-visual-mode={mode} data-testid="impulse-pixel-reference">
      <div className="impulse-pixel__wallpaper" aria-hidden="true" />
      <header className="impulse-pixel__topbar">
        <button type="button" className="impulse-pixel__brand" onClick={onOpenNavigation}
          aria-label="Открыть навигацию">
          <span className="impulse-pixel__star" aria-hidden="true">✦</span>
          <span>Impulse</span>
        </button>
        <div className="impulse-pixel__search">
          <Search size={21} aria-hidden="true" />
          <input ref={searchRef} aria-label="Поиск по платформе" type="search"
            value={search} onChange={(event) => { onSearchChange(event.target.value); setSearchOpen(true); }}
            onFocus={() => { setSearchOpen(true); }}
            placeholder="Поиск по задачам, навыкам, проектам…" autoComplete="off" />
          <kbd aria-hidden="true">⌘ K</kbd>
          {searchOpen && search.trim().length > 0 && (
            <div className="impulse-pixel__search-results" role="listbox" aria-label="Результаты поиска">
              {searchResults.length > 0 ? searchResults.map((result) => (
                <button type="button" role="option" key={result.id}
                  onClick={() => { setSearchOpen(false); onSearchSelect(result.id); }}>
                  <strong>{result.title}</strong><small>{result.context ?? ""}</small>
                </button>
              )) : <p>Ничего не найдено</p>}
            </div>
          )}
        </div>
        <div className="impulse-pixel__utilities">
          <button type="button" className={`impulse-pixel__icon-btn impulse-pixel__theme--${mode}`}
            aria-label={`Тема оформления: ${mode === "light" ? "солнце" : mode === "blue" ? "синяя луна" : "тёмная луна"}. Сменить тему`}
            title="Сменить тему" onClick={() => { onModeChange(nextImpulseVisualMode(mode)); }}>
            {mode === "light" ? <Sun size={21} aria-hidden="true" /> :
              mode === "blue" ? <Moon size={21} aria-hidden="true" /> :
                <MoonStar size={21} aria-hidden="true" />}
          </button>
          {streakDays !== undefined && streakDays !== null &&
            <button type="button" className="impulse-pixel__streak" onClick={onOpenStreak}
              disabled={!onOpenStreak} aria-label={`Серия активности: ${String(streakDays)} дней`}>
              <Flame size={18} aria-hidden="true" /><strong>{streakDays}</strong>
            </button>}
          <button type="button" className="impulse-pixel__icon-btn impulse-pixel__notification"
            aria-label={`Уведомления: ${String(unreadNotifications)} непрочитанных`}
            onClick={onOpenNotifications}>
            <Bell size={21} aria-hidden="true" />
            {unreadNotifications > 0 && <span className="impulse-pixel__unread" aria-hidden="true" />}
          </button>
          <div className="impulse-pixel__utility-divider" aria-hidden="true" />
          <div className="impulse-pixel__profile" ref={profileRef}>
            <button type="button" className="impulse-pixel__avatar-trigger"
              aria-label="Меню профиля" aria-expanded={profileOpen}
              onClick={() => { setProfileOpen((open) => !open); }}>
              <span className="impulse-pixel__avatar" aria-hidden="true">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 1).toUpperCase()}
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {profileOpen &&
              <div className="impulse-pixel__profile-menu" role="menu" aria-label="Профиль">
                <div className="impulse-pixel__identity"><strong>{displayName}</strong><small>{roleName}</small></div>
                {onOpenProfile && <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onOpenProfile(); }}>Мой профиль</button>}
                {onOpenRanking && <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onOpenRanking(); }}>Рейтинг</button>}
                {onOpenHelp && <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onOpenHelp(); }}>Помощь</button>}
                {onLogout && <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onLogout(); }}>Выйти</button>}
              </div>}
          </div>
        </div>
      </header>

      <main className="impulse-pixel__content">
        <header className="impulse-pixel__heading">
          <div><h1>Главная</h1><p>{home.roleTitle ?? "Выберите направление"}</p></div>
          <button type="button" className="impulse-pixel__journey-link" onClick={onOpenJourney}>
            Мой путь <ChevronRight size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="impulse-pixel__hero-row">
          <section className="impulse-pixel__hero impulse-pixel__glass"
            aria-labelledby="impulse-pixel-next-title">
            <div className="impulse-pixel__hero-copy">
              <div className="impulse-pixel__kicker">
                <span className="impulse-pixel__module-icon" aria-hidden="true"><Layers3 size={18}/></span>
                <span>Текущий модуль · {home.moduleTrackTitle ?? home.roleTitle ?? "Направление развития"}</span>
              </div>
              <h2 id="impulse-pixel-next-title">{home.nextTitle ?? "Выберите направление"}</h2>
              {progress && modulePercent !== null &&
                <div className="impulse-pixel__study-progress">
                  <span>{progress.complete} из {progress.total} уроков</span>
                  <div role="progressbar" aria-label="Прогресс текущего курса"
                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={modulePercent}>
                    <i style={{width:`${String(modulePercent)}%`}}/>
                  </div>
                </div>}
              {home.nextDescription && <p className="impulse-pixel__description">{home.nextDescription}</p>}
              {!home.nextDescription && <p className="impulse-pixel__description">{home.nextState}</p>}
              <button type="button" className="impulse-pixel__primary" onClick={onContinue}>
                <Play size={17} fill="currentColor" aria-hidden="true" />
                {home.nextActionText} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="impulse-pixel__stack" aria-hidden="true"><i/><i/><i/></div>
          </section>
          <section className="impulse-pixel__trajectory impulse-pixel__glass" aria-labelledby="impulse-pixel-track">
            <div className="impulse-pixel__trajectory-header">
              <span className="impulse-pixel__module-icon" aria-hidden="true"><TrendingUp size={19}/></span>
              <h2 id="impulse-pixel-track">Моя траектория</h2>
            </div>
            <div className="impulse-pixel__levels">
              <strong>{levelLabel}</strong><ArrowRight size={22} aria-hidden="true" />
              <strong className="impulse-pixel__levels-next">{nextLevelLabel}</strong>
            </div>
            <p>Следующий шаг:<strong>{home.nextLevel === null ?
              "Выбрать траекторию" : `Перейти на уровень ${nextLevelLabel}`}</strong></p>
            <button type="button" className="impulse-pixel__trajectory-more" onClick={onOpenJourney}>
              Подробнее <ChevronRight size={17} aria-hidden="true"/>
            </button>
          </section>
        </div>

        <section className="impulse-pixel__metrics" aria-label="Показатели">
          <div><small>Уровень Impulse</small><strong>{levelLabel}</strong><span>Учебный уровень</span></div>
          <div><small>Задачи</small><strong>{home.activeTaskCount}</strong><span>{home.activeTaskCount ? "Сейчас в работе" : "Пока нет задач"}</span></div>
          <div><small>Навыки</small><strong>{home.confirmedSkills === null ? "—" : home.confirmedSkills}</strong><span>С подтверждёнными кейсами</span></div>
        </section>
        <section className="impulse-pixel__next-level" aria-label="Следующий уровень">
          <header><div><h2>Следующий уровень</h2><p>{home.level === null ? "Данные об уровне загружаются" :
            `Уровень ${levelLabel} · пройдено ${String(home.completedCourses ?? "—")} из ${String(home.requiredCourses ?? "—")} обязательных курсов`}</p></div>
            <div className="impulse-pixel__requirements-actions">
              <strong>{levelLabel} → {nextLevelLabel}</strong>
              <button type="button" aria-expanded={requirementsOpen}
                onClick={() => { if (!requirementsOpen) onOpenRequirements(); setRequirementsOpen((open) => !open); }}>
                Требования уровня <ChevronDown size={17} aria-hidden="true"/>
              </button>
            </div>
          </header>
          {coursePercent !== null && <div className="impulse-pixel__level-progress">
            <div role="progressbar" aria-label="Прогресс обязательных курсов"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={coursePercent}>
              <i style={{width:`${String(coursePercent)}%`}}/>
            </div><span>{coursePercent}% курсов</span></div>}
          {requirementsOpen && <p className="impulse-pixel__expanded">{home.requirementsSummary ?? "Подробности можно увидеть в своей траектории."}</p>}
        </section>
        <section className="impulse-pixel__fold">
          <button type="button" aria-expanded={weekOpen}
            onClick={() => { setWeekOpen((open) => !open); }}>
            <span><strong>Задачи и неделя</strong><small>Текущая работа и история недели</small></span>
            <ChevronDown size={19} aria-hidden="true"/>
          </button>
          {weekOpen && <div className="impulse-pixel__expanded"><p>{home.weekSummary ?? "Откройте раздел задач для подробностей."}</p><button type="button" onClick={onOpenTasks}>Открыть задачи <ChevronRight size={16} aria-hidden="true" /></button></div>}
        </section>
        <section className="impulse-pixel__fold">
          <button type="button" aria-expanded={toolsOpen}
            onClick={() => { setToolsOpen((open) => !open); }}>
            <span><strong>Инструменты</strong><small>{home.toolsSummary ?? "Траектория и скилл-паспорт"}</small></span>
            <ChevronDown size={19} aria-hidden="true"/>
          </button>
          {toolsOpen && <div className="impulse-pixel__expanded"><p>{home.toolsSummary ?? "Доступные инструменты перечислены в соответствующих разделах."}</p><button type="button" onClick={onOpenTools}>Открыть инструменты <ChevronRight size={16} aria-hidden="true" /></button></div>}
        </section>
      </main>
    </div>
  );
}
