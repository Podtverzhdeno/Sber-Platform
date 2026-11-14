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
  const panelRef = useRef<HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
        triggerRef.current?.focus();
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

  const closeDrawer = () => {
    setDrawerOpen(false);
    triggerRef.current?.focus();
  };
  const followLink = () => {
    if (drawerOpen) closeDrawer();
    onNavigate?.();
  };

  return (
    <div className="calm-navigation">
      <button
        ref={triggerRef}
        type="button"
        className="calm-navigation__mobile-trigger"
        aria-controls={id}
        aria-expanded={drawerOpen}
        onClick={() => { setDrawerOpen(true); }}
      >
        <Menu size={20} aria-hidden="true" />
        <span>Меню</span>
      </button>

      {drawerOpen && (
        <button
          className="calm-navigation__backdrop"
          type="button"
          tabIndex={-1}
          aria-label="Закрыть меню"
          onClick={closeDrawer}
        />
      )}

      <aside
        id={id}
        ref={panelRef}
        className={`calm-sidebar${drawerOpen ? " calm-sidebar--open" : ""}`}
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
