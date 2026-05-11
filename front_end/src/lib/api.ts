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
  risk_distribution: { name: string; value: number; color: string }[]
  verification_data: { name: string; value: number; color: string }[]
}

export interface SearchSession {
  search_id: number
  user_id: number
  search_query: string
  context_id: number | null
  context_name: string | null
  created_at: string | null
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
    window.location.href = "/auth/login"
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
  credits: () =>
    request<{
      credits_remaining: number;
      allocated_total: number;
      low_credits: boolean;
      empty: boolean;
    }>("/api/v1/dashboard/credits"),

  // Sessions
  sessions: () => request<SearchSession[]>("/api/v1/sessions"),
  createSession: (data: any) =>
    request<any>("/api/v1/search", { method: "POST", body: JSON.stringify(data) }),
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
  triggerDiscovery: (sessionId: number, platform: string) =>
    request<any>("/api/v1/search", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, user_id: 0, query: "", discovery_platform: platform, skip_discovery: false })
    }),

  // Results
  results: (searchId: number) => request<any[]>(`/api/v1/results/${searchId}`),
  leadDetail: (resultId: number) => request<any>(`/api/v1/dashboard/result/${resultId}`),
  updateClientStatus: (resultId: number, isSaved: boolean) =>
    request(`/api/v1/results/${resultId}/client-status`,
      { method: "PUT", body: JSON.stringify({ is_saved_client: isSaved }) }),

  // Clients
  clients: () => request<any[]>("/api/v1/clients"),
  deleteClients: (resultIds: number[]) =>
    request<{ status: string; updated_count: number }>(
      "/api/v1/clients",
      { method: "DELETE", body: JSON.stringify(resultIds) }
    ),

  // Contexts
  contexts: () => request<any[]>("/api/v1/contexts"),
  createContext: (data: any) =>
    request<any>("/api/v1/contexts", { method: "POST", body: JSON.stringify(data) }),
  deleteContext: (id: number) =>
    request<any>(`/api/v1/contexts/${id}`, { method: "DELETE" }),
  updateContext: (id: number, data: any) =>
    request<any>(`/api/v1/contexts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Verification
  verifyBusiness: (businessId: number) =>
    request<any>(`/api/v1/verification/verify/${businessId}`, { method: "POST" }),
  verifyBatch: (businessIds: number[]) =>
    request<any>("/api/v1/verification/verify/batch",
      { method: "POST", body: JSON.stringify({ business_ids: businessIds }) }),
  verificationStatus: (businessId: number) =>
    request<{ business_id: number; verification_status: string | null; verification_result: string | null; verification_score: number | null }>(
      `/api/v1/verification/${businessId}/status`
    ),

  // Relevancy
  runRelevancy: (business: any, searchId: number, contextId: number | null, signal?: AbortSignal) =>
    request<any>("/api/relevancy/v2/run", {
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

  // Email drafts
  emailDrafts: (businessId: number) => request<any[]>(`/api/v1/email/drafts/${businessId}?t=${Date.now()}`),
  emailDraftDetail: (draftId: number) => request<any>(`/api/v1/email/drafts/detail/${draftId}?t=${Date.now()}`),
  generateEmail: (businessId: number, userId: number, exporterProfileId: number, userInstructions?: string) =>
    request<any>(`/api/v1/email/generate/${businessId}`,
      { method: "POST", body: JSON.stringify({ user_id: userId, exporter_profile_id: exporterProfileId, sequence_position: 1, user_instructions: userInstructions }) }),
  generateBatch: (searchId: number, userId: number, userInstructions?: string) =>
    request<any>("/api/v1/email/generate-batch",
      { method: "POST", body: JSON.stringify({ search_id: searchId, user_id: userId, sequence_position: 1, user_instructions: userInstructions ?? "" }) }),
  updateDraft: (draftId: number, payload: { subject: string; body: string }) =>
    request<any>(`/api/v1/email/drafts/detail/${draftId}`,
      { method: "PATCH", body: JSON.stringify(payload) }),
  approveDraft: (draftId: number) =>
    request<any>(`/api/v1/email/drafts/${draftId}/approve`, { method: "PATCH" }),
  sendDraft: (draftId: number) =>
    request<any>(`/api/v1/email/drafts/${draftId}/send`, { method: "PATCH" }),
  deleteDraft: (draftId: number) =>
    request<any>(`/api/v1/email/drafts/${draftId}`, { method: "DELETE" }),

  findEmail: (resultId: number) =>
    request<{ cached: boolean; emails: any[]; primary_contact_email: string | null; message?: string }>(
      `/api/v1/leads/${resultId}/find-email`,
      { method: "POST" }
    ),

  // Exporter profile
  getMyProfile: () => request<any>("/api/v1/exporter-profiles/me"),
  createProfile: (data: any) =>
    request<any>("/api/v1/exporter-profiles/",
      { method: "POST", body: JSON.stringify(data) }),
  updateProfile2: (profileId: number, data: any) =>
    request<any>(`/api/v1/exporter-profiles/${profileId}`,
      { method: "PUT", body: JSON.stringify(data) }),

  // Contacts
  contacts: () => request<any[]>("/api/v1/contacts"),

  // Export
  exportResults: (searchId: number) =>
    request<any>("/api/v1/export",
      { method: "POST", body: JSON.stringify({ search_id: searchId }) }),

  // Admin
  adminUsers: () => request<any[]>("/api/v1/admin/users"),
  adminManageCredits: (userId: number, action: string, amount: number) =>
    request<any>(`/api/v1/admin/users/${userId}/credits`,
      { method: "POST", body: JSON.stringify({ action, amount }) }),
  adminToggleActive: (userId: number) =>
    request<any>(`/api/v1/admin/users/${userId}/toggle-active`,
      { method: "POST" }),
  adminHealth: () => request<any>("/api/v1/admin/health"),
}

export async function exportClients(params: {
  format: "csv" | "excel";
  status?: string;
  ids?: string[];
}): Promise<void> {
  const token = getToken()
  const queryParams = new URLSearchParams({ format: params.format })
  if (params.status) queryParams.set("status", params.status)

  const res = await fetch(`${BASE_URL}/api/v1/export?${queryParams.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params.ids ?? null),
  })

  if (!res.ok) {
    throw new Error(`${res.status}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = params.format === "csv" ? "Client_List.csv" : "Client_List.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

export async function reverifyClient(resultId: number): Promise<void> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  
  const res = await fetch(`${BASE_URL}/api/v1/verification/verify/${resultId}`, {
    method: "POST",
    headers,
  })
  
  if (!res.ok) {
    throw new Error(`Re-verification failed: ${res.status}`)
  }
}
