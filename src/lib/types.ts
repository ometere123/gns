export type GnsRecords = {
  avatar?: string;
  website?: string;
  x?: string;
  github?: string;
  discord?: string;
  email?: string;
  contract?: string;
  agent?: string;
  description?: string;
};

export type NameStatus = "active" | "expired" | "flagged" | "not_found";

export type AiStatus = {
  risk: "unreviewed" | "low" | "medium" | "high" | "critical";
  verified: boolean;
  last_review_id: string;
};

export type GnsName = {
  label: string;
  full_name: string;
  parent: string;
  is_subname: boolean;
  owner: string;
  primary_address: string;
  created_at: number;
  expires_at: number;
  status: NameStatus;
  records: GnsRecords;
  ai_status?: AiStatus;
};

export type GnsReport = {
  id: string;
  name: string;
  name_exists?: boolean;
  reporter: string;
  reason: string;
  evidence_url: string;
  comment: string;
  status: "open" | "reviewed" | "flagged" | "dismissed";
  created_at: number;
  ai_review_id?: string;
};

export type SearchResult = {
  query: string;
  fullName: string;
  available: boolean;
  name?: GnsName | null;
};

export type ContractWriteResult = {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
};

export type AiRisk = "unreviewed" | "low" | "medium" | "high" | "critical";

export type AiVerdict =
  | "safe"
  | "suspicious"
  | "impersonation_risk"
  | "phishing_risk"
  | "insufficient_evidence"
  | "valid_report"
  | "invalid_report"
  | "needs_more_evidence"
  | "verified"
  | "partially_verified"
  | "not_verified";

export type AiResult = {
  risk: AiRisk;
  verdict: AiVerdict;
  verified: boolean;
  summary: string;
  reasons: string[];
  recommended_action?: string;
  recommended_report_status?: string;
};

export type AiReview = {
  id: string;
  name?: string;
  report_id?: string;
  reviewer: string;
  requested_by: string;
  result: AiResult;
  created_at: number;
  claim?: string;
  evidence_url?: string;
  extra_context?: string;
  project_name?: string;
  official_website?: string;
  official_x?: string;
  official_github?: string;
  explanation?: string;
  type?: string;
  base_label?: string;
  purpose?: string;
};

export type AiSuggestion = { name: string; reason: string };
