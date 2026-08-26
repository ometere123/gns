export type AuthenticityStatus =
  | "UNVERIFIED"
  | "PENDING_EVIDENCE"
  | "VERIFIED"
  | "REJECTED"
  | "INSUFFICIENT_EVIDENCE"
  | "CHALLENGED"
  | "STALE"
  | "REVOKED"
  | "INCONCLUSIVE"
  | "SUPERSEDED";

export type AuthenticityClaimType =
  | "project"
  | "agent"
  | "organization"
  | "public_identity";

export type EvidenceSourceType =
  | "website"
  | "github"
  | "attestation"
  | "other";

export interface EvidenceSource {
  type: EvidenceSourceType;
  url: string;
}

export interface AuthenticityClaim {
  id: string;
  namespace: string;
  claim_type: AuthenticityClaimType;
  owner: string;
  status: AuthenticityStatus;
  policy_version: string;
  challenge: string;
  subject_hash: string;
  evidence_manifest: EvidenceSource[];
  context: string;
  created_at: number;
  verified_at: number;
  verdict_id: string;
  active_challenge_id: string;
}

export interface NamespaceVerification {
  status: AuthenticityStatus;
  claim_id: string;
  verdict_id: string;
  subject_hash: string;
  policy_version: string;
  verified_at?: number;
  challenge_id?: string;
  invalidation_reason?: string;
  revoked_at?: number;
  revocation_reason?: string;
  last_challenge_resolved_at?: number;
}

export interface AuthenticityChallenge {
  id: string;
  claim_id: string;
  namespace: string;
  challenger: string;
  reason_code: string;
  evidence_manifest: EvidenceSource[];
  context: string;
  status: "OPEN" | "UPHOLD" | "REVOKE" | "INSUFFICIENT_EVIDENCE";
  created_at: number;
  verdict_id: string;
}

export interface AuthenticityVerdict {
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

export interface WalletBoundAttestation {
  protocol: "gns-claim-v2";
  namespace: string;
  wallet: string;
  registry: string;
  authenticity_contract: string;
  claim_id: string;
  challenge: string;
  policy_version: string;
  issued_at: number;
  expires_at: number;
}
