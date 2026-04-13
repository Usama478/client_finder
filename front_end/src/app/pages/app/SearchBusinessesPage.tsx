import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router";
import { Search, MapPin, Sparkles, ShieldCheck, Save, ExternalLink, Clock, RefreshCw, Play, Eye, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";

/* ── Shared dark style tokens ── */
const card: React.CSSProperties = { background: "#0f1218", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 };
const inputStyle: React.CSSProperties = { background: "#151a22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 12px", color: "#e8edf5", fontSize: 13, fontFamily: "DM Sans, sans-serif", width: "100%", outline: "none" };
const btnPrimary: React.CSSProperties = { background: "#3b82f6", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };
const btnGhost: React.CSSProperties = { background: "transparent", color: "#8a95a8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };

const Badge = ({ children, color }: { children: React.ReactNode; color: "green" | "blue" | "amber" | "red" | "purple" | "gray" }) => {
  const map = { green: ["rgba(16,185,129,0.1)", "#10b981"], blue: ["rgba(59,130,246,0.15)", "#60a5fa"], amber: ["rgba(245,158,11,0.1)", "#f59e0b"], red: ["rgba(239,68,68,0.1)", "#ef4444"], purple: ["rgba(139,92,246,0.12)", "#8b5cf6"], gray: ["rgba(255,255,255,0.05)", "#8a95a8"] };
  const [bg, text] = map[color];
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: bg, color: text }}>{children}</span>;
};


