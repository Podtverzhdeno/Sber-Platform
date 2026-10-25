export type AchievementCategory = "project" | "certificate" | "trophy" | "event";
export type AchievementStatus = "verified" | "pending" | "rejected";
export type AchievementRecord = {
  id: string;
  title: string;
  category: AchievementCategory;
  status: AchievementStatus;
  description: string;
  issuer: string;
  /** Source-provided issuance date; absent until verifiable evidence supplies one. */
  issuedAt?: string;
  source: "portfolio" | "event";
  verificationId?: string;
  evidence: string[];
  sourceUrl?: string;
  eventKey?: string;
  projectId?: string;
};

export type PortfolioContribution = {
  contribution_id: string;
  project_title: string;
  personal_summary: string;
  artifact_keys: string[];
  grade: string | null;
  review_reason: string | null;
  verification_status: string;
};
export type PortfolioCourse = { key: string; title: string; status: string };
export type PortfolioCredential = {
  verification_id: string;
  title: string;
  status: string;
  credential_type?: "course" | "project_experience" | "season_award";
  issuer?: string;
};
export type PortfolioTrophy = {
  title: string;
  organizer: string;
  source_url: string;
  trophy_type: string;
};
export type AchievementsPortfolio = {
  contributions: PortfolioContribution[];
  courses: PortfolioCourse[];
  credentials: PortfolioCredential[];
  trophies: PortfolioTrophy[];
  demo_data?: boolean;
};
export type AchievementClaim = {
  id: string;
  event_key: string;
  claim_type: string;
  status: "reported" | "awaiting_verification" | "verified" | "rejected" | "revoked";
  evidence_state: "provisional" | "verified" | "invalid";
  verification_explanation: string;
  trophy_created: boolean;
};
export type AchievementEvent = { key: string; title: string; organizer: string };
export type AchievementEventsPage = { items: AchievementEvent[]; has_more: boolean; next_cursor: string | null };

const normalized = (s: string): string => s.toLocaleLowerCase("ru-RU").trim().replace(/\s+/g, " ");
const verifiedLabel = (s: string): boolean =>
  /^(verified|completed|подписан|подписано|проверяемый|подтверждено|принят|принято)$/i.test(s.trim());

function credentialCategory(value: PortfolioCredential): AchievementCategory {
  return value.credential_type === "season_award" ? "trophy" :
    value.credential_type === "project_experience" ? "project" : "certificate";
}
function credentialStatus(status: string): AchievementStatus {
  if (verifiedLabel(status)) return "verified";
  if (/reject|invalid|отклон|аннулир/i.test(status)) return "rejected";
  return "pending";
}
export const achievementCategoryLabels: Record<AchievementCategory, string> = {
  project: "Проекты", certificate: "Сертификаты", trophy: "Награды", event: "События",
};
export const achievementStatusLabels: Record<AchievementStatus, string> = {
  verified: "Подтверждено", pending: "На проверке", rejected: "Отклонено",
};

export function buildAchievements(
  portfolio?: AchievementsPortfolio,
  claims: AchievementClaim[] = [],
  events: AchievementEvent[] = [],
): AchievementRecord[] {
  const result: AchievementRecord[] = [];
  const eventsByKey = new Map(events.map(event => [event.key, event]));
  const credentialTitles = new Set(
    (portfolio?.credentials ?? [])
      .filter(credential => credentialCategory(credential) === "certificate")
      .map(credential => normalized(credential.title)),
  );

  for (const contribution of portfolio?.contributions ?? []) {
    result.push({
      id: `project:${contribution.contribution_id}`,
      title: contribution.project_title,
      category: "project",
      status: verifiedLabel(contribution.verification_status) ? "verified" : "pending",
      description: contribution.personal_summary || "Подробности вклада доступны в портфолио",
      issuer: "Проверка личного вклада",
      source: "portfolio",
      verificationId: contribution.contribution_id,
      projectId: contribution.contribution_id,
      evidence: contribution.artifact_keys,
    });
  }

  for (const credential of portfolio?.credentials ?? []) {
    result.push({
      id: `credential:${credential.verification_id}`,
      title: credential.title,
      category: credentialCategory(credential),
      status: credentialStatus(credential.status),
      description: `Документ: ${credential.status}`,
      issuer: credential.issuer || "Выдан платформой",
      source: "portfolio",
      verificationId: credential.verification_id,
      evidence: [],
    });
  }
  for (const course of portfolio?.courses ?? []) {
    if (credentialTitles.has(normalized(course.title))) continue;
    result.push({
      id: `course:${course.key}`,
      title: course.title,
      category: "certificate",
      status: verifiedLabel(course.status) ? "verified" : "pending",
      description: "Результат обучения в Bootcamp",
      issuer: "Impulse Bootcamp",
      source: "portfolio",
      evidence: [],
    });
  }

  for (const trophy of portfolio?.trophies ?? []) {
    result.push({
      id: `trophy:${normalized(trophy.organizer)}:${normalized(trophy.title)}`,
      title: trophy.title,
      category: "trophy",
      status: "verified",
      description: trophy.trophy_type || "Награда за результат",
      issuer: trophy.organizer,
      source: "portfolio",
      evidence: [],
      sourceUrl: trophy.source_url,
    });
  }

  for (const claim of claims) {
    const event = eventsByKey.get(claim.event_key);
    const title = event?.title || `Событие · ${claim.event_key}`;
    const status: AchievementStatus = claim.evidence_state === "verified" ? "verified" :
      claim.evidence_state === "invalid" ? "rejected" : "pending";
    result.push({
      id: `event:${claim.id}`,
      title,
      category: "event",
      status,
      description: claim.verification_explanation || (status === "pending" ?
        "Подтверждение результата ожидает решения" : "Результат проверен"),
      issuer: event?.organizer || "Внешнее событие",
      source: "event",
      eventKey: claim.event_key,
      verificationId: claim.id,
      evidence: [],
    });
  }

  return result;
}

export function achievementSummary(records: AchievementRecord[]) {
  return {
    all: records.length,
    verified: records.filter(record => record.status === "verified").length,
    pending: records.filter(record => record.status === "pending").length,
    rejected: records.filter(record => record.status === "rejected").length,
  };
}
