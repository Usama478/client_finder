import { useEffect, useRef, useState } from "react"
import { Zap, Target, ShieldCheck, Search, ChevronDown, ChevronUp, Play, StopCircle, Save, ExternalLink, RefreshCw } from "lucide-react"
import { useSearchParams, useNavigate, Link } from "react-router"
import { api } from "../../../lib/api"
import { campaignsApi, Campaign, CampaignResult, CostEstimate } from "../../../lib/campaigns-api"
import { toast } from "sonner"

// ── tiny helpers ────────────────────────────────────────────────────────────
const S = {
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 } as React.CSSProperties,
  label: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest" as const,
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending_relevance:      { bg: "rgba(90,100,120,0.2)",   text: "#8a95a8", label: "Queued" },
    running_relevance:      { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa", label: "Checking…" },
    rejected_relevance:     { bg: "rgba(239,68,68,0.12)",   text: "#f87171", label: "Rejected (rel)" },
    queued_for_verification:{ bg: "rgba(245,158,11,0.12)",  text: "#fbbf24", label: "Awaiting verify" },
    running_verification:   { bg: "rgba(139,92,246,0.15)",  text: "#a78bfa", label: "Verifying…" },
    rejected_verification:  { bg: "rgba(249,115,22,0.12)",  text: "#fb923c", label: "Rejected (ver)" },
    verified:               { bg: "rgba(16,185,129,0.12)",  text: "#34d399", label: "✓ Verified" },
    error:                  { bg: "rgba(239,68,68,0.12)",   text: "#f87171", label: "Error" },
  }
  const c = map[status] || { bg: "rgba(90,100,120,0.2)", text: "#8a95a8", label: status }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>{c.label}</span>
  )
}

function LogLevel({ level }: { level: string }) {
  if (level === "error") return <span className="text-red-400">✗</span>
  if (level === "warn")  return <span className="text-amber-400">⚠</span>
  return <span className="text-blue-400">›</span>
}

