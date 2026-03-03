export type AgentRunStatus = 'pending' | 'completed' | 'failed';
export type RelevanceDecision = 'relevant' | 'irrelevant' | 'unknown';
export type OutreachStatus = 'pending' | 'drafted' | 'sent' | 'skipped';
export type VerificationBucket = 'verified' | 'partially-verified' | 'not-verified';

export interface SearchResult {
  result_id: number;
  search_id: number;
  relevance_status: AgentRunStatus;
  relevance_decision: RelevanceDecision | null;
  relevance_score: number | null;
  verification_status: AgentRunStatus;
  verification_score: number | null;
  outreach_status?: OutreachStatus | null;
  place_id?: string | null;
  business_name?: string | null;
  address?: string | null;
  phone_number?: string | null;
  website?: string | null;
  is_saved_client?: boolean;
  relevance_reason?: string | null;
  verification_result?: string | null;
  verification_reason?: string | null;
  email_found?: string | null;
  email_status?: string | null;
  raw_data?: Record<string, any> | null;
  types?: string[] | null;
  rating?: number | null;
  context_name?: string | null;
  context_prompt?: string | null;
  created_at?: string | null;
  dateAdded?: string | null;
  social_links?: string[];
  email_addresses?: string[];
  contact_info?: {
    socials?: string[];
    emails?: string[];
  };
  verification_reasoning?: string | null;
  evidence_summary?: string | null;
}

export const getResultId = (result: SearchResult): string => String(result.result_id);

export const getVerificationBucket = (
  result: Pick<SearchResult, 'verification_status' | 'verification_score'>
): VerificationBucket => {
  if (result.verification_status !== 'completed') {
    return 'not-verified';
  }
  const score = result.verification_score ?? 0;
  if (score > 70) {
    return 'verified';
  }
  if (score > 40) {
    return 'partially-verified';
  }
  return 'not-verified';
};

export const getVerificationStatusText = (
  result: Pick<SearchResult, 'verification_status' | 'verification_score'>
): 'Verified' | 'Partially Verified' | 'Unverified' => {
  const bucket = getVerificationBucket(result);
  if (bucket === 'verified') {
    return 'Verified';
  }
  if (bucket === 'partially-verified') {
    return 'Partially Verified';
  }
  return 'Unverified';
};
