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
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }))
    throw new Error(error.detail || "Request failed")
  }
  return res.json()
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; user_id: number; name: string; email: string }>(
      "/api/v1/auth/login-json",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  signup: (name: string, email: string, password: string) =>
    request<{ access_token: string; token_type: string; user_id: number; name: string; email: string }>(
      "/api/v1/auth/signup",
      { method: "POST", body: JSON.stringify({ name, email, password }) }
    ),
  me: () => request<{ user_id: number; name: string; email: string }>("/api/v1/auth/me"),
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
  updateProfile: (data: { name?: string; email?: string; current_password?: string; new_password?: string }) =>
    request<{ user_id: number; name: string; email: string }>(
      "/api/v1/auth/update-profile",
      { method: "PUT", body: JSON.stringify(data) }
    ),

  // Dashboard
  dashboardStats: () => request<any>("/api/v1/dashboard/stats"),
  activityLog: (limit = 20) => request<any[]>(`/api/v1/dashboard/activity?limit=${limit}`),

  // Sessions
  sessions: (userId: number) => request<any[]>(`/api/v1/sessions/${userId}`),
  createSession: (data: any) =>
    request<any>("/api/v1/search", { method: "POST", body: JSON.stringify(data) }),

  // Results
  results: (searchId: number) => request<any[]>(`/api/v1/results/${searchId}`),
  leadDetail: (resultId: number) => request<any>(`/api/v1/dashboard/result/${resultId}`),
  updateClientStatus: (resultId: number, isSaved: boolean) =>
    request(`/api/v1/results/${resultId}/client-status`,
      { method: "PUT", body: JSON.stringify({ is_saved_client: isSaved }) }),

  // Clients
  clients: () => request<any[]>("/api/v1/clients"),

  // Contexts
  contexts: () => request<any[]>("/api/v1/contexts"),
  createContext: (data: any) =>
    request<any>("/api/v1/contexts", { method: "POST", body: JSON.stringify(data) }),

  // Verification
  verifyBusiness: (businessId: number) =>
    request<any>(`/api/v1/verification/verify/${businessId}`, { method: "POST" }),
  verifyBatch: (businessIds: number[]) =>
    request<any>("/api/v1/verification/verify/batch",
      { method: "POST", body: JSON.stringify({ business_ids: businessIds }) }),

  // Relevancy
  runRelevancy: (businessId: number, searchId: number) =>
    request<any>("/api/relevancy/v2/run",
      { method: "POST", body: JSON.stringify({ business_id: businessId, search_id: searchId }) }),

  // Email drafts
  emailDrafts: (businessId: number) => request<any[]>(`/api/v1/email/drafts/${businessId}`),
  emailDraftDetail: (draftId: number) => request<any>(`/api/v1/email/drafts/detail/${draftId}`),
  generateEmail: (businessId: number, userId: number) =>
    request<any>(`/api/v1/email/generate/${businessId}`,
      { method: "POST", body: JSON.stringify({ user_id: userId, sequence_position: 1 }) }),
  generateBatch: (searchId: number, userId: number) =>
    request<any>("/api/v1/email/generate-batch",
      { method: "POST", body: JSON.stringify({ search_id: searchId, user_id: userId, sequence_position: 1 }) }),
  approveDraft: (draftId: number) =>
    request<any>(`/api/v1/email/drafts/${draftId}/approve`, { method: "PATCH" }),
  sendDraft: (draftId: number) =>
    request<any>(`/api/v1/email/drafts/${draftId}/send`, { method: "PATCH" }),

  // Exporter profile
  getMyProfile: () => request<any>("/api/v1/exporter-profiles/me"),
  createProfile: (data: any) =>
    request<any>("/api/v1/exporter-profiles",
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
}
