import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  House,
  ListChecks,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { activeCalmGroup, buildCalmNavigation, type CalmRole } from "./model";
import "./sidebar.scss";

const icons: Readonly<Record<string, LucideIcon>> = {
  learning: BookOpen,
  work: BriefcaseBusiness,
  results: ChartNoAxesCombined,
  community: MessageCircle,
  more: MoreHorizontal,
  tasks: ClipboardList,
  people: UsersRound,
  review: ListChecks,
  help: Sparkles,
  queue: ListChecks,
  checks: ShieldCheck,
  pipeline: Search,
};

const roleLabels: Readonly<Record<CalmRole, string>> = {
  participant: "Участник",
  customer: "Заказчик",
  mentor: "Ментор",
  manager: "Руководитель",
  hr: "HR",
  operator: "Оператор",
};

export interface CalmSidebarProps {
  readonly role: CalmRole;
  /** Same server-authorized array used by /workspace/:section. */
  readonly navigation: readonly string[];
  readonly activeIndex: number;
  readonly assignedRoles?: readonly CalmRole[];
  readonly onSwitchRole?: (role: CalmRole) => void;
  readonly onNavigate?: () => void;
}

/**
 * Isolated, accessible presentation component.
 * Integration into the shared App shell is deliberately owned by a separate claim.
 */
