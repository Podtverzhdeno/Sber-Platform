export type MatchStatus = "calculated" | "insufficient_data" | "not_applicable";
export type EligibilityStatus = "eligible" | "ineligible" | "unknown";
export type ApplicationState =
  | "none"
  | "submitted"
  | "under_review"
  | "accepted"
  | "assigned"
  | "closed"
  | "unavailable";
export type CatalogAction =
  | "open_conditions"
  | "apply"
  | "withdraw"
  | "open_application"
  | "open_workspace"
  | "bookmark"
  | "share";
export type CatalogSort = "match-default" | "deadline" | "duration" | "newest" | "skill-growth";
export type CatalogLayout = "cards" | "list";

export type MatchReason = {
  code: string;
  label: string;
};

export type CatalogItem = {
  task_id: string;
  snapshot_version: string;
  brief_version: number;
  terms_version: number;
  title: string;
  customer: {
    id: string;
    display_name: string;
    verification: "verified" | "unverified" | "demo";
  };
  brief_summary: string;
  competency_tags: string[];
  difficulty: string | null;
  duration_minutes: number | null;
  work_format: string | null;
  places_total: number;
  places_available: number | null;
  deadline_at: string | null;
  eligibility: {
    status: EligibilityStatus;
    reason_codes: string[];
    missing_prerequisites: string[];
  };
  match: {
    status: MatchStatus;
    percent: string | null;
    coverage: string;
    algorithm_version: string | null;
    source_snapshot_version: string;
    calculated_at: string;
    reasons: MatchReason[];
    missing_factors: string[];
    growth_fit_percent: string | null;
  };
  skill_impact: {
    skill_id: string;
    title: string;
    status: "calculated" | "qualitative" | "insufficient_data";
    current_level: string | null;
    projected_level: string | null;
    model_version: string | null;
    explanation: string;
    verification_required: boolean;
  }[];
  stage_plan: {
    version: number;
    stages: {
      key: string;
      position: number;
      title: string;
      summary: string;
      estimated_minutes: number | null;
      state: "planned" | "locked";
    }[];
  };
  benefits: {
    code: string;
    label: string;
    state: "potential" | "actual" | "unavailable";
    condition: string;
    benefit_type: string;
    rule_kind: string | null;
    evidence_refs: string[];
  }[];
  application_state: ApplicationState;
  allowed_actions: CatalogAction[];
  generated_at: string;
  bookmarked: boolean;
  application_id: string | null;
  assignment_id: string | null;
  direction_keys: string[];
  weekly_workload_minutes: number | null;
  created_at: string | null;
  support_model: string | null;
};

export type CatalogPage = {
  items: CatalogItem[];
  total_found: number;
  total_available: number;
  next_cursor: string | null;
  total_saved: number;
  total_calculated: number;
  snapshot_at: string | null;
};

export type CatalogTerms = {
  task_id: string;
  terms_version: number;
  brief_version: number;
  version_token: string;
  duration_minutes: number | null;
  weekly_workload_minutes: number | null;
  deliverable: string;
  prerequisites: string[];
  selection_criteria: string[];
  support_model: string;
  ip_terms: string;
  portfolio_permission: "none" | "restricted" | "conditional" | "full";
  paid: boolean;
  payout_condition: string | null;
  deadline_at: string | null;
  data_constraints: string | null;
};

export type CatalogFilters = {
  q: string;
  difficulty: string;
  workFormat: string;
  customer: string;
  direction: string;
  competency: string;
  timeframe: string;
  saved: boolean;
  sort: CatalogSort;
};
