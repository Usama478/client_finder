import { api } from "./api"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

function getToken(): string | null {
  return localStorage.getItem("cf_token")
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem("cf_token")
    localStorage.removeItem("cf_user")
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.replace(`/auth/login?reason=session_expired&returnTo=${returnTo}`)
    throw new Error("Unauthorized")
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }))
    throw new Error(error.detail || "Request failed")
  }
  return res.json()
}

export type CampaignStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "exhausted"
  | "failed"

export type DiscoveryPlatform = "maps" | "serp" | "both"

export type CampaignResultStatus =
  | "pending_relevance"
  | "running_relevance"
  | "rejected_relevance"
  | "queued_for_verification"
  | "running_verification"
  | "rejected_verification"
  | "verified"
  | "error"

export interface Campaign {
  id: number
  status: CampaignStatus
  search_intent: string
  target_count: number
  relevance_threshold: number
  credit_budget: number
  discovery_platform: DiscoveryPlatform
  current_pass: number
  verified_count: number
  credits_used: number
  total_discovered: number
  total_relevance_passed: number
  total_verification_passed: number
  estimated_cost_low: number | null
  estimated_cost_high: number | null
  activity_log: { time: string; level: string; message: string }[]
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
}

export interface CampaignResult {
  result_id: number
  business_name: string
  website: string
  source: "maps" | "serp"
  campaign_status: CampaignResultStatus
  campaign_pass: number
  relevance_decision: string | null
  relevance_score: number | null
  confidence: number | null
  relevance_reason: string | null
  verification_result: string | null
  verification_score: number | null
  is_saved_client: boolean
  primary_email: string | null
}

export interface CostEstimate {
  low: number
  high: number
  breakdown: {
    estimated_passes: number
    total_candidates: number
    total_relevance_runs: number
    total_verification_runs: number
  }
}

export const campaignsApi = {
  estimate: (targetCount: number, platform: string) =>
    req<CostEstimate>(`/api/v1/campaigns/estimate?target_count=${targetCount}&platform=${platform}`),
  create: (data: {
    search_intent: string
    context_id?: number | null
    target_count: number
    relevance_threshold: number
    credit_budget: number
    discovery_platform: string
  }) => req<Campaign>("/api/v1/campaigns", { method: "POST", body: JSON.stringify(data) }),
  list: () => req<Campaign[]>("/api/v1/campaigns"),
  getActive: () => req<Campaign | null>("/api/v1/campaigns/active"),
  get: (id: number) => req<Campaign>(`/api/v1/campaigns/${id}`),
  getResults: (id: number) => req<CampaignResult[]>(`/api/v1/campaigns/${id}/results`),
  cancel: (id: number) => req<{ status: CampaignStatus }>(`/api/v1/campaigns/${id}/cancel`, { method: "POST" }),
  saveClient: (campaignId: number, resultId: number) =>
    req<{ status: string }>(`/api/v1/campaigns/${campaignId}/save-client/${resultId}`, { method: "POST" }),
  resume: (id: number) => req<Campaign>(`/api/v1/campaigns/${id}/resume`, { method: "POST" }),
  getPendingCount: (id: number) => req<CampaignResult[]>(`/api/v1/campaigns/${id}/results`).then(r => r.filter((x: CampaignResult) => x.campaign_status === "pending_relevance").length).catch(err => { console.error(err); return 0; }),
}
