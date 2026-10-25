import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "../api/client";
import { applyTheme } from "../app/theme";
import { Badge, StatePanel } from "../components/ui";
import { ParticipantAchievementsGallery } from "./achievements-v2/gallery-page";
import { BuddyChatV2 } from "./buddy-chat-v2";

const settingsTabs = ["Профиль", "Безопасность", "Предпочтения", "Согласия", "Подбор", "Уведомления", "Видимость для HR", "AI-Buddy"] as const;
type SettingsTab = typeof settingsTabs[number];
type TalentConsent = "talent_profile" | "talent_evidence" | "talent_invitations" | "hr_profile";
type ProfileSkill = { title: string; origin: "self_reported" | "imported" | "verified_course" | "verified_project"; verified: boolean };
type ParticipantProfile = {
  person_id: string; display_name: string; city: string; university: string; study_year: string;
  primary_track: string; email: string; telegram: string; about: string; avatar_url: string;
  locale: "ru-RU" | "en-US"; theme: "dark" | "light" | "system"; timezone: string; buddy_enabled: boolean; skills: ProfileSkill[];
};
type ProfileDraft = Omit<ParticipantProfile, "person_id" | "skills"> & { skills: string[] };

const emptyProfile = (actorName: string): ProfileDraft => ({ display_name: actorName, city: "", university: "", study_year: "", primary_track: "", email: "", telegram: "", about: "", avatar_url: "", locale: "ru-RU", theme: "dark", timezone: "Europe/Moscow", buddy_enabled: true, skills: [] });

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="settings-toggle"><span><strong>{label}</strong></span><input type="checkbox" checked={checked} onChange={(event) => { onChange(event.target.checked); }} /><i aria-hidden="true" /></label>;
}

