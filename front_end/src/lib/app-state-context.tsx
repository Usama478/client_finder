import { createContext, useContext, useState, useCallback, ReactNode } from "react"

const SS_KEY = "cf_app_state"

export interface SearchPageState {
  searchQuery: string
  location: string
  industry: string
  otherIndustry: string
  showOtherIndustry: boolean
  selectedContext: number | null
  discoveryPlatform: "maps" | "serp" | "both"
  activeFilter: string
  selectedSessionId: number | null
}

export interface CampaignPageState {
  intent: string
  contextId: number | null
  targetCount: number
  threshold: number
  budget: number
  platform: "maps" | "serp" | "both"
  activeTab: "all" | "passed" | "verified"
  historyExpanded: boolean
}

export interface ClientsPageState {
  searchQuery: string
  statusFilter: string
}

export interface ContactsPageState {
  searchQuery: string
}

export interface EmailPageState {
  activeTab: string
}

export interface ActivityPageState {
  filter: string
}

interface AllPageState {
  search: SearchPageState
  campaign: CampaignPageState
  clients: ClientsPageState
  contacts: ContactsPageState
  email: EmailPageState
  activity: ActivityPageState
}

const DEFAULTS: AllPageState = {
  search: {
    searchQuery: "",
    location: "",
    industry: "",
    otherIndustry: "",
    showOtherIndustry: false,
    selectedContext: null,
    discoveryPlatform: "both",
    activeFilter: "all",
    selectedSessionId: null,
  },
  campaign: {
    intent: "",
    contextId: null,
    targetCount: 10,
    threshold: 60,
    budget: 50,
    platform: "both",
    activeTab: "all",
    historyExpanded: false,
  },
  clients: { searchQuery: "", statusFilter: "all" },
  contacts: { searchQuery: "" },
  email: { activeTab: "single" },
  activity: { filter: "all" },
}

function loadFromStorage(): AllPageState {
  try {
    const raw = sessionStorage.getItem(SS_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    const merged: AllPageState = {} as AllPageState
    for (const key of Object.keys(DEFAULTS) as (keyof AllPageState)[]) {
      merged[key] = { ...DEFAULTS[key], ...(parsed[key] || {}) } as any
    }
    return merged
  } catch {
    return DEFAULTS
  }
}

function saveToStorage(state: AllPageState) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(state))
  } catch {}
}

interface AppStateContextType {
  state: AllPageState
  setSlice: <K extends keyof AllPageState>(key: K, value: Partial<AllPageState[K]>) => void
}

const AppStateContext = createContext<AppStateContextType | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AllPageState>(loadFromStorage)

  const setSlice = useCallback(<K extends keyof AllPageState>(
    key: K,
    value: Partial<AllPageState[K]>
  ) => {
    setState(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...value } }
      saveToStorage(next)
      return next
    })
  }, [])

  return (
    <AppStateContext.Provider value={{ state, setSlice }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function usePageState<K extends keyof AllPageState>(key: K): [AllPageState[K], (value: Partial<AllPageState[K]>) => void] {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error("usePageState must be used inside AppStateProvider")
  const set = useCallback((value: Partial<AllPageState[K]>) => ctx.setSlice(key, value), [ctx, key])
  return [ctx.state[key], set]
}