export default function SearchBusinessesPage() {
  const { user } = useAuth();
  const routerLocation = useLocation();
  const [searchQuery, setSearchQuery]       = useState("");
  const [location, setLocation]             = useState("");
  const [selectedContext, setSelectedContext] = useState<number | null>(null);
  const [searching, setSearching]           = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [processingAI, setProcessingAI]     = useState(false);
  const [aiProgress, setAiProgress]         = useState(0);
  const [processingVerify, setProcessingVerify] = useState(false);
  const [selectedIds, setSelectedIds]       = useState<string[]>([]);
  const [activeFilter, setActiveFilter]     = useState("all");
  const [showHistory, setShowHistory]       = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [apiContexts, setApiContexts] = useState<any[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const hasScoredLeads = results.some(
    (r: any) => r.relevance_decision !== null && r.relevance_decision !== undefined
  );

  useEffect(() => {
    if (!user) return;
    api.sessions(user.user_id)
      .then(s => {
        setSessions(s || []);
        if (s && s.length > 0) {
          setSelectedSessionId(s[0].search_id);
        }
      })
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") });
    api.contexts()
      .then(c => setApiContexts(c || []))
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") });
  }, [user]);

  useEffect(() => {
    if (routerLocation.state?.sessionId) {
      setSelectedSessionId(routerLocation.state.sessionId);
    }
  }, [location.state]);

  useEffect(() => {
    if (!selectedSessionId) return;
    setDataLoading(true);
    api.results(selectedSessionId)
      .then(r => setResults(r || []))
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") })
      .finally(() => setDataLoading(false));
  }, [selectedSessionId]);

  const contexts = apiContexts.length > 0 
    ? apiContexts.map(c => ({ id: c.context_id, name: c.name, desc: c.prompt_text || "" }))
    : [];

  const handleSearch = async () => {
    if (!searchQuery && !location) { toast.error("Enter a keyword or location to search"); return; }
    if (!user) { toast.error("Not logged in"); return; }
    setNextPageToken(null);
    setSearching(true);
    const searchToastId = toast.loading("Searching businesses…");
    try {
      const searchResponse = await api.createSession({
        user_id: user.user_id,
        query: searchQuery,
        search_location: location || "",
        context_id: selectedContext ?? null,
      });
      setNextPageToken(searchResponse?.next_page_token || null);
      toast.dismiss(searchToastId); toast.success("Search complete!");
      const newSessions = await api.sessions(user.user_id);
      setSessions(newSessions || []);
      if (newSessions && newSessions.length > 0) {
        setSelectedSessionId(newSessions[0].search_id);
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || !user || !selectedSessionId) return;
    setLoadingMore(true);
    const moreToastId = toast.loading("Loading more businesses…");
    try {
      const moreResponse = await api.createSession({
        user_id: user.user_id,
        query: searchQuery,
        search_location: location || "",
        page_token: nextPageToken,
        session_id: selectedSessionId,
        context_id: selectedContext ?? null,
      });
      setNextPageToken(moreResponse?.next_page_token || null);
      const r = await api.results(selectedSessionId);
      setResults(r || []);
      toast.dismiss(moreToastId); toast.success("More businesses loaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRunAI = async () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    setProcessingAI(true);
    setAiProgress(0);
    toast.info(`Running AI relevance on ${selectedIds.length} leads…`);
    let passed = 0;
    let failed = 0;
    try {
      for (const id of selectedIds) {
        const businessObject = results.find((r: any) => String(r.result_id) === id);
        if (businessObject) {
          if (!businessObject.website) {
            setResults(prev => prev.map(r =>
              r.result_id === Number(id)
                ? { ...r, relevance_decision: "skipped", relevance_reason: "No website — skipped" }
                : r
            ));
            failed++;
            setAiProgress(p => Math.min(p + (100 / selectedIds.length), 95));
            continue;
          }
          try {
            const response = await api.runRelevancy(businessObject, selectedSessionId || 0, "My Company");
            setResults(prev => prev.map(r =>
              r.result_id === Number(id)
                ? { ...r,
                    relevance_decision: response.relevance_decision,
                    relevance_score: response.relevance_score || response.confidence,
                    relevance_reason: response.relevance_reason }
                : r
            ));
            passed++;
          } catch (err: any) {
            setResults(prev => prev.map(r =>
              r.result_id === Number(id)
                ? { ...r, relevance_decision: "error", relevance_reason: err.message }
                : r
            ));
            failed++;
          }
        }
        setAiProgress(p => Math.min(p + (100 / selectedIds.length), 95));
      }
      if (selectedSessionId) {
        const r = await api.results(selectedSessionId);
        setResults(r || []);
      }
      toast.success(`AI complete: ${passed} scored, ${failed} skipped/failed`);
    } catch (err: any) {
      toast.error(err.message || "AI scoring failed");
    } finally {
      setProcessingAI(false);
      setAiProgress(100);
      setSelectedIds([]);
    }
  };

  const handleVerify = async () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    setProcessingVerify(true);
    toast.info(`Verifying ${selectedIds.length} leads…`);
    try {
      const validIds = selectedIds
        .map(id => Number(id))
        .filter(id => !isNaN(id) && id > 0);

      if (validIds.length === 0) {
        toast.error("No valid business IDs selected");
        setProcessingVerify(false);
        return;
      }

      await api.verifyBatch(validIds);
      if (selectedSessionId) {
        const r = await api.results(selectedSessionId);
        setResults(r || []);
      }
      toast.success("Verification complete!");
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setProcessingVerify(false);
      setSelectedIds([]);
    }
  };

  const handleSave = async () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    try {
      await Promise.all(
        selectedIds.map(id => api.updateClientStatus(Number(id), true).catch(console.error))
      );
      toast.success(`${selectedIds.length} businesses saved to Clients`);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to save some businesses");
    }
  };

  const toggle = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => setSelectedIds(p => p.length === filtered.length ? [] : filtered.map(r => r.id));

  const tableData = results.length > 0 ? results.map((r: any) => ({
    id: String(r.result_id),
    name: r.business_name || "Unknown",
    category: r.business_type || "—",
    location: r.address || "—",
    website: r.website || "",
    email: r.email_found || null,
    phone: (r.all_phones_found || [])[0] || null,
    relevanceScore: Math.round(r.relevance_score || 0),
    relevanceStatus: r.relevance_decision === "relevant" ? "passed"
      : r.relevance_decision === "irrelevant" ? "failed"
      : r.relevance_decision === "unknown" ? "low-confidence"
      : "pending",
    verificationScore: r.verification_score || null,
    verificationStatus: r.verification_result || "pending",
    reasoning: r.relevance_reason || r.verification_reason || "",
  })) : [];

  const filtered = tableData.filter(r => {
    if (activeFilter === "passed")   return r.relevanceStatus === "passed";
    if (activeFilter === "failed")   return r.relevanceStatus === "failed";
    if (activeFilter === "lowconf")  return r.relevanceStatus === "low-confidence";
    if (activeFilter === "pending")  return r.verificationStatus === "pending";
    return true;
  });

  const relevanceBadge = (s: string) => {
    if (s === "passed")         return <Badge color="green">✓ Relevant</Badge>;
    if (s === "low-confidence") return <Badge color="amber">⚠ Low Conf.</Badge>;
    if (s === "failed")         return <Badge color="red">✗ Not Relevant</Badge>;
    return <Badge color="gray">Pending</Badge>;
  };

  const verifyBadge = (s: string | null) => {
    if (s === "verified") return <Badge color="green">✓ Verified</Badge>;
    if (s === "partial")  return <Badge color="amber">⚠ Partial</Badge>;
    if (s === "failed")   return <Badge color="red">✗ Failed</Badge>;
    if (s === "running")  return <Badge color="blue">⏳ Running</Badge>;
    return <Badge color="gray">–</Badge>;
  };

  const scoreColor = (n: number) => n >= 75 ? "#10b981" : n >= 50 ? "#f59e0b" : "#ef4444";

  const filterTabs = [
    { key: "all",     label: `All (${tableData.length})` },
    { key: "passed",  label: "✓ Relevant" },
    { key: "lowconf", label: "⚠ Low Conf." },
    { key: "failed",  label: "✗ Not Relevant" },
    { key: "pending", label: "⏳ Pending" },
  ];

  return (
    <div className="p-6 space-y-4 page-enter">
      {/* Search Controls */}
      <div style={card} className="p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest block mb-1.5">Keywords / Business Type</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a6478]" />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="e.g. textile exporters, wholesale distributors…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest block mb-1.5">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a6478]" />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Country, city…" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest block mb-1.5">Industry</label>
            <select style={{ ...inputStyle, appearance: "none" }}>
              <option>All Industries</option>
              <option>Manufacturing</option>
              <option>Wholesale</option>
              <option>Technology</option>
              <option>Construction</option>
              <option>Logistics</option>
            </select>
          </div>
          <button style={btnPrimary} onClick={handleSearch} disabled={searching}>
            {searching && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {!searching && <Search className="h-3.5 w-3.5" />}
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Context selector */}
        <div className="mt-4 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[11px] text-[#5a6478] font-semibold">AI Context:</span>
          {contexts.length === 0 ? (
            <span className="text-[11px] text-[#5a6478] italic">No contexts available. Create one in the Context page.</span>
          ) : (
            <>
              <button onClick={() => setSelectedContext(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                style={selectedContext === null
                  ? { background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }
                  : { background: "#151a22", border: "1px solid rgba(255,255,255,0.07)", color: "#8a95a8" }}>
                {selectedContext === null ? "🧠 " : ""}None
              </button>
              {contexts.map(c => (
                <button key={c.id} onClick={() => setSelectedContext(c.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                  style={selectedContext === c.id
                    ? { background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }
                    : { background: "#151a22", border: "1px solid rgba(255,255,255,0.07)", color: "#8a95a8" }}>
                  {selectedContext === c.id ? "🧠 " : ""}{c.name}
                </button>
              ))}
            </>
          )}
          <Link to="/app/context">
            <button
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
              style={{ background: "#151a22", border: "1px solid rgba(255,255,255,0.07)", color: "#5a6478" }}>
              + New Context
            </button>
          </Link>
          {selectedContext !== null && (
            <span className="text-[11px] text-[#5a6478] ml-1 italic">
              {contexts.find(c => c.id === selectedContext)?.desc}
            </span>
          )}
        </div>
      </div>

      {/* AI Processing Banner */}
      {processingAI && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[#e8edf5]">AI Relevance Scoring in progress — {Math.round(aiProgress)}% complete</div>
            <div className="text-[12px] text-[#8a95a8] mt-0.5">Analysing against "{contexts.find(c => c.id === selectedContext)?.name || "default"}" context. Partial results shown below.</div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#1c2230" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${aiProgress}%`, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }} />
            </div>
          </div>
          <button style={btnGhost} onClick={() => setProcessingAI(false)}>Pause</button>
        </div>
      )}

      {/* Verification Banner */}
      {processingVerify && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <span className="text-2xl">🔒</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[#e8edf5]">Verification checks running…</div>
            <div className="text-[12px] text-[#8a95a8] mt-0.5">Checking SSL, domain age, social presence, legal registration…</div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#1c2230" }}>
              <div className="h-full rounded-full" style={{ width: "60%", background: "#10b981", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          </div>
          <button style={btnGhost} onClick={() => setProcessingVerify(false)}>Cancel</button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.25)" }}>
          <span className="text-sm font-semibold text-blue-400">{selectedIds.length} selected</span>
          <div className="flex gap-2 flex-wrap">
            <button style={btnPrimary} onClick={handleRunAI}><Sparkles className="h-3.5 w-3.5" />Run AI Relevance</button>
            {hasScoredLeads && (
              <button style={btnGhost} onClick={handleVerify}><ShieldCheck className="h-3.5 w-3.5" />Verify Selected</button>
            )}
            <button style={btnGhost} onClick={handleSave}><Save className="h-3.5 w-3.5" />Save to Clients</button>
          </div>
          <button style={{ ...btnGhost, marginLeft: "auto" }} onClick={() => setSelectedIds([])}><X className="h-3.5 w-3.5" />Clear</button>
        </div>
      )}

      {/* Results Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-0" style={{ borderBottom: "none" }}>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-bold text-[#e8edf5]" style={{ fontFamily: "Syne, sans-serif" }}>Search Results</span>
            <span className="text-[12px] text-[#5a6478]">{filtered.length} businesses</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {filterTabs.map(t => (
              <button key={t.key} onClick={() => setActiveFilter(t.key)}
                className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                style={activeFilter === t.key
                  ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }
                  : { background: "#151a22", border: "1px solid rgba(255,255,255,0.07)", color: "#8a95a8" }}>
                {t.label}
              </button>
            ))}
          </div>
          <button style={btnGhost} onClick={() => setShowHistory(v => !v)}>
            <Clock className="h-3.5 w-3.5" /> History <ChevronDown className="h-3 w-3" />
          </button>
          <button style={btnGhost}>↓ Export</button>
        </div>

        {/* History Dropdown */}
        {showHistory && (
          <div className="mt-2 p-4 rounded-xl space-y-2" style={{ background: "#0f1218", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest mb-2">Recent Searches</div>
            {sessions.slice(0, 5).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-[#151a22] transition-colors"
                onClick={async () => {
                  try {
                    const r = await api.results(s.search_id)
                    const arr = Array.isArray(r) ? r : (r?.results ?? r?.items ?? [])
                    setResults(arr)
                    setSelectedSessionId(s.search_id)
                    toast.success("Search history loaded")
                  } catch(e) { toast.error("Failed to load history") }
                }}>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-[#e8edf5]">
                    {s.search_query || "Search"}
                  </div>
                  <div className="text-[11px] text-[#5a6478]">
                    {s.result_count || 0} results · {
                      s.created_at ? new Date(s.created_at).toLocaleDateString() : ""
                    }
                  </div>
                </div>
                <button style={btnGhost} className="text-[11px]"><Play className="h-3 w-3" />Reload</button>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="mt-2 overflow-hidden rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Header */}
          <div className="grid text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest px-4 py-3"
            style={{ gridTemplateColumns: "28px minmax(0, 1fr) 90px 130px 140px 100px 110px 90px", background: "#151a22", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div><input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-blue-500" /></div>
            <div>Business</div>
            <div>Industry</div>
            <div>Location</div>
            <div>Relevance</div>
            <div>Verification</div>
            <div>Decision</div>
            <div>Actions</div>
          </div>

          {filtered.map((r, i) => (
            <div key={r.id}
              className="grid items-center px-4 py-3 transition-colors hover:bg-[#151a22]"
              style={{
                gridTemplateColumns: "28px minmax(0, 1fr) 90px 130px 140px 100px 110px 90px",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                background: selectedIds.includes(r.id) ? "rgba(59,130,246,0.04)" : "#0f1218",
              }}>
              <div><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggle(r.id)} className="accent-blue-500" /></div>

              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <div className="text-[13px] font-semibold text-[#e8edf5]" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                <a 
                  href={`https://${r.website}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5"
                  style={{ maxWidth: "100%" }}
                  title={r.website}
                  onClick={e => e.stopPropagation()}>
                  <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                  <span style={{ 
                    overflow: "hidden", 
                    textOverflow: "ellipsis", 
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    flex: 1
                  }}>{r.website}</span>
                </a>
              </div>

              <div style={{ minWidth: 0 }}>
                <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#8a95a8" }}>{r.category}</span>
              </div>

              <div className="text-[12px] text-[#8a95a8] flex items-center gap-1" style={{ minWidth: 0, overflow: "hidden" }}>
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.location}</span>
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#1c2230" }}>
                    <div className="h-full rounded-full" style={{ width: `${r.relevanceScore}%`, background: scoreColor(r.relevanceScore) }} />
                  </div>
                  <span className="text-[12px] font-bold w-7 text-right" style={{ color: scoreColor(r.relevanceScore) }}>{r.relevanceScore}</span>
                </div>
                <div className="text-[10px] text-[#5a6478] mt-1 line-clamp-1">{r.reasoning}</div>
              </div>

              <div style={{ minWidth: 0 }}>{verifyBadge(r.verificationStatus)}</div>
              <div style={{ minWidth: 0 }}>{relevanceBadge(r.relevanceStatus)}</div>

              <div className="flex gap-1.5">
                <Link to={`/app/business/${r.id}`}>
                  <button title="View details" className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-[#1c2230]" style={{ border: "1px solid rgba(255,255,255,0.07)", color: "#8a95a8" }}>
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </Link>
                <button title="Save to clients" onClick={() => { toggle(r.id); handleSave(); }}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-[#1c2230]" style={{ border: "1px solid rgba(255,255,255,0.07)", color: "#8a95a8" }}>
                  ⭐
                </button>
                <button title="Generate email" onClick={() => toast.success(`Email drafted for ${r.name}`)}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-[#1c2230]" style={{ border: "1px solid rgba(255,255,255,0.07)", color: "#8a95a8" }}>
                  ✉️
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-3xl mb-3 opacity-40">🔍</div>
              <div className="text-sm font-bold text-[#e8edf5] mb-1">No results yet</div>
              <div className="text-[12px] text-[#5a6478]">
                Run a search above to discover businesses
              </div>
            </div>
          )}

          {filtered.length === 0 && results.length > 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-3xl mb-3 opacity-40">🔍</div>
              <div className="text-sm font-bold text-[#e8edf5] mb-1">No results match this filter</div>
              <div className="text-[12px] text-[#5a6478]">Try switching to "All" or run a new search</div>
            </div>
          )}
        </div>

        {nextPageToken && (
          <div className="flex justify-center mt-4">
            <button style={btnGhost} onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore && <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading…</>}
              {!loadingMore && <>↓ Load More Results</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
