import { describe, expect, it } from "vitest";
import {
  countCurrentDocuments,
  credentialStatusLabel,
  isCurrentCredential,
  isRevokedCredential,
} from "./portfolio-v2-data";

describe("portfolio credential evidence rules", () => {
  it("includes a current issued season award in the document count", () => {
    expect(countCurrentDocuments([
      { verification_id: "season-1", status: "valid", credential_type: "season_award" },
      { verification_id: "course-1", status: "verified", credential_type: "course" },
    ], 1)).toBe(3);
  });

  it("excludes revoked and superseded documents from active counts", () => {
    const historical = [
      { verification_id: "old-1", status: "revoked" },
      { verification_id: "old-2", status: "superseded" },
    ];
    expect(historical.every(isRevokedCredential)).toBe(true);
    expect(historical.some(isCurrentCredential)).toBe(false);
    expect(countCurrentDocuments(historical, 0)).toBe(0);
    expect(credentialStatusLabel(historical[0]!)).toBe("Отозван");
    expect(credentialStatusLabel(historical[1]!)).toBe("Заменён");
  });

  it("does not infer validity from unknown or unverified status", () => {
    const unknown = { verification_id: "draft", status: "reported" };
    expect(isCurrentCredential(unknown)).toBe(false);
    expect(credentialStatusLabel(unknown)).toBe("reported");
    expect(countCurrentDocuments([unknown], 0)).toBe(0);
  });
});
