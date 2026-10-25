/** Portfolio display rules: a revoked document is visible in history, not a valid award. */
export type EvidenceCredential = {
  status: string;
  verification_id: string;
  credential_type?: "course" | "project_experience" | "season_award";
};

export function isCurrentCredential(item: EvidenceCredential): boolean {
  return ["valid", "verified", "issued"].includes(item.status.trim().toLowerCase());
}

export function isRevokedCredential(item: EvidenceCredential): boolean {
  return ["revoked", "superseded"].includes(item.status.trim().toLowerCase());
}

export function credentialStatusLabel(item: EvidenceCredential): string {
  const status = item.status.trim().toLowerCase();
  switch (status) {
    case "valid":
    case "verified":
    case "issued":
      return "Действует";
    case "revoked":
      return "Отозван";
    case "superseded":
      return "Заменён";
    default:
      return item.status || "Статус неизвестен";
  }
}

export function countCurrentDocuments(
  credentials: EvidenceCredential[],
  completedStudyCertificates: number,
): number {
  return credentials.filter(isCurrentCredential).length + completedStudyCertificates;
}
