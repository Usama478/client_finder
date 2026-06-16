export class CreditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CreditError"
  }
}

export interface DashboardStats {
  total_searches: number
  total_clients: number
  verified_clients: number
  unverified_clients: number
  leads_found: number
  relevant_leads: number
  emails_sent: number
  relevant_leads_count: number
  verification_processed_count: number
  // KPI card outcome metrics
  saved_clients: number
  verified_count: number
  // Pipeline Overview volume metrics
  relevancy_processed: number
  verification_processed: number
  clients_count: number
  emails_drafted: number
  // Next Actions / Funnel pending-stage metrics
  pending_relevancy: number
  pending_verification: number
  verified_passed: number
  risk_distribution: { name: string; value: number; color: string }[]
  verification_data: { name: string; value: number; color: string }[]
}

export interface SearchSession {
  search_id: number
  user_id: number
  search_query: string
  search_location?: string | null
  context_id: number | null
  context_name: string | null
  discovery_platform?: "maps" | "serp" | "both" | null
  created_at: string | null
  result_count?: number
  results_count: number
  status: "done" | "scoring"
  next_page_token: string | null
}

export interface ActivityEvent {
  type: string
  text: string
  time: string
  color: string
}

export interface UserCredit {
  credits_remaining: number
  allocated_total: number
  low_credits: boolean
  empty: boolean
}

export interface Lead {
  id: number
  search_id: number
  name: string
  website: string | null
  source: string
  relevance_decision: string | null
  relevance_score: number | null
  relevance_reason: string | null
  verification_score: number | null
  verified_product_catalog: Record<string, unknown> | null
  primary_contact_email: string | null
  campaign_status: string | null
  is_saved_client: boolean
}

export interface LeadsResponse {
  leads: Lead[]
  total: number
  page: number
  total_pages: number
}

export interface InFlightManualJob {
  business_id: number
  search_id: number | null
  business_name: string | null
  status: string | null
  current_phase: string | null
}

export interface InFlightManualJobsResponse {
  items: InFlightManualJob[]
}

export interface SearchResult {
  result_id: number
  session_id: number
  business_name: string
  website: string | null
  source: string
  relevance_decision: string | null
  relevance_score: number | null
  relevance_reason: string | null
  verification_score: number | null
  verification_result: string | null
  legitimacy_score: number | null
  verified_product_catalog: Record<string, unknown> | null
  serp_enrichment: Record<string, unknown> | null
  linkedin_url: string | null
  primary_contact_email: string | null
  hunter_emails: unknown[] | null
  campaign_status: string | null
  is_saved_client: boolean
}

export interface EmailDraft {
  id: number
  business_id: number
  subject: string
  body: string
  status: string
  created_at: string
}

export interface ExporterProfile {
  id: number
  user_id: number
  company_name: string
  company_location?: string | null
  product_categories?: string[] | null
  certifications?: string[] | null
  export_markets?: string[] | null
  target_buyer_types?: string[] | null
  value_proposition?: string | null
  contact_person_name?: string | null
  products?: string
  target_markets?: string
  business_type?: string
  location?: string
}

export interface GenerateEmailResult {
  status: string
  draft_id?: number
  subject?: string
  reason?: string
  skip_code?: string
  message?: string
}

export interface SearchContext {
  id: number
  user_id: number
  name: string
  description: string
  created_at: string
}

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

function getToken(): string | null {
  return localStorage.getItem("cf_token")
}

export function setToken(token: string): void {
  localStorage.setItem("cf_token", token)
}

export function clearToken(): void {
  localStorage.removeItem("cf_token")
  localStorage.removeItem("cf_user")
}

function redirectToLogin(): void {
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
  window.location.replace(`/auth/login?reason=session_expired&returnTo=${returnTo}`)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    redirectToLogin()
    throw new Error("Unauthorized")
  }
  if (res.status === 402) {
    const error = await res.json().catch(() => ({ detail: "Insufficient credits" }))
    throw new CreditError(error.detail || "Insufficient credits. Contact your team to top up.")
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }))
    throw new Error(error.detail || "Request failed")
  }
  return res.json()
}

