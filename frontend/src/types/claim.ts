/**
 * Claim contracts — the "prove it's yours" handshake.
 *
 * `contact` is populated by the server ONLY when the claim is approved and the
 * caller is one of the two participants. The UI must never try to synthesise it.
 */

export type ClaimStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface ClaimAnswer {
  /** Snapshotted at submission time so it survives later question edits. */
  question: string;
  answer: string;
}

/** Non-identifying summary — safe to show the owner while a claim is pending. */
export interface ClaimClaimant {
  id: string;
  full_name: string;
}

/** Released only once the claim is approved. */
export interface ClaimContact {
  full_name: string;
  email: string;
  phone: string | null;
}

export interface Claim {
  id: string;
  item_id: string;
  status: ClaimStatus;
  message: string | null;
  answers: ClaimAnswer[];
  claimant: ClaimClaimant;
  created_at: string;
  resolved_at: string | null;
  contact: ClaimContact | null;
}

export interface CreateClaimPayload {
  message?: string;
  answers: ClaimAnswer[];
}