export function ParticipantSettings({ actorName, consentScopes, role = "participant" }: { actorName: string; consentScopes: string[]; role?: "participant" | "customer" }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SettingsTab>("Профиль");
  const [saved, setSaved] = useState("");
  const [hrVisible, setHrVisible] = useState(consentScopes.includes("hr_profile"));
  const [buddyEnabled, setBuddyEnabled] = useState(true);
  const [consents, setConsents] = useState({ publicProfile: true, communications: false });
  const [talentConsents, setTalentConsents] = useState(() => new Set(consentScopes));
  const [talentSaving, setTalentSaving] = useState(false);
  const currentConsents = useQuery({ queryKey: ["participant-consents"], queryFn: () => apiRequest<{ consent_scopes: string[] }>("/api/v1/me"), refetchOnMount: "always" });
  useEffect(() => { if (currentConsents.data) { setTalentConsents(new Set(currentConsents.data.consent_scopes)); setHrVisible(currentConsents.data.consent_scopes.includes("hr_profile")); } }, [currentConsents.data]);
  const [visibility, setVisibility] = useState({ base: true, skills: true, projects: true, achievements: true, learning: true, contacts: false });
  const visibilityQuery = useQuery({ queryKey: ["hr-visibility"], queryFn: () => apiRequest<{ visibility: Record<string, boolean> }>("/api/v1/me/visibility"), enabled: role === "participant", refetchOnMount: "always" });
  useEffect(() => { if (visibilityQuery.data?.visibility) { const matrix = visibilityQuery.data.visibility; setVisibility({ base: Boolean(matrix.hr_basic), skills: Boolean(matrix.hr_skills), projects: Boolean(matrix.hr_projects), achievements: Boolean(matrix.hr_achievements), learning: Boolean(matrix.hr_learning), contacts: Boolean(matrix.hr_contacts) }); } }, [visibilityQuery.data]);
  const updateVisibility = async (scope: string, key: keyof typeof visibility, visible: boolean) => {
    try {
      const result = await apiRequest<{ visibility: Record<string, boolean> }>(`/api/v1/me/visibility/${scope}`, { method: "PUT", headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" }, body: JSON.stringify({ visible }) });
      const matrix = result.visibility as Partial<Record<string, boolean>> | undefined;
      if (matrix) {
        setVisibility({ base: Boolean(matrix.hr_basic), skills: Boolean(matrix.hr_skills), projects: Boolean(matrix.hr_projects), achievements: Boolean(matrix.hr_achievements), learning: Boolean(matrix.hr_learning), contacts: Boolean(matrix.hr_contacts) });
      }
      announce("Видимость обновлена");
    } catch {
      setVisibility((current) => ({ ...current, [key]: !visible }));
      announce("Не удалось изменить видимость. Сначала откройте профиль для HR.");
    }
  };
  const [notifications, setNotifications] = useState({ projects: true, mentors: true, events: true, product: false, marketing: false });
  const [profile, setProfile] = useState<ProfileDraft>(() => emptyProfile(actorName));
  const [profileSkills, setProfileSkills] = useState<ProfileSkill[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const profileQuery = useQuery({ queryKey: ["participant-profile"], queryFn: () => apiRequest<ParticipantProfile>("/api/v1/me/profile"), enabled: role === "participant", refetchOnMount: "always" });
  useEffect(() => { if (profileQuery.data) { const data = profileQuery.data; setProfile({ display_name: data.display_name, city: data.city, university: data.university, study_year: data.study_year, primary_track: data.primary_track, email: data.email, telegram: data.telegram, about: data.about, avatar_url: data.avatar_url, locale: data.locale, theme: data.theme, timezone: data.timezone, buddy_enabled: data.buddy_enabled, skills: data.skills.filter((item) => item.origin === "self_reported").map((item) => item.title) }); setProfileSkills(data.skills); setBuddyEnabled(data.buddy_enabled); } }, [profileQuery.data]);
  const visibleTabs = role === "customer" ? settingsTabs.filter((item) => !["Подбор", "Видимость для HR"].includes(item)) : settingsTabs;
  const profileInitials = profile.display_name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const announce = (message: string) => { setSaved(message); window.setTimeout(() => { setSaved(""); }, 2600); };
  const saveProfile = useMutation({ mutationFn: () => apiRequest<ParticipantProfile>("/api/v1/me/profile", { method: "PUT", headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" }, body: JSON.stringify(profile) }), onSuccess: async (data) => { setProfileSkills(data.skills); applyTheme(data.theme); await Promise.all([queryClient.invalidateQueries({ queryKey: ["participant-profile"] }), queryClient.invalidateQueries({ queryKey: ["actor"] })]); announce("Профиль и предпочтения сохранены"); }, onError: () => { announce("Не удалось сохранить профиль. Проверьте поля и повторите."); } });
  const flip = <T extends Record<string, boolean>>(state: T, key: keyof T, setter: (next: T) => void) => { setter({ ...state, [key]: !state[key] }); };
  const updateTalentConsent = async (scope: TalentConsent, granted: boolean) => {
    setTalentSaving(true);
    try {
      const result = await apiRequest<{ granted_scopes: string[] }>(`/api/v1/me/consents/${scope}`, { method: "PUT", headers: { "X-CSRF-Token": sessionStorage.getItem("impulse_csrf") ?? "" }, body: JSON.stringify({ granted }) });
      setTalentConsents(new Set(result.granted_scopes));
      if (scope === "hr_profile") setHrVisible(granted);
      announce("Согласие обновлено");
    } catch { announce("Не удалось сохранить согласие. Повторите действие."); }
    finally { setTalentSaving(false); }
  };

  return <div className="participant-settings feature-stack" data-reference={role === "participant" ? "R-PAR-12" : undefined}>
    <header className="participant-page-heading"><div><p className="eyebrow">Личный кабинет</p><h1 id="workspace-title">Настройки</h1><p className="lead">{role === "customer" ? "Управляйте профилем, приватностью и рабочими уведомлениями заказчика." : "Управляйте профилем, приватностью и тем, как платформа помогает строить карьерный путь."}</p></div><button type="button" disabled={saveProfile.isPending} onClick={() => { if (role === "participant") saveProfile.mutate(); else announce("Настройки сохранены"); }}>{saveProfile.isPending ? "Сохраняем…" : "Сохранить изменения"}</button></header>
    {saved && <div className="success-banner" role="status"><span>✓</span><div><strong>{saved}</strong><small>Изменения применены к вашему профилю.</small></div></div>}
    <div className="settings-layout"><nav className="settings-nav" aria-label="Разделы настроек">{visibleTabs.map((item) => <button className={tab === item ? "active" : ""} type="button" key={item} onClick={() => { setTab(item); }}><span>{item === "Профиль" ? "●" : item === "Безопасность" ? "◇" : item === "AI-Buddy" ? "✧" : "○"}</span>{item}</button>)}</nav>
      <main className="settings-panel">
        {tab === "Профиль" && <><div className="settings-section-title"><div><h2>{role === "customer" ? "Профиль заказчика" : "Профиль участника"}</h2><p>{role === "customer" ? "Эту информацию платформа использует в задачах и коммуникации с участниками." : "Эту информацию платформа использует для рекомендаций и подбора задач."}</p></div><Badge tone="success">Данные сохраняются в профиле</Badge></div><div className="profile-editor"><div className="profile-avatar">{profileInitials}<button type="button" onClick={() => { announce("Загрузка фото будет подключена к файловому хранилищу"); }}>Изменить фото</button></div><div className="form-grid"><label>ФИО<input value={profile.display_name} onChange={(event) => { setProfile({ ...profile, display_name: event.target.value }); }} /></label><label>Город<input value={profile.city} onChange={(event) => { setProfile({ ...profile, city: event.target.value }); }} /></label><label>Вуз / программа<input value={profile.university} onChange={(event) => { setProfile({ ...profile, university: event.target.value }); }} /></label><label>Курс<input value={profile.study_year} onChange={(event) => { setProfile({ ...profile, study_year: event.target.value }); }} /></label><label>Основное направление<input value={profile.primary_track} onChange={(event) => { setProfile({ ...profile, primary_track: event.target.value }); }} /></label><label className="wide">О себе<textarea value={profile.about} onChange={(event) => { setProfile({ ...profile, about: event.target.value }); }} /></label><label>Email<input type="email" value={profile.email} onChange={(event) => { setProfile({ ...profile, email: event.target.value }); }} /></label><label>Telegram<input value={profile.telegram} onChange={(event) => { setProfile({ ...profile, telegram: event.target.value }); }} /></label></div></div>{role === "participant" && <div className="skills-editor"><h3>Ключевые навыки</h3><div>{profileSkills.map((skill) => skill.origin === "self_reported" ? <button type="button" key={`${skill.origin}-${skill.title}`} title="Заявлен пользователем" onClick={() => { setProfileSkills((items) => items.filter((item) => item !== skill)); setProfile({ ...profile, skills: profile.skills.filter((item) => item !== skill.title) }); }}>{skill.title} · заявлен ×</button> : <span className="profile-skill-verified" key={`${skill.origin}-${skill.title}`}>{skill.title} · {skill.verified ? "подтверждён" : "импортирован"}</span>)}<input aria-label="Новый навык" value={skillInput} onChange={(event) => { setSkillInput(event.target.value); }} placeholder="Добавить навык" /><button className="skill-add" type="button" onClick={() => { const title = skillInput.trim(); if (!title || profileSkills.some((item) => item.title.toLocaleLowerCase() === title.toLocaleLowerCase())) return; const skill: ProfileSkill = { title, origin: "self_reported", verified: false }; setProfileSkills((items) => [...items, skill]); setProfile({ ...profile, skills: [...profile.skills, title] }); setSkillInput(""); }}>+ Добавить</button></div><small>Источник каждого навыка сохранён. Самостоятельно добавленные навыки не считаются подтверждёнными.</small></div>}</>}
        {tab === "Профиль" && role === "participant" && <label className="settings-select">Фото профиля (URL)<input type="url" value={profile.avatar_url} onChange={(event) => { setProfile({ ...profile, avatar_url: event.target.value }); }} placeholder="https://…" /></label>}
        {tab === "Безопасность" && <><div className="settings-section-title"><div><h2>Конфиденциальность и безопасность</h2><p>Контролируйте доступ к аккаунту и активные устройства.</p></div></div><div className="settings-cards"><article><div><strong>Пароль</strong><small>Обновлён 18 дней назад</small></div><button type="button" onClick={() => { announce("Инструкция по смене пароля отправлена"); }}>Сменить пароль</button></article><article><div><strong>Провайдер входа</strong><small>Демо-режим · сессионные проверенные подписи</small></div><Badge tone="success">Активен</Badge></article><article><div><strong>Двухфакторная аутентификация</strong><small>Будет доступна после подключения корпоративного провайдера</small></div><button disabled type="button">Недоступно в MVP</button></article><article><div><strong>Внешний вход (SSO / Google / GitHub)</strong><small>Не поддерживается в демо-режиме — вход не гарантирован вне корпоративного контура</small></div><button disabled type="button">Недоступно в MVP</button></article><article><div><strong>Текущая сессия</strong><small>Windows · Chrome · Москва · сейчас</small></div><Badge tone="success">Активна</Badge></article><article><div><strong>Мобильная сессия</strong><small>Android · 27 сентября, 19:42</small></div><button type="button" onClick={(event) => { event.currentTarget.closest("article")?.remove(); announce("Сессия завершена"); }}>Завершить</button></article></div></>}
        {tab === "Предпочтения" && <><div className="settings-section-title"><div><h2>Предпочтения аккаунта</h2><p>Настройки применяются после повторного входа; исходные даты событий не изменяются.</p></div></div><div className="form-grid"><label>Язык<select value={profile.locale} onChange={(event) => { setProfile({ ...profile, locale: event.target.value as ProfileDraft["locale"] }); }}><option value="ru-RU">Русский</option><option value="en-US">English</option></select></label><label>Тема<select value={profile.theme} onChange={(event) => { setProfile({ ...profile, theme: event.target.value as ProfileDraft["theme"] }); }}><option value="dark">Тёмная</option><option value="light">Светлая</option><option value="system">Как в системе</option></select></label><label>Часовой пояс<select value={profile.timezone} onChange={(event) => { setProfile({ ...profile, timezone: event.target.value }); }}><option value="Europe/Moscow">Москва · UTC+3</option><option value="Asia/Amman">Амман · UTC+3</option></select></label></div></>}
        {tab === "Согласия" && <><div className="settings-section-title"><div><h2>Согласия и данные</h2><p>Вы сами определяете, где можно показывать профиль и достижения.</p></div></div><div className="toggle-list"><Toggle checked label="Обработка данных для работы платформы" onChange={() => { announce("Обязательное согласие можно отозвать только через удаление аккаунта"); }} /><Toggle checked={consents.publicProfile} label="Публичный профиль и достижения" onChange={() => { flip(consents, "publicProfile", setConsents); }} /><Toggle checked={consents.communications} label="Необязательные продуктовые коммуникации" onChange={() => { flip(consents, "communications", setConsents); }} /></div></>}
        {tab === "Уведомления" && <><div className="settings-section-title"><div><h2>Уведомления</h2><p>Матрица каналов: обязательные статусы останутся включёнными, продуктовые и маркетинговые вы управляете сами.</p></div></div><div className="notification-matrix"><section className="notification-group"><h3>Обязательные</h3><ul className="required-notification-list"><li><div><strong>Статусы задач</strong><small>Заявки, рабочая область и решения ревью</small></div><Badge tone="success">Всегда включено</Badge></li><li><div><strong>Безопасность аккаунта</strong><small>Входы и сессии</small></div><Badge tone="success">Всегда включено</Badge></li></ul><p className="muted">Обязательные статусы нельзя отключить, потому что без них рабочая область не отвечает на судебные решения.</p></section><section className="notification-group"><h3>Продуктовые</h3><div className="toggle-list">{Object.entries({ projects: "Проекты и задачи", mentors: "Сообщения от менторов", events: "События", product: "Продуктовые обновления" }).map(([key, label]) => <Toggle key={key} checked={notifications[key as keyof typeof notifications]} label={label} onChange={() => { flip(notifications, key as keyof typeof notifications, setNotifications); }} />)}</div></section><section className="notification-group"><h3>Маркетинговые</h3><div className="toggle-list"><Toggle checked={notifications.marketing} label="Маркетинговые материалы" onChange={() => { flip(notifications, "marketing", setNotifications); }} /></div><p className="muted">Маркетинговые сообщения не пересылают ваши ответы и данные задач; они посылаются только по явному согласию.</p></section></div></>}
        {tab === "Видимость для HR" && <><div className="settings-section-title"><div><h2>Видимость для HR</h2><p>Откройте доказанный опыт рекрутерам и точно выберите доступные данные.</p></div><Toggle checked={hrVisible} label="Профиль доступен HR" onChange={(value) => { void updateTalentConsent("hr_profile", value); }} /></div><div className={`hr-visibility-grid${hrVisible ? "" : " disabled"}`}>{Object.entries({ base: "Базовая информация", skills: "Навыки", projects: "Проекты и оценки", achievements: "Достижения", learning: "Прогресс обучения", contacts: "Контакты" }).map(([key, label]) => <Toggle key={key} checked={visibility[key as keyof typeof visibility]} label={label} onChange={(value) => { setVisibility((current) => ({ ...current, [key]: value })); void updateVisibility(key === "base" ? "hr_basic" : `hr_${key}`, key as keyof typeof visibility, value); }} />)}</div><div className="hr-preview"><p className="eyebrow">Предпросмотр глазами HR</p><div><span className="profile-avatar profile-avatar--small">АР</span><div><strong>{actorName}</strong><small>{hrVisible ? "Аналитик данных · разделы и контакты по матрице" : "Профиль скрыт от HR"}</small><p>Видимы: {hrVisible ? [visibility.base && "базовое", visibility.skills && "навыки", visibility.projects && "проекты", visibility.achievements && "достижения", visibility.learning && "обучение"].filter(Boolean).join(", ") || "ничего" : "ничего"}.{hrVisible && visibility.contacts ? " Контакты открыты." : " Контакты скрыты."}</p></div></div></div></>}
        {tab === "Подбор" && <><div className="settings-section-title"><div><h2>Подбор под задачи команд</h2><p>Управляйте тем, могут ли заказчики и руководители найти вас по подтверждённым кейсам.</p></div></div><fieldset disabled={talentSaving} className="toggle-list"><Toggle checked={talentConsents.has("talent_profile")} label="Показывать мой профиль в подборе" onChange={(value) => { void updateTalentConsent("talent_profile", value); }} /><Toggle checked={talentConsents.has("talent_evidence")} label="Показывать подтверждённые кейсы и разрешённые доказательства" onChange={(value) => { void updateTalentConsent("talent_evidence", value); }} /><Toggle checked={talentConsents.has("talent_invitations")} label="Получать адресные приглашения на задачи" onChange={(value) => { void updateTalentConsent("talent_invitations", value); }} /></fieldset><div className="hr-preview"><p className="eyebrow">Предпросмотр для руководителя</p><strong>{talentConsents.has("talent_profile") ? actorName : "Профиль скрыт"}</strong><p>{talentConsents.has("talent_profile") && talentConsents.has("talent_evidence") ? "Подтверждённые кейсы будут доступны после проверки релевантности запроса. Контакты и личные сообщения скрыты." : "Кейсы и доказательства скрыты."}</p><p>{talentConsents.has("talent_invitations") ? "Адресные приглашения разрешены." : "Адресные приглашения отключены."}</p></div></>}
        {tab === "AI-Buddy" && <><div className="settings-section-title"><div><h2>AI-Buddy</h2><p>{role === "customer" ? "Помощник улучшает постановку задач и анализирует отклики, а итоговые решения принимает заказчик." : "Помощник объясняет следующий шаг, но не принимает решения об оценках."}</p></div></div><Toggle checked={buddyEnabled} label="AI-Buddy включён" onChange={(value) => { setBuddyEnabled(value); setProfile({ ...profile, buddy_enabled: value }); }} /><p className="muted">{buddyEnabled ? "Модель доступна в рабочей области; персональные данные не выходят за границу платформы." : "Модельные вызовы остановлены полностью: раздел AI-Buddy показывает заглушку, персональная память не передаётся."}</p><label className="settings-select">Стиль общения<select disabled={!buddyEnabled} defaultValue="brief"><option value="brief">Кратко и по делу</option><option value="coach">Поддерживающий наставник</option><option value="detail">Подробные объяснения</option></select></label><div className="danger-zone"><div><strong>История диалога</strong><small>Очистка удалит сообщения и персональную память, но не обязательный технический аудит.</small></div><button type="button" onClick={() => { announce("История AI-Buddy очищена"); }}>Очистить историю</button></div></>}
      </main></div>
  </div>;
}

export function ParticipantBuddy({ navigation = [] }: { navigation?: string[] }) {
  const profileQuery = useQuery({
    queryKey: ["participant-profile"],
    queryFn: () => apiRequest<ParticipantProfile>("/api/v1/me/profile"),
    refetchOnMount: "always",
  });
  if (profileQuery.isPending) return <StatePanel kind="loading" />;
  if (profileQuery.isError) {
    return <StatePanel kind="error" action="Обновить" onAction={() => {void profileQuery.refetch();}} />;
  }
  if (!profileQuery.data.buddy_enabled) {
    return <div className="buddy-page feature-stack" data-reference="R-PAR-11">
      <header className="participant-page-heading"><div><p className="eyebrow">Персональный навигатор</p><h1 id="workspace-title">AI-Buddy</h1><p className="lead">AI-Buddy отключён в настройках.</p></div><Badge tone="warning">Модельные вызовы остановлены</Badge></header>
      <section className="buddy-optout" role="status"><strong>AI-Buddy выключен — модельные вызовы не выполняются</strong><p>Персональные сообщения не отправляются. Настройки можно изменить в разделе AI-Buddy.</p><button className="secondary-button" type="button" onClick={() => { const index=navigation.indexOf("Настройки"); if(index>=0)window.location.assign("/workspace/"+String(index)); }}>Открыть настройки</button></section>
    </div>;
  }
  return <div className="buddy-page feature-stack" data-reference="R-PAR-11"><BuddyChatV2 profile={profileQuery.data} navigation={navigation} /></div>;
}

/** Retain the established route while the experience is powered by live evidence. */
export function ParticipantAchievements({ navigation = [] }: { navigation?: string[] }) {
  return <ParticipantAchievementsGallery navigation={navigation} />;
}