async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    redirectToLogin()
    throw new Error("Unauthorized")
  }
  if (res.status === 402) {
    const error = await res.json().catch(() => ({ detail: "Insufficient credits" }))
    throw new CreditError(error.detail || "Insufficient credits. Contact your team to top up.")
  }
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.blob()
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; user_id: number; name: string; email: string; is_admin: boolean }>(
      "/api/v1/auth/login-json",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  signup: (name: string, email: string, password: string) =>
    request<{ message: string }>(
      "/api/v1/auth/signup",
      { method: "POST", body: JSON.stringify({ name, email, password }) }
    ),
  me: () => request<{ user_id: number; name: string; email: string; is_admin: boolean }>("/api/v1/auth/me"),
  logout: () => request("/api/v1/auth/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    request<{ message: string; reset_token?: string }>(
      "/api/v1/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) }
    ),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>(
      "/api/v1/auth/reset-password",
      { method: "POST", body: JSON.stringify({ token, password }) }
    ),
  verifyEmail: (token: string) =>
    request<{ message: string }>(
      `/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: "POST" }
    ),
  updateProfile: (data: { name?: string; email?: string; current_password?: string; new_password?: string }) =>
    request<{ user_id: number; name: string; email: string }>(
      "/api/v1/auth/update-profile",
      { method: "PUT", body: JSON.stringify(data) }
    ),

  // Dashboard
  dashboardStats: () => request<DashboardStats>("/api/v1/dashboard/stats"),
  activityLog: (limit = 20) => request<ActivityEvent[]>(`/api/v1/dashboard/activity?limit=${limit}`),
  credits: () => request<UserCredit>("/api/v1/dashboard/credits"),

  // Sessions
  sessions: () => request<SearchSession[]>("/api/v1/sessions"),
  createSession: (data: {
    user_id?: number
    query?: string
    search_query?: string
    search_location?: string
    page_token?: string | null
    context_id?: number | null
    session_id?: number | null
    ai_context?: string | null
    discovery_platform?: "maps" | "serp" | "both"
    skip_discovery?: boolean
  }) =>
    request<SearchSession & { status?: string; results_added?: number }>("/api/v1/search", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  generateQueries: (sessionId: number) =>
    request<{ maps_queries: string[]; web_queries: string[] }>(
      `/api/v1/sessions/${sessionId}/generate-queries`,
      { method: "POST" }
    ),
  updateApprovedQueries: (sessionId: number, queries: { maps_queries: string[]; web_queries: string[] }) =>
    request<{ status: string }>(
      `/api/v1/sessions/${sessionId}/approved-queries`,
      { method: "PATCH", body: JSON.stringify(queries) }
    ),
  triggerDiscovery: (
    sessionId: number,
    platform: string,
    query = "",
    skipDiscovery = false
  ) =>
    request<{ status: string; message: string }>("/api/v1/search", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        query,
        discovery_platform: platform,
        skip_discovery: skipDiscovery,
      }),
    }),

  // Leads Hub
  getLeads: (params: {
    filter?: string
    source?: string
    session_id?: number
    q?: string
    page?: number
  }) => {
    const qs = new URLSearchParams()
    if (params.filter) qs.set("filter", params.filter)
    if (params.source) qs.set("source", params.source)
    if (params.session_id != null) qs.set("session_id", String(params.session_id))
    if (params.q) qs.set("q", params.q)
    if (params.page != null) qs.set("page", String(params.page))
    const query = qs.toString()
    return request<LeadsResponse>(`/api/v1/leads${query ? `?${query}` : ""}`)
  },

  // Results
  results: (searchId: number) => request<SearchResult[]>(`/api/v1/results/${searchId}`),
  leadDetail: (resultId: number) => request<SearchResult>(`/api/v1/dashboard/result/${resultId}`),
  updateClientStatus: (resultId: number, isSaved: boolean) =>
    request(`/api/v1/results/${resultId}/client-status`,
      { method: "PUT", body: JSON.stringify({ is_saved_client: isSaved }) }),

  // Clients
  clients: () => request<SearchResult[]>("/api/v1/clients"),
  deleteClients: (resultIds: number[]) =>
    request<{ status: string; updated_count: number }>(
      "/api/v1/clients",
      { method: "DELETE", body: JSON.stringify(resultIds) }
    ),

  // Contexts
  contexts: () => request<SearchContext[]>("/api/v1/contexts"),
  createContext: (data: any) =>
    request<SearchContext>("/api/v1/contexts", { method: "POST", body: JSON.stringify(data) }),
  deleteContext: (id: number) =>
    request<{ status: string }>(`/api/v1/contexts/${id}`, { method: "DELETE" }),
  updateContext: (id: number, data: any) =>
    request<SearchContext>(`/api/v1/contexts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Verification
  verifyBusiness: (businessId: number) =>
    request<{ status: string; business_id: number }>(`/api/v1/verification/verify/${businessId}`, { method: "POST" }),
  verifyBatch: (businessIds: number[]) =>
    request<{ status: string; count: number }>("/api/v1/verification/verify/batch",
      { method: "POST", body: JSON.stringify({ business_ids: businessIds }) }),
  verificationStatus: (businessId: number) =>
    request<{ business_id: number; verification_status: string | null; verification_result: string | null; verification_score: number | null; current_phase: string | null }>(
      `/api/v1/verification/${businessId}/status?t=${Date.now()}`
    ),
  inFlightVerification: () =>
    request<InFlightManualJobsResponse>("/api/v1/verification/in-flight"),

  // Relevancy
  runRelevancy: (business: any, searchId: number, contextId: number | null, signal?: AbortSignal) =>
    request<{ status: string; business_id: number }>("/api/v1/relevancy/v2/run", {
      method: "POST",
      signal,
      body: JSON.stringify({
        business_id: Number(business.result_id || business.id),
        website: business.website || "",
        context_id: contextId,
        search_id: searchId || 0,
        business_name: business.business_name || business.name || "",
        category: business.business_type || business.category || "",
        address: business.address || business.location || "",
        description: "",
      })
    }),
  relevancyStatus: (businessId: number) =>
    request<{
      business_id: number;
      relevance_status: string | null;
      relevance_decision: string | null;
      relevance_score: number | null;
      current_phase: string | null;
    }>(`/api/v1/relevancy/v2/${businessId}/status?t=${Date.now()}`),
  inFlightRelevancy: () =>
    request<InFlightManualJobsResponse>("/api/v1/relevancy/v2/in-flight"),

  // Email drafts
  emailDrafts: (businessId: number) => request<EmailDraft[]>(`/api/v1/email/drafts/${businessId}?t=${Date.now()}`),
  emailDraftDetail: (draftId: number) => request<EmailDraft>(`/api/v1/email/drafts/detail/${draftId}?t=${Date.now()}`),
  generateEmail: (
    businessId: number,
    userId: number,
    exporterProfileId: number,
    userInstructions?: string,
    temperature = 0.4,
  ) =>
    request<GenerateEmailResult>(`/api/v1/email/generate/${businessId}`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        exporter_profile_id: exporterProfileId,
        sequence_position: 1,
        user_instructions: userInstructions ?? "",
        temperature,
      }),
    }),
  generateBatch: (searchId: number, userId: number, userInstructions?: string, temperature = 0.4) =>
    request<{ status: string; drafted: number; created?: number; total?: number }>("/api/v1/email/generate-batch", {
      method: "POST",
      body: JSON.stringify({
        search_id: searchId,
        user_id: userId,
        sequence_position: 1,
        user_instructions: userInstructions ?? "",
        temperature,
      }),
    }),
  updateDraft: (draftId: number, payload: { subject: string; body: string }) =>
    request<EmailDraft>(`/api/v1/email/drafts/detail/${draftId}`,
      { method: "PATCH", body: JSON.stringify(payload) }),
  approveDraft: (draftId: number) =>
    request<{ status: string }>(`/api/v1/email/drafts/${draftId}/approve`, { method: "PATCH" }),
  sendDraft: (draftId: number) =>
    request<{ status: string }>(`/api/v1/email/drafts/${draftId}/send`, { method: "PATCH" }),
  deleteDraft: (draftId: number) =>
    request<{ status: string }>(`/api/v1/email/drafts/${draftId}`, { method: "DELETE" }),

  findEmail: (resultId: number) =>
    request<{ cached: boolean; emails: any[]; primary_contact_email: string | null; message?: string }>(
      `/api/v1/leads/${resultId}/find-email`,
      { method: "POST" }
    ),

  // Exporter profile
  getMyProfile: () => request<ExporterProfile>("/api/v1/exporter-profiles/me"),
  listProfiles: () =>
    request<ExporterProfile[]>("/api/v1/exporter-profiles/me"),
  createProfile: (data: any) =>
    request<ExporterProfile>("/api/v1/exporter-profiles",
      { method: "POST", body: JSON.stringify(data) }),
  updateProfile2: (profileId: number, data: any) =>
    request<ExporterProfile>(`/api/v1/exporter-profiles/${profileId}`,
      { method: "PUT", body: JSON.stringify(data) }),

  // Contacts
  contacts: () => request<SearchResult[]>("/api/v1/contacts"),

  // Export
  exportResults: (searchId: number) =>
    request<{ status: string }>("/api/v1/export",
      { method: "POST", body: JSON.stringify({ search_id: searchId }) }),

  // Admin
  adminUsers: () => request<{ user_id: number; name: string; email: string; is_admin: boolean; is_active: boolean }[]>("/api/v1/admin/users"),
  adminManageCredits: (userId: number, action: string, amount: number) =>
    request<{ status: string }>(`/api/v1/admin/users/${userId}/credits`,
      { method: "POST", body: JSON.stringify({ action, amount }) }),
  adminToggleActive: (userId: number) =>
    request<{ status: string }>(`/api/v1/admin/users/${userId}/toggle-active`,
      { method: "POST" }),
  adminHealth: () => request<Record<string, unknown>>("/api/v1/admin/health"),
}

export async function exportClients(params: {
  format: "csv" | "excel";
  status?: string;
  ids?: string[];
}): Promise<void> {
  const queryParams = new URLSearchParams({ format: params.format })
  if (params.status) queryParams.set("status", params.status)

  const blob = await requestBlob(`/api/v1/export?${queryParams.toString()}`, {
    method: "POST",
    body: JSON.stringify(params.ids ?? null),
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = params.format === "csv" ? "Client_List.csv" : "Client_List.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

export async function reverifyClient(resultId: number): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/v1/verification/verify/${resultId}`, { method: "POST" })
}