// ── main page ────────────────────────────────────────────────────────────────
export default function CampaignEnginePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // setup form
  const [intent, setIntent] = useState("")
  const [contextId, setContextId] = useState<number | null>(null)
  const [contexts, setContexts] = useState<{ id: number; name: string }[]>([])
  const [targetCount, setTargetCount] = useState(10)
  const [threshold, setThreshold] = useState(60)
  const [budget, setBudget] = useState(50)
  const [platform, setPlatform] = useState<"maps" | "serp" | "both">("both")
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [launching, setLaunching] = useState(false)
  const [formError, setFormError] = useState("")

  // campaign state
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [results, setResults] = useState<CampaignResult[]>([])
  const [activeTab, setActiveTab] = useState<"all" | "passed" | "verified">("all")
  const [savingId, setSavingId] = useState<number | null>(null)

  // history state
  const [history, setHistory] = useState<Campaign[]>([])
  const [historyExpanded, setHistoryExpanded] = useState(false)

  // log auto-scroll
  const logRef = useRef<HTMLDivElement>(null)

  // ── init: load contexts + credits + campaign from URL or active ─────────
  useEffect(() => {
    api.contexts().then((c: any[]) => setContexts(c || [])).catch(() => {})
    api.credits().then(c => setCredits(c?.credits_remaining ?? 0)).catch(() => setCredits(0))

    const urlParams = new URLSearchParams(window.location.search)
    const campaignIdFromUrl = urlParams.get("campaign")

    if (campaignIdFromUrl) {
      const id = Number(campaignIdFromUrl)
      Promise.all([
        campaignsApi.get(id),
        campaignsApi.getResults(id),
        campaignsApi.list(),
      ]).then(([c, r, h]) => {
        setCampaign(c)
        setResults(r || [])
        setHistory(h || [])
      }).catch(() => {
        campaignsApi.list().then(h => setHistory(h || [])).catch(() => {})
      })
    } else {
      Promise.all([
        campaignsApi.getActive(),
        campaignsApi.list(),
      ]).then(([c, h]) => {
        setHistory(h || [])
        if (c) {
          setCampaign(c)
          return campaignsApi.getResults(c.id)
        }
        return Promise.resolve([])
      }).then(r => {
        if (r && r.length > 0) setResults(r)
      }).catch(() => {})
    }
  }, [])

  // ── cost estimate whenever target/platform changes ───────────────────────
  useEffect(() => {
    if (campaign) return
    const t = setTimeout(() => {
      campaignsApi.estimate(targetCount, platform).then(setEstimate).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [targetCount, platform, campaign])

  // ── polling while campaign is running ────────────────────────────────────
  useEffect(() => {
    if (!campaign || (campaign.status !== "running" && campaign.status !== "pending")) return
    const iv = setInterval(async () => {
      try {
        const updated = await campaignsApi.get(campaign.id)
        setCampaign(updated)
        const r = await campaignsApi.getResults(campaign.id)
        setResults(r ?? [])
      } catch {}
    }, 4000)
    return () => clearInterval(iv)
  }, [campaign?.id, campaign?.status, searchParams])

  // ── auto-scroll log ───────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [campaign?.activity_log?.length])

  // ── launch ────────────────────────────────────────────────────────────────
  async function handleLaunch() {
    if (!intent.trim()) { setFormError("Please describe what you're looking for."); return }
    if (budget < 5)     { setFormError("Minimum budget is 5 credits."); return }
    setFormError("")
    setLaunching(true)
    try {
      const c = await campaignsApi.create({
        search_intent: intent,
        context_id: contextId,
        target_count: targetCount,
        relevance_threshold: threshold,
        credit_budget: budget,
        discovery_platform: platform,
      })
      setCampaign(c)
      setSearchParams({ campaign: String(c.id) })
      setResults([])
    } catch (e: any) {
      setFormError(e.message || "Failed to launch campaign.")
    } finally {
      setLaunching(false)
    }
  }

  // ── cancel ────────────────────────────────────────────────────────────────
  async function handleCancel() {
    if (!campaign) return
    try {
      await campaignsApi.cancel(campaign.id)
      setCampaign(prev => prev ? { ...prev, status: "failed" } : null)
      toast.success("Campaign stopped")
    } catch {
      toast.error("Failed to stop campaign")
    }
  }

  // ── reset (new campaign) ──────────────────────────────────────────────────
  function handleReset() {
    setCampaign(null)
    setResults([])
    setIntent("")
    setContextId(null)
    setEstimate(null)
    setSearchParams({})
  }

  // ── save client ───────────────────────────────────────────────────────────
  async function handleSave(result: CampaignResult) {
    if (!campaign) return
    setSavingId(result.result_id)
    try {
      await campaignsApi.saveClient(campaign.id, result.result_id)
      setResults(prev => prev.map(r => r.result_id === result.result_id ? { ...r, is_saved_client: true } : r))
      toast.success("Client saved")
    } catch {
      toast.error("Failed to save client")
    }
    setSavingId(null)
  }

  // ── view history campaign ─────────────────────────────────────────────────
  async function handleViewHistory(id: number) {
    setSearchParams({ campaign: String(id) })
    try {
      const [c, r, h] = await Promise.all([
        campaignsApi.get(id),
        campaignsApi.getResults(id),
        campaignsApi.list(),
      ])
      setHistory(h || [])
      setResults(r || [])
      setCampaign(c)
      setHistoryExpanded(true)
    } catch {}
  }

  // ── resume campaign ───────────────────────────────────────────────────────
  async function handleResume() {
    if (!campaign) return
    try {
      const updated = await campaignsApi.resume(campaign.id)
      setCampaign(updated)
      toast.success("Campaign resumed")
    } catch {
      toast.error("Failed to resume campaign")
    }
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const isRunning = campaign?.status === "running" || campaign?.status === "pending"
  const isDone = campaign && !isRunning

  const filteredResults = results.filter(r => {
    if (activeTab === "passed") return ["queued_for_verification","running_verification","rejected_verification","verified"].includes(r.campaign_status || "")
    if (activeTab === "verified") return r.campaign_status === "verified"
    return true
  })

  const pendingCount = results.filter(r => r.campaign_status === "pending_relevance").length

  const progressPct = campaign ? Math.round((campaign.verified_count / campaign.target_count) * 100) : 0
  const creditPct = campaign ? Math.round((campaign.credits_used / campaign.credit_budget) * 100) : 0

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5 page-enter max-w-5xl mx-auto">

      {/* ── SETUP PANEL ─────────────────────────────────────────────────── */}
      <div style={S.card} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-bold text-base text-foreground flex items-center gap-2" style={{ fontFamily: "Syne, sans-serif" }}>
              <Zap className="h-4 w-4 text-blue-400" /> Campaign Engine
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Automate discovery → relevance → verification in one pass
            </div>
          </div>
          {isDone && (
            <button onClick={handleReset}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> New Campaign
            </button>
          )}
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${campaign ? "opacity-50 pointer-events-none" : ""}`}>
          {/* Intent */}
          <div className="md:col-span-2">
            <label className={S.label}>What are you looking for?</label>
            <textarea value={intent} onChange={e => setIntent(e.target.value)} rows={2}
              placeholder="e.g. US women's fashion retailers, UK homeware brands, German industrial suppliers…"
              className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }} />
          </div>

          {/* Context */}
          <div>
            <label className={S.label}>AI Context (optional)</label>
            <select value={contextId ?? ""} onChange={e => setContextId(e.target.value ? Number(e.target.value) : null)}
              className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
              <option value="">No context</option>
              {contexts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Platform */}
          <div>
            <label className={S.label}>Discovery Platform</label>
            <div className="flex gap-2 mt-1.5">
              {(["maps","serp","both"] as const).map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: platform === p ? "rgba(59,130,246,0.2)" : "var(--muted)",
                    border: `1px solid ${platform === p ? "rgba(59,130,246,0.5)" : "var(--border)"}`,
                    color: platform === p ? "#60a5fa" : "var(--muted-foreground)",
                  }}>
                  {p === "maps" ? "Google Maps" : p === "serp" ? "Web Search" : "Both"}
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div>
            <label className={S.label}>Target Verified Clients</label>
            <input type="number" min={1} max={50} value={targetCount} onChange={e => setTargetCount(Number(e.target.value))}
              className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }} />
          </div>

          {/* Budget */}
          <div>
            <label className={S.label}>
              Max Credits&nbsp;
              {credits !== null && <span className="text-blue-400">(you have {credits})</span>}
            </label>
            <input type="number" min={5} value={budget} onChange={e => setBudget(Number(e.target.value))}
              className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }} />
          </div>

          {/* Threshold */}
          <div className="md:col-span-2">
            <label className={S.label}>Minimum Relevance Threshold — {threshold}%</label>
            <input type="range" min={40} max={90} value={threshold} onChange={e => setThreshold(Number(e.target.value))}
              className="w-full mt-2 accent-blue-500" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>40% (broader)</span><span>90% (stricter)</span>
            </div>
          </div>
        </div>

        {/* Cost estimate */}
        {estimate && !campaign && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <Zap className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
            <span className="text-muted-foreground">Estimated cost:</span>
            <span className="font-bold text-blue-400">{estimate.low}–{estimate.high} credits</span>
            <span className="text-muted-foreground ml-2">
              (~{estimate.breakdown.estimated_passes} pass{estimate.breakdown.estimated_passes !== 1 ? "es" : ""}, {estimate.breakdown.total_candidates} candidates)
            </span>
          </div>
        )}

        {formError && (
          <div className="mt-3 text-[12px] text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)" }}>
            {formError}
          </div>
        )}

        {!campaign && (
          <button onClick={handleLaunch} disabled={launching}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-50"
            style={{ background: launching ? "var(--muted)" : "linear-gradient(135deg,#2563eb,#4f46e5)" }}>
            <Play className="h-4 w-4" />
            {launching ? "Launching…" : "Launch Campaign"}
          </button>
        )}
      </div>

      {/* ── CAMPAIGN HISTORY ─────────────────────────────────────────────── */}
      {(history.length > 0 || campaign) && (
        <div style={S.card} className="p-5">
          <button onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center justify-between w-full text-left">
            <div className={S.label}>Campaign History</div>
            {historyExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {historyExpanded && (
            <div className="mt-4 space-y-2">
              {history.map(h => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: campaign?.id === h.id ? "rgba(59,130,246,0.08)" : "var(--muted)", border: `1px solid ${campaign?.id === h.id ? "rgba(59,130,246,0.3)" : "var(--border)"}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate" title={h.search_intent}>
                      {h.search_intent.length > 40 ? h.search_intent.slice(0, 40) + "…" : h.search_intent}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{h.created_at ? new Date(h.created_at).toLocaleDateString() : "—"}</span>
                      <span>•</span>
                      <span>{h.verified_count}/{h.target_count} verified</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => {
                      const statusMap: Record<string, { bg: string; text: string }> = {
                        pending:   { bg: "rgba(90,100,120,0.2)",   text: "#8a95a8" },
                        running:   { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa" },
                        completed: { bg: "rgba(16,185,129,0.12)",  text: "#34d399" },
                        exhausted: { bg: "rgba(245,158,11,0.12)",  text: "#fbbf24" },
                        failed:    { bg: "rgba(239,68,68,0.12)",   text: "#f87171" },
                      }
                      const s = statusMap[h.status] || statusMap.pending
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                          style={{ background: s.bg, color: s.text }}>
                          {h.status}
                        </span>
                      )
                    })()}
                    <button onClick={() => handleViewHistory(h.id)}
                      className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CAMPAIGN PROGRESS ───────────────────────────────────────────── */}
      {campaign && (
        <div style={S.card} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { setCampaign(null); setResults([]); setSearchParams({}); setHistoryExpanded(true) }}
                className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                ← Campaigns
              </button>
              <div className="font-semibold text-sm text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
                Campaign Progress
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Pass {campaign.current_pass}</span>
              {(() => {
                const statusMap: Record<string, { bg: string; text: string }> = {
                  pending:   { bg: "rgba(90,100,120,0.2)",   text: "#8a95a8" },
                  running:   { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa" },
                  completed: { bg: "rgba(16,185,129,0.12)",  text: "#34d399" },
                  exhausted: { bg: "rgba(245,158,11,0.12)",  text: "#fbbf24" },
                  failed:    { bg: "rgba(239,68,68,0.12)",   text: "#f87171" },
                }
                const s = statusMap[campaign.status] || statusMap.pending
                return (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                    style={{ background: s.bg, color: s.text }}>
                    {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
                    {campaign.status}
                  </span>
                )
              })()}
              {isRunning && (
                <button onClick={handleCancel}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                  <StopCircle className="h-3.5 w-3.5" /> Stop
                </button>
              )}
            </div>
          </div>

          {/* Verified progress bar */}
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Verified clients</span>
              <span className="font-bold text-foreground">{campaign.verified_count} / {campaign.target_count}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, progressPct)}%` }} />
            </div>
          </div>

          {/* Credit bar */}
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Credits used</span>
              <span className="font-bold text-foreground">{campaign.credits_used} / {campaign.credit_budget}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className={`h-1.5 rounded-full transition-all duration-500 ${creditPct > 85 ? "bg-red-500" : creditPct > 60 ? "bg-amber-500" : "bg-blue-500"}`}
                style={{ width: `${Math.min(100, creditPct)}%` }} />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Discovered",        value: campaign.total_discovered,          icon: Search,     color: "var(--primary)" },
              { label: "Passed Relevance",   value: campaign.total_relevance_passed,    icon: Target,     color: "#8b5cf6" },
              { label: "Verified",           value: campaign.total_verification_passed, icon: ShieldCheck, color: "var(--chart-2)" },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="flex flex-col items-center p-3 rounded-lg"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                  <Icon className="h-4 w-4 mb-1" style={{ color: s.color }} />
                  <div className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground text-center">{s.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ACTIVITY LOG ────────────────────────────────────────────────── */}
      {campaign && (campaign.activity_log?.length ?? 0) > 0 && (
        <div style={S.card} className="p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Live Log</div>
          <div ref={logRef} className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {(campaign.activity_log || []).map((entry, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <LogLevel level={entry.level} />
                <span className="text-muted-foreground flex-1 leading-snug">{entry.message}</span>
                <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap flex-shrink-0">
                  {new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RESULTS ─────────────────────────────────────────────────────── */}
      {campaign && results.length > 0 && (
        <div style={S.card} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Results</div>
            <div className="flex gap-1">
              {(["all","passed","verified"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all capitalize"
                  style={{
                    background: activeTab === tab ? "rgba(59,130,246,0.2)" : "var(--muted)",
                    border: `1px solid ${activeTab === tab ? "rgba(59,130,246,0.4)" : "var(--border)"}`,
                    color: activeTab === tab ? "#60a5fa" : "var(--muted-foreground)",
                  }}>
                  {tab === "all" ? `All (${results.length})` : tab === "passed" ? `Relevance passed (${results.filter(r => ["queued_for_verification","running_verification","rejected_verification","verified"].includes(r.campaign_status||"")).length})` : `Verified (${results.filter(r => r.campaign_status === "verified").length})`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredResults.length === 0 && (
              <div className="py-6 text-center text-muted-foreground text-sm">No results in this category yet.</div>
            )}
            {filteredResults.map(r => (
              <div key={r.result_id} className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{r.business_name || r.website}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: r.source === "maps" ? "rgba(59,130,246,0.15)" : "rgba(139,92,246,0.15)",
                               color: r.source === "maps" ? "#60a5fa" : "#a78bfa" }}>
                      {r.source?.toUpperCase()}
                    </span>
                    {r.campaign_pass && r.campaign_pass > 1 && (
                      <span className="text-[10px] text-muted-foreground">Pass {r.campaign_pass}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <a href={r.website} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-blue-400/70 hover:text-blue-400 flex items-center gap-0.5 truncate max-w-[200px]">
                      {r.website?.replace(/^https?:\/\//, "")} <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                    </a>
                    {r.confidence !== null && r.confidence !== undefined && (
                      <span className="text-[11px] text-muted-foreground">
                        rel: {r.confidence <= 1 ? Math.round(r.confidence * 100) : r.confidence}%
                      </span>
                    )}
                    {r.verification_score !== null && r.verification_score !== undefined && (
                      <span className="text-[11px] text-muted-foreground">ver: {r.verification_score}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={r.campaign_status || "pending_relevance"} />
                  <Link to={`/app/business/${r.result_id}`} 
                    className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    Details
                  </Link>
                  <button onClick={() => handleSave(r)} disabled={r.is_saved_client || savingId === r.result_id}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-semibold transition-all disabled:opacity-50"
                    style={{
                      background: r.is_saved_client ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)",
                      border: `1px solid ${r.is_saved_client ? "rgba(16,185,129,0.3)" : "rgba(59,130,246,0.3)"}`,
                      color: r.is_saved_client ? "#34d399" : "#60a5fa",
                    }}>
                    <Save className="h-3 w-3" />
                    {r.is_saved_client ? "Saved" : savingId === r.result_id ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROCESS REMAINING BUTTON ────────────────────────────────────── */}
      {campaign && (campaign.status === "completed" || campaign.status === "exhausted" || campaign.status === "failed") && pendingCount > 0 && (
        <div className="flex justify-center">
          <button onClick={handleResume}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-white transition-all"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <Play className="h-4 w-4" />
            Process Remaining {pendingCount} Discovered Candidates
          </button>
        </div>
      )}
    </div>
  )
}
