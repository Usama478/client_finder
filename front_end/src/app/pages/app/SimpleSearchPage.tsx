import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { Search, ExternalLink, RefreshCw } from "lucide-react"
import { api, SearchSession } from "../../../lib/api"
import { useAuth } from "../../../lib/auth-context"
import { toast } from "sonner"

interface SimpleResult {
  result_id: number
  business_name: string
  website: string | null
  address?: string | null
  source: string
  relevance_decision: "relevant" | "irrelevant" | "low_confidence" | string | null
  relevance_score: number | null
}

const RELEVANCE_BORDER_COLOR: Record<string, string> = {
  relevant: "#4ade80",
  irrelevant: "#f87171",
  low_confidence: "#fbbf24",
}

const AVATAR_COLORS: { range: [string, string]; color: string }[] = [
  { range: ["a", "f"], color: "#3b82f6" },
  { range: ["g", "l"], color: "#8b5cf6" },
  { range: ["m", "r"], color: "#06b6d4" },
  { range: ["s", "z"], color: "#10b981" },
]

function avatarColor(name: string): string {
  const letter = (name || "").trim().charAt(0).toLowerCase()
  for (const { range, color } of AVATAR_COLORS) {
    if (letter >= range[0] && letter <= range[1]) return color
  }
  return "#6b7280"
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export default function SimpleSearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [results, setResults] = useState<SimpleResult[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [contextId, setContextId] = useState<number | null>(null)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [analyzing, setAnalyzing] = useState<Record<number, boolean>>({})
  const [analyzed, setAnalyzed] = useState<Record<number, boolean>>({})
  const [recentSessions, setRecentSessions] = useState<SearchSession[]>([])
  const [statusLines, setStatusLines] = useState<string[]>([])
  const [restoring, setRestoring] = useState<number | null>(null)
  const [analyzingAll, setAnalyzingAll] = useState(false)
  const [analyzeAllProgress, setAnalyzeAllProgress] = useState<{ done: number; total: number } | null>(null)

  const pollTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({})
  const statusTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    api.sessions()
      .then(sessions => setRecentSessions(sessions || []))
      .catch(() => setRecentSessions([]))

    const saved = sessionStorage.getItem("simple_search_state")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setQuery(parsed.query || "")
        setResults(parsed.results || [])
        setSessionId(parsed.sessionId || null)
        setContextId(parsed.contextId || null)
        setNextPageToken(parsed.nextPageToken || null)
        setStatusLines(parsed.statusLines || [])
        setHasSearched(true)
      } catch {}
    }

    return () => {
      Object.values(pollTimers.current).forEach(clearInterval)
      statusTimers.current.forEach(clearTimeout)
    }
  }, [])

  const queueStatusLine = (delay: number, line: string) => {
    const timer = setTimeout(() => {
      setStatusLines(prev => [...prev, line])
    }, delay)
    statusTimers.current.push(timer)
  }

  const handleSearch = async (overrideQuery?: string) => {
    const searchQuery = overrideQuery ?? query
    if (!searchQuery.trim() || !user) return

    sessionStorage.removeItem("simple_search_state")

    statusTimers.current.forEach(clearTimeout)
    statusTimers.current = []
    setStatusLines([])
    setSearching(true)

    queueStatusLine(0, "🔍 Searching Google Maps...")
    queueStatusLine(800, "✓ Google Maps results collected")
    queueStatusLine(1400, "🔍 Searching web directories...")
    queueStatusLine(2200, "✓ Web search results collected")
    queueStatusLine(2800, "⚡ Deduplicating results...")

    try {
      const contexts = await api.contexts()
      const defaultContext = contexts.find(c => c.name === "Default")
      const resolvedContextId = defaultContext?.id ?? contexts[0]?.id ?? null
      setContextId(resolvedContextId)

      const created = await api.createSession({
        user_id: user.user_id,
        query: searchQuery,
        discovery_platform: "both",
        context_id: resolvedContextId,
        skip_discovery: true,
      })
      const newSessionId = created?.search_id
      if (!newSessionId) throw new Error("Session creation failed")

      await api.updateApprovedQueries(newSessionId, {
        maps_queries: [searchQuery],
        web_queries: [searchQuery],
      })

      const finalSession = await api.createSession({
        user_id: user.user_id,
        query: searchQuery,
        discovery_platform: "both",
        context_id: resolvedContextId,
        skip_discovery: false,
        session_id: newSessionId,
      })

      setSessionId(newSessionId)
      setNextPageToken(finalSession?.next_page_token || null)

      const fetchedResults = await api.results(newSessionId)
      const finalResults = (fetchedResults || []) as SimpleResult[]
      setResults(finalResults)
      setHasSearched(true)
      setStatusLines(prev => [...prev, `Done — ${finalResults.length} businesses found`])

      sessionStorage.setItem("simple_search_state", JSON.stringify({
        query: searchQuery,
        results: finalResults,
        sessionId: newSessionId,
        contextId: resolvedContextId,
        nextPageToken: finalSession?.next_page_token || null,
        statusLines: [`Done — ${finalResults.length} businesses found`],
      }))
    } catch (err: unknown) {
      toast.error((err as Error).message || "Search failed")
    } finally {
      setSearching(false)
    }
  }

  const handleLoadMore = async () => {
    if (!nextPageToken || !sessionId || !user) return
    setLoadingMore(true)
    try {
      const more = await api.createSession({
        user_id: user.user_id,
        session_id: sessionId,
        page_token: nextPageToken,
        query: query,
        discovery_platform: "both",
      })
      setNextPageToken(more?.next_page_token || null)
      const refreshed = await api.results(sessionId)
      setResults((refreshed || []) as SimpleResult[])
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to load more")
    } finally {
      setLoadingMore(false)
    }
  }

  const handleAnalyze = (result: SimpleResult) => {
    if (!sessionId) return
    setAnalyzing(prev => ({ ...prev, [result.result_id]: true }))

    api.runRelevancy(result, sessionId, contextId)
      .then(() => {
        const timer = setInterval(async () => {
          try {
            const status = await api.relevancyStatus(result.result_id)
            if (status.relevance_status !== "queued" && status.relevance_status !== "processing") {
              clearInterval(timer)
              delete pollTimers.current[result.result_id]
              setAnalyzing(prev => ({ ...prev, [result.result_id]: false }))
              setAnalyzed(prev => ({ ...prev, [result.result_id]: true }))
              setResults(prev => prev.map(r =>
                r.result_id === result.result_id
                  ? { ...r, relevance_decision: status.relevance_decision, relevance_score: status.relevance_score }
                  : r
              ))
            }
          } catch {
            clearInterval(timer)
            delete pollTimers.current[result.result_id]
            setAnalyzing(prev => ({ ...prev, [result.result_id]: false }))
          }
        }, 2000)
        pollTimers.current[result.result_id] = timer
      })
      .catch((err: unknown) => {
        toast.error((err as Error).message || "Failed to start analysis")
        setAnalyzing(prev => ({ ...prev, [result.result_id]: false }))
      })
  }

  const analyzeAll = async () => {
    if (results.length === 0 || !sessionId) return
    const toAnalyze = results.filter(r => !r.relevance_decision)
    if (toAnalyze.length === 0) {
      toast.info("All results already analyzed")
      return
    }
    setAnalyzingAll(true)
    setAnalyzeAllProgress({ done: 0, total: toAnalyze.length })

    for (const result of toAnalyze) {
      if (!result.website) {
        setAnalyzeAllProgress(prev => prev ? { ...prev, done: prev.done + 1 } : prev)
        continue
      }
      try {
        await api.runRelevancy(result, sessionId, contextId)
        await new Promise<void>((resolve) => {
          const timer = setInterval(async () => {
            try {
              const status = await api.relevancyStatus(result.result_id)
              if (status.relevance_status !== "queued" && status.relevance_status !== "processing") {
                clearInterval(timer)
                setResults(prev => prev.map(r =>
                  r.result_id === result.result_id
                    ? { ...r, relevance_decision: status.relevance_decision, relevance_score: status.relevance_score }
                    : r
                ))
                resolve()
              }
            } catch {
              clearInterval(timer)
              resolve()
            }
          }, 2000)
        })
      } catch (err: unknown) {
        if ((err as Error).message?.includes("credit")) {
          toast.error("Credits exhausted")
          break
        }
      }
      setAnalyzeAllProgress(prev => prev ? { ...prev, done: prev.done + 1 } : prev)
    }

    setAnalyzingAll(false)
    setAnalyzeAllProgress(null)
    toast.success("Analysis complete")
  }

  const resetSearch = () => {
    setHasSearched(false)
    setResults([])
    setQuery("")
    setSessionId(null)
    setStatusLines([])
    setNextPageToken(null)
    setAnalyzing({})
    setAnalyzed({})
    sessionStorage.removeItem("simple_search_state")
  }

  const handleRestoreSession = async (session: SearchSession) => {
    setRestoring(session.search_id)
    try {
      const fetchedResults = await api.results(session.search_id)
      const finalResults = (fetchedResults || []) as SimpleResult[]
      setResults(finalResults)
      setSessionId(session.search_id)
      setQuery(session.search_query)
      setHasSearched(true)
      setStatusLines([`Done — ${finalResults.length} businesses found`])
      setContextId(session.context_id ?? null)
      setNextPageToken(session.next_page_token ?? null)

      sessionStorage.setItem("simple_search_state", JSON.stringify({
        query: session.search_query,
        results: finalResults,
        sessionId: session.search_id,
        contextId: session.context_id ?? null,
        nextPageToken: session.next_page_token ?? null,
        statusLines: [`Done — ${finalResults.length} businesses found`],
      }))
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to restore search")
    } finally {
      setRestoring(null)
    }
  }

  const renderRelevanceBadge = (decision: string | null, score: number | null) => {
    if (!decision) return null
    if (decision === "relevant") {
      return (
        <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "#4ade80" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", marginRight: 5 }} />
          Relevant{score != null ? ` (${score})` : ""}
        </div>
      )
    }
    if (decision === "irrelevant") {
      return (
        <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "#f87171" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", display: "inline-block", marginRight: 5 }} />
          Not Relevant
        </div>
      )
    }
    if (decision === "low_confidence") {
      return (
        <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "#fbbf24" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24", display: "inline-block", marginRight: 5 }} />
          Low Confidence
        </div>
      )
    }
    return null
  }

  const ghostButtonStyle: React.CSSProperties = {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--muted-foreground)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
  }

  const searchBarJSX = (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSearch() }}
          placeholder="Search for international buyers..."
          disabled={searching}
          style={{
            background: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 16px",
            color: "var(--foreground)",
            fontSize: 15,
            flex: 1,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => handleSearch()}
          disabled={searching || !query.trim()}
          style={{
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </div>
    </div>
  )

  const statusLinesJSX = statusLines.length > 0 && (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 4 }}>
      {statusLines.map((line, i) => {
        let color = "var(--muted-foreground)"
        let fontWeight: React.CSSProperties["fontWeight"] = undefined
        if (line.startsWith("✓")) color = "#4ade80"
        if (line.startsWith("Done —")) {
          color = "var(--foreground)"
          fontWeight = 600
        }
        return (
          <div key={i} style={{ fontSize: 12, color, fontWeight, padding: "2px 0", fontFamily: "monospace" }}>
            {line}
          </div>
        )
      })}
    </div>
  )

  if (!hasSearched) {
    return (
      <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 680 }}>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 12, textAlign: "center" }}>
            ClientFinder
          </div>
          {searchBarJSX}
          {statusLinesJSX}
          {recentSessions.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8, marginTop: 16 }}>
                Recent searches
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {recentSessions.slice(0, 4).map(session => (
                  <button
                    key={session.search_id}
                    onClick={() => handleRestoreSession(session)}
                    disabled={restoring === session.search_id}
                    style={{
                      background: "var(--muted)",
                      border: "1px solid var(--border)",
                      borderRadius: 20,
                      padding: "6px 14px",
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {restoring === session.search_id && <RefreshCw className="h-3 w-3 animate-spin" />}
                    {truncate(session.search_query, 32)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={resetSearch}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--muted-foreground)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          padding: "0 0 12px 0",
        }}
      >
        ← New Search
      </button>
      {searchBarJSX}
      {statusLinesJSX}

      {!searching && (
        <>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                Found {results.length} businesses
              </div>
              <button
                onClick={analyzeAll}
                disabled={analyzingAll}
                style={{
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.3)",
                  color: "#60a5fa",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {analyzingAll ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Analyzing {analyzeAllProgress?.done} / {analyzeAllProgress?.total}...
                  </>
                ) : (
                  "Analyze All"
                )}
              </button>
            </div>
            <a
              onClick={() => navigate("/app/search")}
              style={{ fontSize: 12, color: "#818cf8", cursor: "pointer" }}
            >
              Advanced Search →
            </a>
          </div>

          {results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>
                No businesses found
              </div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                Try different keywords or broaden your search terms.
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {results.map(r => {
                  const borderColor = r.relevance_decision
                    ? RELEVANCE_BORDER_COLOR[r.relevance_decision] || "transparent"
                    : "transparent"
                  return (
                    <div
                      key={r.result_id}
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderLeft: `3px solid ${borderColor}`,
                        borderRadius: 10,
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 15,
                          fontWeight: 700,
                          color: "white",
                          flexShrink: 0,
                          background: avatarColor(r.business_name),
                        }}
                      >
                        {(r.business_name || "?").charAt(0).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>
                            {r.business_name}
                          </span>
                          <span
                            style={{
                              background: r.source === "serp" ? "rgba(99,102,241,0.15)" : "rgba(34,197,94,0.12)",
                              color: r.source === "serp" ? "#818cf8" : "#4ade80",
                              border: `1px solid ${r.source === "serp" ? "rgba(99,102,241,0.3)" : "rgba(34,197,94,0.25)"}`,
                              borderRadius: 4,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "1px 6px",
                            }}
                          >
                            {r.source === "serp" ? "WEB" : "MAPS"}
                          </span>
                        </div>
                        {r.website && (
                          <a
                            href={r.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted-foreground)" }}
                          >
                            {r.website} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {r.address && (
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{r.address}</div>
                        )}
                        {renderRelevanceBadge(r.relevance_decision, r.relevance_score)}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        <button
                          onClick={() => handleAnalyze(r)}
                          disabled={!!analyzing[r.result_id] || analyzingAll}
                          style={ghostButtonStyle}
                        >
                          {analyzing[r.result_id] ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <RefreshCw className="h-3 w-3 animate-spin" /> Analyzing...
                            </span>
                          ) : analyzed[r.result_id] ? (
                            "Re-analyze"
                          ) : (
                            "Analyze"
                          )}
                        </button>
                        <button
                          onClick={() => navigate(`/app/business/${r.result_id}`)}
                          style={ghostButtonStyle}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {nextPageToken && (
                <div style={{ textAlign: "center" }}>
                  <button onClick={handleLoadMore} disabled={loadingMore} style={ghostButtonStyle}>
                    {loadingMore ? "Loading…" : "Load More"}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                <a onClick={() => navigate("/app/search")} style={{ fontSize: 12, color: "#818cf8", cursor: "pointer" }}>
                  Advanced Search →
                </a>
                <a onClick={() => navigate("/app/campaigns")} style={{ fontSize: 12, color: "#818cf8", cursor: "pointer" }}>
                  Start a Campaign →
                </a>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