export function CalmSidebar({
  role,
  navigation,
  activeIndex,
  assignedRoles = [],
  onSwitchRole,
  onNavigate,
}: CalmSidebarProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const edgeTriggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const hoverExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextEdgeFocus = useRef(false);
  const cancelHoverExit = () => {
    if (hoverExitTimer.current !== null) {
      clearTimeout(hoverExitTimer.current);
      hoverExitTimer.current = null;
    }
  };
  useEffect(() => () => {
    if (hoverExitTimer.current !== null) clearTimeout(hoverExitTimer.current);
  }, []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Hover flyout is non-modal: do not trap focus, lock scrolling or dim the page.
  const [hoverOpen, setHoverOpen] = useState(false);
  const navOpen = drawerOpen || hoverOpen;
  const model = useMemo(() => buildCalmNavigation(role, navigation), [role, navigation]);
  const activeGroup = activeCalmGroup(model, activeIndex);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(activeGroup);

  // Active URL or role change always reveals the exact destination.
  useEffect(() => {
    setExpandedGroup(activeGroup);
  }, [role, activeIndex, activeGroup]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLButtonElement>(".calm-sidebar__close")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        const trigger = triggerRef.current;
        if (trigger && window.getComputedStyle(trigger).display !== "none") trigger.focus();
        else document.querySelector<HTMLButtonElement>(".owner-topbar-brand")?.focus();
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled]),select:not([disabled])",
        ),
      ).filter((element) => !element.closest("[hidden]"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && first && last && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && first && last && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!hoverOpen || drawerOpen) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelHoverExit();
        setHoverOpen(false);
        // Restore focus if a keyboard user is inside the about-to-hide panel.
        if (panelRef.current?.contains(document.activeElement)) {
          suppressNextEdgeFocus.current = true;
          edgeTriggerRef.current?.focus();
        }
      }
    };
    document.addEventListener("keydown", dismissOnEscape);
    return () => { document.removeEventListener("keydown", dismissOnEscape); };
  }, [hoverOpen, drawerOpen]);

  const closeDrawer = () => {
    cancelHoverExit();
    setDrawerOpen(false);
    setHoverOpen(false);
    const trigger = triggerRef.current;
    if (trigger && window.getComputedStyle(trigger).display !== "none") trigger.focus();
    else document.querySelector<HTMLButtonElement>(".owner-topbar-brand")?.focus();
  };
  const followLink = () => {
    cancelHoverExit();
    if (drawerOpen) closeDrawer();
    else if (hoverOpen) setHoverOpen(false);
    onNavigate?.();
  };

  return (
    <div
      className="calm-navigation"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHoverOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="calm-navigation__mobile-trigger"
        aria-controls={id}
        aria-expanded={drawerOpen}
        onClick={() => { cancelHoverExit(); setHoverOpen(false); setDrawerOpen(true); }}
      >
        <Menu size={20} aria-hidden="true" />
        <span>Меню</span>
      </button>

      <button
        ref={edgeTriggerRef}
        type="button"
        className="calm-navigation__edge-trigger"
        aria-label="Показать навигацию"
        title="Навигация"
        aria-controls={id}
        aria-expanded={navOpen}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            cancelHoverExit();
            setHoverOpen(true);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse" || drawerOpen) return;
          cancelHoverExit();
          // Give the cursor time to transfer to the sliding panel. A fly-by
          // that never enters the panel must not leave it stuck open.
          hoverExitTimer.current = setTimeout(() => {
            hoverExitTimer.current = null;
            if (!panelRef.current?.matches(":hover") && !panelRef.current?.contains(document.activeElement)) {
              setHoverOpen(false);
            }
          }, 220);
        }}
        onFocus={() => {
          if (suppressNextEdgeFocus.current) {
            suppressNextEdgeFocus.current = false;
            return;
          }
          cancelHoverExit();
          setHoverOpen(true);
        }}
        onClick={() => { cancelHoverExit(); setHoverOpen(false); setDrawerOpen(true); }}
      />

      {/*
        Keep the backdrop mounted so opening AND closing animate smoothly.
        Hidden state is non-interactive and excluded from the accessibility tree.
      */}
      <button
        className={`calm-navigation__backdrop${drawerOpen ? " calm-navigation__backdrop--open" : ""}`}
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={closeDrawer}
      />

      <aside
        id={id}
        ref={panelRef}
        className={`calm-sidebar${navOpen ? " calm-sidebar--open" : ""}${hoverOpen && !drawerOpen ? " calm-sidebar--hover" : ""}`}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") cancelHoverExit();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && !drawerOpen && !panelRef.current?.contains(document.activeElement)) {
            cancelHoverExit();
            setHoverOpen(false);
          }
        }}
        role={drawerOpen ? "dialog" : undefined}
        aria-label={drawerOpen ? "Главное меню" : "Боковая панель"}
        aria-modal={drawerOpen ? true : undefined}
      >
        <div className="calm-sidebar__header">
          {model.home ? (
            <NavLink to={model.home.href} className="calm-sidebar__brand" onClick={followLink}>
              <span className="calm-sidebar__brand-mark" aria-hidden="true">ϟ</span>
              <span>Impulse</span>
            </NavLink>
          ) : (
            <span className="calm-sidebar__brand">
              <span className="calm-sidebar__brand-mark" aria-hidden="true">ϟ</span>
              <span>Impulse</span>
            </span>
          )}
          <button
            type="button"
            className="calm-sidebar__close"
            aria-label="Закрыть меню"
            onClick={closeDrawer}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {assignedRoles.length > 1 && onSwitchRole && (
          <label className="calm-sidebar__role">
            <span>Рабочая роль</span>
            <select
              value={role}
              aria-label="Рабочая роль"
              onChange={(event) => {
                onSwitchRole(event.target.value as CalmRole);
                if (drawerOpen) closeDrawer();
              }}
            >
              {assignedRoles.map((assignedRole) => (
                <option value={assignedRole} key={assignedRole}>
                  {roleLabels[assignedRole]}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="calm-sidebar__nav" aria-label="Навигация роли">
          <ul className="calm-sidebar__groups">
            {model.home && (
              <li>
                <NavLink
                  to={model.home.href}
                  end
                  className="calm-sidebar__home"
                  aria-current={activeIndex === model.home.index ? "page" : undefined}
                  onClick={followLink}
                >
                  <House size={19} aria-hidden="true" />
                  <span>{model.home.label}</span>
                </NavLink>
              </li>
            )}
            {model.groups.map((group) => {
              const expanded = expandedGroup === group.id;
              const GroupIcon = icons[group.id] ?? MoreHorizontal;
              const active = group.items.some((item) => item.index === activeIndex);
              const panelId = `${id}-${group.id}`;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    className={`calm-sidebar__group${active ? " calm-sidebar__group--active" : ""}`}
                    aria-controls={panelId}
                    aria-expanded={expanded}
                    onClick={() => { setExpandedGroup(expanded ? null : group.id); }}
                  >
                    <GroupIcon size={19} aria-hidden="true" />
                    <span>{group.title}</span>
                    <ChevronDown className="calm-sidebar__chevron" size={16} aria-hidden="true" />
                  </button>
                  <ul id={panelId} className="calm-sidebar__items" hidden={!expanded}>
                    {group.items.map((item) => (
                      <li key={item.index}>
                        <NavLink
                          to={item.href}
                          end
                          className="calm-sidebar__link"
                          aria-current={activeIndex === item.index ? "page" : undefined}
                          onClick={followLink}
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
