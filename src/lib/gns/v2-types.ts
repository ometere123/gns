export type GnsV2VerificationStatus =
  | "UNVERIFIED"
  | "PENDING_EVIDENCE"
  | "VERIFIED"
  | "REJECTED"
  | "INSUFFICIENT_EVIDENCE"
  | "CHALLENGED"
  | "STALE"
  | "REVOKED"
  | "INCONCLUSIVE";

export type GnsV2ClaimType =
  | "project"
  | "agent"
  | "organization"
  | "public_identity";

export type GnsV2EvidenceType =
  | "website"
  | "github"
  | "attestation"
  | "other";

export interface GnsV2EvidenceSource {
  type: GnsV2EvidenceType;
  url: string;
}

export interface GnsV2Verification {
  status: GnsV2VerificationStatus;
  claim_id: string;
  verdict_id: string;
  subject_hash: string;
  policy_version: string;
  verified_at?: number;
  invalidated_at?: number;
  invalidation_reason?: string;
  challenge_id?: string;
  revoked_at?: number;
  revocation_reason?: string;
}

export interface GnsV2Records {
  website?: string;
  github?: string;
  x?: string;
  agent?: string;
  description?: string;
}

export interface GnsV2Namespace {
  label: string;
  namespace: string;
  owner: string;
  primary_address: string;
  records: GnsV2Records;
  created_at: number;
  verification: GnsV2Verification;
}

export interface GnsV2Claim {
  id: string;
  namespace: string;
  claim_type: GnsV2ClaimType;
  owner: string;
  status: GnsV2VerificationStatus;
  policy_version: string;
  challenge: string;
  subject_hash: string;
  evidence_manifest: GnsV2EvidenceSource[];
  context: string;
  created_at: number;
  verified_at: number;
  verdict_id: string;
  active_challenge_id: string;
}

export interface GnsV2Challenge {
  id: string;
  claim_id: string;
  namespace: string;
  challenger: string;
  reason_code: string;
  evidence_manifest: GnsV2EvidenceSource[];
  context: string;
  status: "OPEN" | "UPHOLD" | "REVOKE" | "INSUFFICIENT_EVIDENCE";
  created_at: number;
  verdict_id: string;
}

export interface GnsV2Verdict {
  id: string;
  kind: "CLAIM_VERIFICATION" | "CHALLENGE_RESOLUTION";
  claim_id: string;
  challenge_id?: string;
  namespace: string;
  decision:
    | "VERIFIED"
    | "REJECTED"
    | "INSUFFICIENT_EVIDENCE"
    | "UPHOLD"
    | "REVOKE";
  reason_code: string;
  summary: string;
  evidence_digest: string;
  policy_version: string;
  subject_hash?: string;
  created_at: number;
}

export interface GnsV2CreateClaimResult {
  success: boolean;
  claim_id: string;
  challenge: string;
  attestation_protocol: "gns-claim-v2";
  policy_version: string;
}

export interface GnsV2Attestation {
  protocol: "gns-claim-v2";
  namespace: string;
  wallet: string;
  registry: string;
  claim_id: string;
  challenge: string;
  policy_version: string;
  issued_at: number;
  expires_at: number;
}
