import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, MapPin, Sparkles, ShieldCheck, Save, ExternalLink, Clock, RefreshCw, Play, Eye, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/auth-context";
import { api, CreditError } from "../../../lib/api";
import { usePageState } from "../../../lib/app-state-context";
import { useBackgroundJobs } from "../../../lib/background-jobs-context";

/* ── Types ── */
interface SearchSession {
  search_id: number;
  search_query: string;
  search_location: string;
  context_id: number | null;
  discovery_platform?: "maps" | "serp" | "both";
  result_count: number;
  next_page_token: string | null;
  created_at: string;
}

interface BusinessResult {
  result_id: number;
  business_name: string;
  business_type: string;
  address: string;
  website: string;
  source: "maps" | "serp" | null;
  email_found: string | null;
  all_phones_found: string[];
  relevance_decision: "relevant" | "irrelevant" | "low_confidence" | "unknown" | "skipped" | "error" | null;
  relevance_score: number | null;
  relevance_reason: string;
  verification_status: string | null;
  verification_result: string | null;
  verification_score: number | null;
  verification_reason: string;
  manual_review?: boolean | null;
}

interface ApiContext {
  id?: number;
  context_id?: number;
  name: string;
  prompt_text: string;
}

/* ── Shared dark style tokens ── */
const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 };
const inputStyle: React.CSSProperties = { background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", color: "var(--foreground)", fontSize: 13, fontFamily: "DM Sans, sans-serif", width: "100%", outline: "none" };
const btnPrimary: React.CSSProperties = { background: "var(--primary)", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };
const btnGhost: React.CSSProperties = { background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };

const Badge = ({ children, color }: { children: React.ReactNode; color: "green" | "blue" | "amber" | "red" | "purple" | "gray" }) => {
  const map = { green: ["rgba(16,185,129,0.1)", "var(--chart-2)"], blue: ["rgba(59,130,246,0.15)", "#60a5fa"], amber: ["rgba(245,158,11,0.1)", "var(--chart-3)"], red: ["rgba(239,68,68,0.1)", "var(--destructive)"], purple: ["rgba(139,92,246,0.12)", "#8b5cf6"], gray: ["var(--border)", "var(--muted-foreground)"] };
  const [bg, text] = map[color];
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: bg, color: text }}>{children}</span>;
};

/** Strip any existing http/https protocol so we can safely prepend https:// */
function safeUrl(website: string): string {
  return `https://${website.replace(/^https?:\/\//, "")}`;
}

export default function SearchBusinessesPage() {
  const { user, credits, refreshCredits } = useAuth();
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const {
    relevanceJob,
    verifyJob,
    startRelevanceJob,
    pauseRelevanceJob,
    dismissRelevanceBanner,
    startVerifyJob,
    cancelVerifyJob,
    dismissVerifyBanner,
  } = useBackgroundJobs();
  const [searchState, setSearchState] = usePageState("search");
  const { searchQuery, location, industry, otherIndustry, showOtherIndustry, selectedContext, discoveryPlatform, activeFilter, selectedSessionId } = searchState;
  const [loadingMore, setLoadingMore]       = useState(false);
  const [selectedIds, setSelectedIds]       = useState<string[]>([]);
  const [showHistory, setShowHistory]       = useState(false);
  const [sessions, setSessions]             = useState<SearchSession[]>([]);
  const [results, setResults]               = useState<BusinessResult[]>([]);
  const [dataLoading, setDataLoading]       = useState(false);
  const [apiContexts, setApiContexts]       = useState<ApiContext[]>([]);
  const [nextPageToken, setNextPageToken]   = useState<string | null>(null);
  const [queryPanelVisible, setQueryPanelVisible] = useState(false);
  const [generatingQueries, setGeneratingQueries] = useState(false);
  const [queryGenerationError, setQueryGenerationError] = useState<string | null>(null);
  const [mapsQueries, setMapsQueries] = useState<string[]>([]);
  const [webQueries, setWebQueries]   = useState<string[]>([]);
  const [selectedMapsQuery, setSelectedMapsQuery] = useState<number>(0);
  const [selectedWebQuery, setSelectedWebQuery] = useState<number>(0);
  const [pendingSessionId, setPendingSessionId] = useState<number | null>(null);
  const [triggeringDiscovery, setTriggeringDiscovery] = useState(false);
  const isMountedRef                 = useRef(true);
  const contextRestoredForSessionRef = useRef<number | null>(null);

  const activeRelevanceJob =
    relevanceJob && relevanceJob.sessionId === selectedSessionId ? relevanceJob : null;
  const activeVerifyJob =
    verifyJob && verifyJob.sessionId === selectedSessionId ? verifyJob : null;

  const hasScoredLeads = results.some(
    r => r.relevance_decision !== null && r.relevance_decision !== undefined
  );

  /* ── Initial data load ── */
  useEffect(() => {
    if (!user) return;
    const isFresh = routerLocation.state?.fresh === true;
    const navSessionId = routerLocation.state?.sessionId as number | undefined;
    api.sessions(user.user_id)
      .then(s => {
        const sessions = (s || []) as SearchSession[];
        setSessions(sessions);
        if (navSessionId) {
          const belongs = sessions.some(x => x.search_id === navSessionId);
          if (belongs) setSearchState({ selectedSessionId: navSessionId });
          return;
        }
        if (!isFresh) {
          const lastId = localStorage.getItem("cf_last_session_id");
          if (lastId) {
            const parsed = Number(lastId);
            const belongsToUser = sessions.some(
              (session: SearchSession) => session.search_id === parsed
            );
            if (belongsToUser) {
              setSearchState({ selectedSessionId: parsed });
            } else {
              localStorage.removeItem("cf_last_session_id");
              if (sessions.length > 0) {
                setSearchState({ selectedSessionId: sessions[0].search_id });
              }
            }
          }
        }
      })
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") });
    api.contexts()
      .then(c => setApiContexts((c || []) as ApiContext[]))
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") });
  }, [user]);

  /* ── Handle navigation state (fresh start or direct session link) ── */
  useEffect(() => {
    if (routerLocation.state?.fresh) {
      localStorage.removeItem("cf_last_session_id");
      setSearchState({
        selectedSessionId: null,
        searchQuery: "",
        location: "",
        industry: "",
        otherIndustry: "",
        showOtherIndustry: false,
        selectedContext: null,
        discoveryPlatform: "both",
        activeFilter: "all",
      });
      setResults([]);
      setSelectedIds([]);
      setNextPageToken(null);
      contextRestoredForSessionRef.current = null;
      return;
    }
    if (routerLocation.state?.sessionId) {
      setSearchState({ selectedSessionId: routerLocation.state.sessionId });
    }
  }, [routerLocation.state]);

  /* ── Load results whenever the active session changes ──
     NOTE: `sessions` intentionally removed from deps — it caused a redundant
     fetch every time the sessions list refreshed after a search. The context
     auto-restore is handled separately below. */
  useEffect(() => {
    if (!selectedSessionId) return;
    localStorage.setItem("cf_last_session_id", String(selectedSessionId));
    setDataLoading(true);
    api.results(selectedSessionId)
      .then(r => {
        if (!isMountedRef.current) return;
        setResults((r || []) as BusinessResult[]);
      })
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") })
      .finally(() => { if (isMountedRef.current) setDataLoading(false); });
  }, [selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setNextPageToken(null);
      return;
    }
    const matched = sessions.find(s => s.search_id === selectedSessionId);
    setNextPageToken(matched?.next_page_token ?? null);
  }, [selectedSessionId, sessions]);

  /* ── Auto-restore context from session (runs when sessions list arrives) ──
     Uses a ref to track which session has already had its context restored,
     preventing a race condition where rapidly-firing effects (e.g. browser
     back/forward) would overwrite a context the user already selected. */
  useEffect(() => {
    if (!selectedSessionId || sessions.length === 0) return;
    if (contextRestoredForSessionRef.current === selectedSessionId) return;
    const matchedSession = sessions.find(s => s.search_id === selectedSessionId);
    if (matchedSession) {
      setSearchState({ selectedContext: matchedSession.context_id ?? null });
      contextRestoredForSessionRef.current = selectedSessionId;
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const relevanceCompletedCount = activeRelevanceJob?.completedIds.size ?? 0;
  const verifyCompletedCount = activeVerifyJob?.completedIds.size ?? 0;

  useEffect(() => {
    if (!selectedSessionId) return;
    if (relevanceCompletedCount === 0 && verifyCompletedCount === 0) return;
    api.results(selectedSessionId)
      .then(r => {
        if (isMountedRef.current) setResults((r || []) as BusinessResult[]);
      })
      .catch(e => {
        console.error(e);
        toast.error("Failed to refresh results");
      });
  }, [selectedSessionId, relevanceCompletedCount, verifyCompletedCount]);

  const contexts = apiContexts.length > 0
    ? apiContexts.map(c => ({ id: (c.id ?? c.context_id) as number, name: c.name, desc: c.prompt_text || "" }))
    : [];
  const contextLocked = queryPanelVisible || pendingSessionId !== null || generatingQueries || triggeringDiscovery;

  const handleGenerateQueries = async () => {
    if (!searchQuery.trim()) { toast.error("Enter a search query"); return; }
    if (!user) return;
    if (selectedContext === null) { toast.error("Please select an AI context before continuing"); return; }
    if (credits && credits.empty) { toast.error("Credits exhausted — contact your team to top up."); return; }
    if (credits && credits.credits_remaining < 10) {
      toast.error(`Insufficient credits. Search costs 10 credits. You have ${credits.credits_remaining}.`);
      return;
    }

    setGeneratingQueries(true);
    setQueryPanelVisible(false);
    setQueryGenerationError(null);
    setMapsQueries([]);
    setWebQueries([]);

    try {
      const finalIndustry = showOtherIndustry ? otherIndustry : industry;
      const parts = [searchQuery, finalIndustry, location].filter(Boolean);
      const finalQuery = parts.join(" ");

      // Step 1: Create session without running discovery
      const sessionResp = await api.createSession({
        user_id: user.user_id,
        query: finalQuery,
        search_location: location || "",
        context_id: selectedContext ?? null,
        ai_context: (apiContexts.find(c => (c.id ?? c.context_id) === selectedContext))?.prompt_text || null,
        discovery_platform: discoveryPlatform,
        skip_discovery: true,
      });

      const createdSessionId = sessionResp?.search_id;
      if (!createdSessionId) throw new Error("Session creation failed");
      setPendingSessionId(createdSessionId);

      // Step 2: Generate queries
      const suggestions = await api.generateQueries(createdSessionId);
      setMapsQueries(suggestions.maps_queries || []);
      setWebQueries(suggestions.web_queries || []);
      setSelectedMapsQuery(0);
      setSelectedWebQuery(0);
      setQueryPanelVisible(true);
    } catch (err: unknown) {
      setQueryGenerationError((err as Error).message || "Failed to generate queries");
    } finally {
      setGeneratingQueries(false);
    }
  };

  const handleStartDiscovery = async () => {
    if (!pendingSessionId || !user) return;
    setTriggeringDiscovery(true);
    const toastId = toast.loading("Starting discovery…");
    try {
      // Save user-edited queries back to session
      const queriesToSave: { maps_queries: string[]; web_queries: string[] } = { maps_queries: [], web_queries: [] };
      if (discoveryPlatform === "maps" || discoveryPlatform === "both") queriesToSave.maps_queries = mapsQueries[selectedMapsQuery]?.trim() ? [mapsQueries[selectedMapsQuery]] : mapsQueries.filter(q => q.trim()).slice(0, 1);
      if (discoveryPlatform === "serp" || discoveryPlatform === "both") queriesToSave.web_queries = webQueries[selectedWebQuery]?.trim() ? [webQueries[selectedWebQuery]] : webQueries.filter(q => q.trim()).slice(0, 1);
      await api.updateApprovedQueries(pendingSessionId, queriesToSave);

      // Trigger actual discovery
      const finalIndustry = showOtherIndustry ? otherIndustry : industry;
      const parts = [searchQuery, finalIndustry, location].filter(Boolean);
      const finalQuery = parts.join(" ");
      await api.createSession({
        user_id: user.user_id,
        query: finalQuery,
        search_location: location || "",
        context_id: selectedContext ?? null,
        ai_context: (apiContexts.find(c => (c.id ?? c.context_id) === selectedContext))?.prompt_text || null,
        discovery_platform: discoveryPlatform,
        skip_discovery: false,
        session_id: pendingSessionId,
      });

      toast.dismiss(toastId);
      toast.success("Discovery complete!");
      await refreshCredits();
      const newSessions = await api.sessions(user.user_id);
      if (!isMountedRef.current) return;
      setSessions((newSessions || []) as SearchSession[]);
      const targetSession = (newSessions || []).find((s: SearchSession) => s.search_id === pendingSessionId);
      if (targetSession) {
        setSearchState({ selectedSessionId: targetSession.search_id });
        localStorage.setItem("cf_last_session_id", String(targetSession.search_id));
        setNextPageToken(targetSession.next_page_token || null);
      }
      setQueryPanelVisible(false);
      setPendingSessionId(null);
    } catch (err: unknown) {
      toast.dismiss(toastId);
      toast.error((err as Error).message || "Discovery failed");
    } finally {
      if (isMountedRef.current) setTriggeringDiscovery(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || !user || !selectedSessionId) return;
    setLoadingMore(true);
    const moreToastId = toast.loading("Loading more businesses…");
    try {
      const finalIndustry = showOtherIndustry ? otherIndustry : industry;
      const parts = [searchQuery, finalIndustry, location].filter(Boolean);
      const finalQuery = parts.join(" ");
      const moreResponse = await api.createSession({
        user_id: user.user_id,
        query: finalQuery,
        search_location: location || "",
        page_token: nextPageToken,
        session_id: selectedSessionId,
        context_id: selectedContext ?? null,
      });
      setNextPageToken(moreResponse?.next_page_token || null);
      const r = await api.results(selectedSessionId);
      if (!isMountedRef.current) return;
      setResults((r || []) as BusinessResult[]);
      toast.dismiss(moreToastId);
      toast.success("More businesses loaded!");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to load more");
    } finally {
      if (isMountedRef.current) setLoadingMore(false);
    }
  };

  const handleRunAI = async () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    if (selectedContext === null) { toast.error("Please select an AI context before running relevance scoring"); return; }
    if (!selectedSessionId) { toast.error("No active search session"); return; }
    if (credits && credits.empty) {
      toast.error("Credits exhausted — contact your team to top up.");
      return;
    }
    const cost = selectedIds.length * 1;
    if (credits && credits.credits_remaining < cost) {
      toast.error(`Insufficient credits. AI scoring ${selectedIds.length} leads costs ${cost} credits. You have ${credits.credits_remaining}.`);
      return;
    }

    const idsToRun = [...selectedIds];
    setSelectedIds([]);

    const contextName = contexts.find(c => c.id === selectedContext)?.name;

    await startRelevanceJob({
      selectedIds: idsToRun,
      sessionId: selectedSessionId,
      contextId: selectedContext,
      contextName,
      businesses: results,
      onItemUpdate: (id, partial) => {
        setResults(prev =>
          prev.map(r =>
            r.result_id === Number(id)
              ? {
                  ...r,
                  ...(partial.relevance_decision != null
                    ? { relevance_decision: partial.relevance_decision as BusinessResult["relevance_decision"] }
                    : {}),
                  ...(partial.relevance_score != null ? { relevance_score: partial.relevance_score } : {}),
                  ...(partial.relevance_reason != null ? { relevance_reason: partial.relevance_reason } : {}),
                }
              : r
          )
        );
      },
      onSessionRefresh: async () => {
        if (!selectedSessionId) return;
        const r = await api.results(selectedSessionId);
        if (isMountedRef.current) setResults((r || []) as BusinessResult[]);
      },
    });
  };

  const handleVerify = () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    if (!selectedSessionId) { toast.error("No active search session"); return; }
    if (credits && credits.empty) {
      toast.error("Credits exhausted — contact your team to top up.");
      return;
    }
    const cost = selectedIds.length * 2;
    if (credits && credits.credits_remaining < cost) {
      toast.error(`Insufficient credits. Verifying ${selectedIds.length} leads costs ${cost} credits. You have ${credits.credits_remaining}.`);
      return;
    }

    const validIds = selectedIds
      .filter(id => {
        const row = tableData.find(t => t.id === id);
        return row?.relevanceStatus === "passed";
      })
      .map(id => Number(id))
      .filter(id => !isNaN(id) && id > 0);

    if (validIds.length === 0) {
      toast.error("No relevant businesses selected. Run AI relevance first, then verify only relevant leads.");
      return;
    }

    setSelectedIds([]);

    startVerifyJob({
      validIds,
      sessionId: selectedSessionId,
      onItemUpdate: (id, partial) => {
        setResults(prev =>
          prev.map(r =>
            r.result_id === Number(id)
              ? {
                  ...r,
                  ...(partial.verification_status != null
                    ? { verification_status: partial.verification_status }
                    : {}),
                  ...(partial.verification_result != null
                    ? { verification_result: partial.verification_result }
                    : {}),
                  ...(partial.verification_score != null
                    ? { verification_score: partial.verification_score }
                    : {}),
                }
              : r
          )
        );
      },
    });
  };

  const handleSave = async () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    try {
      const results = await Promise.allSettled(
        selectedIds.map(id => api.updateClientStatus(Number(id), true))
      );
      const failed = results.filter(r => r.status === "rejected").length;
      if (failed === selectedIds.length) {
        toast.error("Failed to save businesses");
      } else if (failed > 0) {
        toast.warning(`${selectedIds.length - failed} saved, ${failed} failed`);
        if (isMountedRef.current) setSelectedIds([]);
      } else {
        toast.success(`${selectedIds.length} businesses saved to Clients`);
        if (isMountedRef.current) setSelectedIds([]);
      }
    } catch {
      toast.error("Failed to save some businesses");
    }
  };

  /* Bug 3 fix: per-row save directly calls the API, bypassing selectedIds state */
  const handleSaveSingle = async (id: string, name: string) => {
    try {
      await api.updateClientStatus(Number(id), true);
      toast.success(`${name} saved to Clients`);
    } catch {
      toast.error("Failed to save business");
    }
  };

  const toggle = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => setSelectedIds(p => p.length === filtered.length ? [] : filtered.map(r => r.id));

  const tableData = results.length > 0 ? results.map(r => {
    const verificationScore = r.verification_score != null ? Math.round(r.verification_score) : null;
    const verificationProcessed =
      r.verification_result != null
      || (r.verification_status != null && r.verification_status !== "pending")
      || r.verification_score != null;
    const verificationStatus = r.manual_review
      ? "manual_review"
      : r.verification_result === "verified"      ? "verified"
      : r.verification_result === "partial"       ? "partial"
      : r.verification_result === "manual_review" ? "manual_review"
      : r.verification_status === "failed"        ? "failed"
      : "pending";

    return {
      id: String(r.result_id),
      name: r.business_name || "Unknown",
      category: r.business_type || "—",
      location: r.address || "—",
      website: r.website || "",
      source: r.source || "maps",
      email: r.email_found || null,
      phone: (r.all_phones_found || [])[0] || null,
      relevanceScore: r.relevance_decision === "irrelevant"
        ? 0
        : (r.relevance_score != null ? Math.round(r.relevance_score) : null),
      relevanceStatus: r.relevance_decision === "relevant" ? "passed"
        : r.relevance_decision === "irrelevant" ? "failed"
        : r.relevance_decision === "low_confidence" ? "low-confidence"
        : r.relevance_decision === "unknown" ? "low-confidence"
        : "pending",
      verificationScore,
      verificationStatus,
      verificationProcessed,
      reasoning: r.relevance_reason || "",
      verificationReasoning: r.verification_reason || "",
    };
  }) : [];

  const filtered = tableData.filter(r => {
    if (activeFilter === "passed")   return r.relevanceStatus === "passed";
    if (activeFilter === "failed")   return r.relevanceStatus === "failed";
    if (activeFilter === "lowconf")  return r.relevanceStatus === "low-confidence";
    if (activeFilter === "pending")  return r.relevanceStatus === "pending";
    return true;
  }).sort((a, b) => {
    const aProcessed = a.relevanceStatus !== "pending";
    const bProcessed = b.relevanceStatus !== "pending";
    if (aProcessed && !bProcessed) return -1;
    if (!aProcessed && bProcessed) return 1;
    return 0;
  });

  const relevanceBadge = (s: string) => {
    if (s === "passed")         return <Badge color="green">✓ Relevant</Badge>;
    if (s === "low-confidence") return <Badge color="amber">⚠ Low Conf.</Badge>;
    if (s === "failed")         return <Badge color="red">✗ Not Relevant</Badge>;
    return <Badge color="gray">Pending</Badge>;
  };

  const verifyBadge = (s: string | null) => {
    if (s === "verified") return <Badge color="green">✓ Verified</Badge>;
    if (s === "manual_review") return <Badge color="amber">Manual Review</Badge>;
    if (s === "partial")  return <Badge color="amber">⚠ Partial</Badge>;
    if (s === "failed")   return <Badge color="red">✗ Failed</Badge>;
    if (s === "running")  return <Badge color="blue">⏳ Running</Badge>;
    return <Badge color="gray">–</Badge>;
  };

  const scoreColor = (n: number, status?: string) => status === "failed" ? "var(--destructive)" : n >= 75 ? "var(--chart-2)" : n >= 50 ? "var(--chart-3)" : "var(--destructive)";

  const verifyProgressPct = activeVerifyJob && activeVerifyJob.totalCount > 0
    ? (activeVerifyJob.completedIds.size / activeVerifyJob.totalCount) * 100
    : 0;
  const verifyingBusinessName = activeVerifyJob?.activeItemId
    ? tableData.find(t => t.id === activeVerifyJob.activeItemId)?.name
    : null;
  const verifyingPhaseCaption = activeVerifyJob?.activeItemId
    ? activeVerifyJob.phaseById[activeVerifyJob.activeItemId]
    : null;
  const relevanceBusinessName = activeRelevanceJob?.activeItemId
    ? tableData.find(t => t.id === activeRelevanceJob.activeItemId)?.name
    : null;
  const relevancePhaseCaption = activeRelevanceJob?.activeItemId
    ? activeRelevanceJob.phaseById[activeRelevanceJob.activeItemId]
    : null;

  const filterTabs = [
    { key: "all",     label: `All (${tableData.length})` },
    { key: "passed",  label: "✓ Relevant" },
    { key: "lowconf", label: "⚠ Low Conf." },
    { key: "failed",  label: "✗ Not Relevant" },
    { key: "pending", label: "⏳ Pending" },
  ];

  return (
    <div className="p-6 space-y-4 page-enter">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>Advanced Search</h1>
        <p className="text-sm text-muted-foreground mt-1">Multi-source discovery with AI relevance scoring</p>
      </div>
      {/* Search Controls */}
      <div style={card} className="p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Keywords / Business Type</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="e.g. textile exporters, wholesale distributors…" value={searchQuery} onChange={e => setSearchState({ searchQuery: e.target.value })} onKeyDown={e => e.key === "Enter" && handleGenerateQueries()} />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Country, city…" value={location} onChange={e => setSearchState({ location: e.target.value })} />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Industry</label>
            <select
              style={{ ...inputStyle, appearance: "none" }}
              value={showOtherIndustry ? "Other" : industry}
              onChange={e => {
                const val = e.target.value;
                if (val === "Other") {
                  setSearchState({ showOtherIndustry: true, industry: "" });
                } else {
                  setSearchState({ showOtherIndustry: false, industry: val, otherIndustry: "" });
                }
              }}>
              <option value="">All Industries</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Wholesale">Wholesale</option>
              <option value="Technology">Technology</option>
              <option value="Construction">Construction</option>
              <option value="Logistics">Logistics</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {showOtherIndustry && (
            <div className="min-w-[160px]">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Custom Industry</label>
              <input
                style={inputStyle}
                placeholder="Enter industry…"
                value={otherIndustry}
                onChange={e => setSearchState({ otherIndustry: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Discovery Platform */}
        <div className="mt-3 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Discovery Source</label>
            <div className="flex gap-1.5">
              {(["maps", "serp", "both"] as const).map(opt => (
                <button
                  key={opt}
                  disabled={queryPanelVisible}
                  onClick={() => setSearchState({ discoveryPlatform: opt })}
                  style={{
                    background: discoveryPlatform === opt ? "rgba(59,130,246,0.12)" : "var(--muted)",
                    border: discoveryPlatform === opt ? "1px solid #3b82f6" : "1px solid var(--border)",
                    color: discoveryPlatform === opt ? "#60a5fa" : "var(--muted-foreground)",
                    borderRadius: 6,
                    padding: "7px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: queryPanelVisible ? "not-allowed" : "pointer",
                    fontFamily: "DM Sans, sans-serif",
                    opacity: queryPanelVisible ? 0.5 : 1,
                  }}>
                  {opt === "maps" ? "Google Maps" : opt === "serp" ? "Web Search" : "Both"}
                </button>
              ))}
            </div>
          </div>
          <button
            style={btnPrimary}
            onClick={handleGenerateQueries}
            disabled={generatingQueries || queryPanelVisible || selectedContext === null || !!(credits && credits.empty)}>
            {generatingQueries ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Searching…</> : <><Sparkles className="h-3.5 w-3.5" />Search</>}
          </button>
        </div>

        {selectedContext === null && (
          <span className="text-[11px] text-red-400 mt-1 block">Please select an AI context before searching</span>
        )}

        {/* Query review panel */}
        {queryPanelVisible && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>Review &amp; Edit Queries</span>
              <button
                style={{ ...btnGhost, fontSize: 11 }}
                onClick={() => { setQueryPanelVisible(false); setPendingSessionId(null); }}>
                ✕ Cancel
              </button>
            </div>
            <div className="space-y-4" style={{ background: "var(--muted)", borderRadius: 8, padding: "16px" }}>
              {(discoveryPlatform === "maps" || discoveryPlatform === "both") && (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Google Maps Queries</div>
                  <div className="space-y-1.5">
                    {mapsQueries.map((q, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2"
                        onClick={() => setSelectedMapsQuery(i)}
                        style={{ cursor: "pointer", borderRadius: 6, padding: "2px 0", background: selectedMapsQuery === i ? "rgba(99,102,241,0.10)" : "transparent", border: selectedMapsQuery === i ? "1px solid rgba(99,102,241,0.35)" : "1px solid transparent" }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${selectedMapsQuery === i ? "#818cf8" : "var(--muted-foreground)"}`, background: selectedMapsQuery === i ? "#818cf8" : "transparent", display: "inline-block", flexShrink: 0, marginLeft: 6 }} />
                        <input
                          style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                          value={q}
                          onChange={e => setMapsQueries(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                        />
                        <button
                          onClick={() => setMapsQueries(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ background: "transparent", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setMapsQueries(prev => [...prev, ""])}
                      style={{ background: "transparent", border: "1px dashed var(--border)", borderRadius: 6, color: "var(--muted-foreground)", fontSize: 11, padding: "4px 12px", cursor: "pointer", marginTop: 4 }}>
                      + Add query
                    </button>
                  </div>
                </div>
              )}
              {(discoveryPlatform === "serp" || discoveryPlatform === "both") && (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Web Search Queries</div>
                  <div className="space-y-1.5">
                    {webQueries.map((q, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2"
                        onClick={() => setSelectedWebQuery(i)}
                        style={{ cursor: "pointer", borderRadius: 6, padding: "2px 0", background: selectedWebQuery === i ? "rgba(99,102,241,0.10)" : "transparent", border: selectedWebQuery === i ? "1px solid rgba(99,102,241,0.35)" : "1px solid transparent" }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${selectedWebQuery === i ? "#818cf8" : "var(--muted-foreground)"}`, background: selectedWebQuery === i ? "#818cf8" : "transparent", display: "inline-block", flexShrink: 0, marginLeft: 6 }} />
                        <input
                          style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                          value={q}
                          onChange={e => setWebQueries(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                        />
                        <button
                          onClick={() => setWebQueries(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ background: "transparent", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setWebQueries(prev => [...prev, ""])}
                      style={{ background: "transparent", border: "1px dashed var(--border)", borderRadius: 6, color: "var(--muted-foreground)", fontSize: 11, padding: "4px 12px", cursor: "pointer", marginTop: 4 }}>
                      + Add query
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-3">
              <button style={btnPrimary} onClick={handleStartDiscovery} disabled={triggeringDiscovery}>
                {triggeringDiscovery ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Starting…</> : <><Search className="h-3.5 w-3.5" />Start Discovery</>}
              </button>
            </div>
          </div>
        )}

        {queryGenerationError && !queryPanelVisible && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="text-[12px] text-red-400 flex-1">{queryGenerationError}</span>
            <button style={{ ...btnGhost, fontSize: 11 }} onClick={handleGenerateQueries}>Retry</button>
          </div>
        )}

        {/* Context selector */}
        <div className="mt-4 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[11px] text-muted-foreground font-semibold">AI Context:</span>
          {contexts.length === 0 ? (
            <span className="text-[11px] text-muted-foreground italic">No contexts available. Create one in the Context page.</span>
          ) : (
            <>
              <button onClick={() => setSearchState({ selectedContext: null })}
                disabled={contextLocked}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                style={{
                  ...(selectedContext === null
                    ? { background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }
                    : { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }),
                  ...(contextLocked ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                }}>
                {selectedContext === null ? "🧠 " : ""}None
              </button>
              {contexts.map(c => (
                <button key={c.id} onClick={() => setSearchState({ selectedContext: c.id })}
                  disabled={contextLocked}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                  style={{
                    ...(selectedContext === c.id
                      ? { background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }
                      : { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }),
                    ...(contextLocked ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                  }}>
                  {selectedContext === c.id ? "🧠 " : ""}{c.name}
                </button>
              ))}
            </>
          )}
          <button
            onClick={() => navigate("/app/contexts")}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            + New Context
          </button>
        </div>
        {contextLocked && (
          <span className="text-[11px] text-muted-foreground mt-1 block">Context is locked while queries are being generated or discovery is in progress.</span>
        )}
      </div>

      {/* AI Processing Banner */}
      {activeRelevanceJob?.bannerVisible && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              {activeRelevanceJob.isRunning ? (
                <>AI Relevance Scoring in progress — {Math.round(activeRelevanceJob.progress)}% complete</>
              ) : activeRelevanceJob.isComplete ? (
                <>AI Relevance Scoring complete — {activeRelevanceJob.completedIds.size} leads processed</>
              ) : (
                <>AI Relevance Scoring paused — {activeRelevanceJob.completedIds.size} leads processed so far</>
              )}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {relevanceBusinessName && (
                <div className="font-medium">Processing: {relevanceBusinessName}</div>
              )}
              {relevancePhaseCaption && (
                <div className="mt-1">{relevancePhaseCaption}</div>
              )}
              {!relevanceBusinessName && !relevancePhaseCaption && (
                <div>
                  Analysing against &quot;{activeRelevanceJob.contextName || contexts.find(c => c.id === selectedContext)?.name || "default"}&quot; context. Partial results shown below.
                </div>
              )}
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent)" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${activeRelevanceJob.progress}%`, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }} />
            </div>
          </div>
          <div className="flex gap-2">
            {activeRelevanceJob.isRunning && (
              <button type="button" style={btnGhost} onClick={pauseRelevanceJob}>Pause</button>
            )}
            <button type="button" style={btnGhost} onClick={dismissRelevanceBanner}><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {/* Verification Banner */}
      {activeVerifyJob?.bannerVisible && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <span className="text-2xl">🔒</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              {activeVerifyJob.isRunning ? (
                <>Verifying {activeVerifyJob.completedIds.size}/{activeVerifyJob.totalCount}</>
              ) : (
                <>Verification complete — {activeVerifyJob.completedIds.size} leads verified</>
              )}
              {verifyingBusinessName ? ` — ${verifyingBusinessName}` : ""}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {verifyingPhaseCaption || "Checking SSL, domain age, social presence, legal registration…"}
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${verifyProgressPct}%`, background: "var(--chart-2)" }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {activeVerifyJob.isRunning && (
              <button type="button" style={btnGhost} onClick={cancelVerifyJob}>Cancel</button>
            )}
            <button type="button" style={btnGhost} onClick={dismissVerifyBanner}><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.25)" }}>
          <span className="text-sm font-semibold text-blue-400">{selectedIds.length} selected</span>
          <div className="flex gap-2 flex-wrap">
            <button style={btnPrimary} onClick={handleRunAI}
              disabled={!!(credits && credits.empty) || selectedContext === null}>
              <Sparkles className="h-3.5 w-3.5" />Run AI Relevance
            </button>
            {hasScoredLeads && selectedIds.some(id => {
              const r = tableData.find(t => t.id === id);
              return r?.relevanceStatus === "passed";
            }) && (
              <button style={btnGhost} onClick={handleVerify}
                disabled={!!(credits && credits.empty)}>
                <ShieldCheck className="h-3.5 w-3.5" />Verify Selected
              </button>
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
            <span className="text-sm font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>Search Results</span>
            <span className="text-[12px] text-muted-foreground">{filtered.length} businesses</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {filterTabs.map(t => (
              <button key={t.key} onClick={() => setSearchState({ activeFilter: t.key })}
                className="px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                style={activeFilter === t.key
                  ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }
                  : { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                {t.label}
              </button>
            ))}
          </div>
          <button style={btnGhost} onClick={() => setShowHistory(v => !v)}>
            <Clock className="h-3.5 w-3.5" /> History <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* History Dropdown */}
        {showHistory && (
          <div className="mt-2 p-4 rounded-xl space-y-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Recent Searches</div>
            {/* Minor cleanup: use s.search_id as key instead of array index */}
            {sessions.slice(0, 5).map(s => {
              const loadHistorySession = async () => {
                try {
                  const r = await api.results(s.search_id);
                  setResults((r || []) as BusinessResult[]);
                  contextRestoredForSessionRef.current = s.search_id;
                  const platform = s.discovery_platform;
                  setSearchState({
                    selectedSessionId: s.search_id,
                    searchQuery: s.search_query || "",
                    location: s.search_location || "",
                    selectedContext: s.context_id ?? null,
                    ...(platform === "maps" || platform === "serp" || platform === "both"
                      ? { discoveryPlatform: platform }
                      : {}),
                  });
                  setNextPageToken(s.next_page_token || null);
                  toast.success("Search history loaded");
                } catch {
                  toast.error("Failed to load history");
                }
              };
              return (
                <div key={s.search_id} className="flex items-center gap-3 p-2.5 rounded-lg transition-colors">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-foreground">
                      {s.search_query || "Search"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.result_count || 0} results · {
                        s.created_at ? new Date(s.created_at).toLocaleDateString() : ""
                      }
                    </div>
                  </div>
                  <button type="button" style={btnGhost} className="text-[11px]" onClick={loadHistorySession}>
                    <Play className="h-3 w-3" />Reload
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div className="mt-2 overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          {/* Header */}
          <div className="grid text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 py-3"
            style={{ gridTemplateColumns: "28px minmax(0, 1fr) 160px 130px 120px 130px 90px", background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            <div><input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-blue-500" /></div>
            <div>Business</div>
            <div>Industry</div>
            <div>Relevance</div>
            <div>Verification</div>
            <div>Decision</div>
            <div>Actions</div>
          </div>

          {/* Bug 7 fix: show a loading state while session results are being fetched */}
          {dataLoading && (
            <div className="flex items-center justify-center py-10 gap-3">
              <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
              <span className="text-[13px] text-muted-foreground">Loading results…</span>
            </div>
          )}

          {!dataLoading && filtered.map((r, i) => (
            <div key={r.id}
              className="grid items-center px-4 py-3 transition-colors hover:bg-muted"
              style={{
                gridTemplateColumns: "28px minmax(0, 1fr) 160px 130px 120px 130px 90px",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                background: selectedIds.includes(r.id) ? "rgba(59,130,246,0.04)" : "var(--card)",
              }}>
              <div className="flex items-center justify-center">
                {activeRelevanceJob?.activeItemId === r.id || activeVerifyJob?.activeItemId === r.id ? (
                  <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                ) : activeRelevanceJob?.completedIds.has(r.id) || activeVerifyJob?.completedIds.has(r.id) ? (
                  <span style={{ color: "var(--chart-2)", fontSize: 14, lineHeight: 1 }}>✓</span>
                ) : (activeRelevanceJob?.isRunning || activeVerifyJob?.isRunning) &&
                  (activeRelevanceJob?.processingIds.has(r.id) || activeVerifyJob?.processingIds.has(r.id)) ? (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggle(r.id)} className="accent-blue-500" />
                )}
              </div>

              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <div className="text-[13px] font-semibold text-foreground" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                {/* Bug 4 fix: strip existing protocol before prepending https:// */}
                {r.website && (
                  <a
                    href={safeUrl(r.website)}
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
                )}
                {(r.email || r.phone) && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {r.email && (
                      <span className="text-[11px] text-muted-foreground" title={r.email}>✉ {r.email}</span>
                    )}
                    {r.phone && (
                      <span className="text-[11px] text-muted-foreground">📞 {r.phone}</span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                    marginBottom: 3,
                    display: "inline-block",
                    background: r.source === "serp" ? "rgba(99,102,241,0.15)" : "rgba(34,197,94,0.12)",
                    color: r.source === "serp" ? "#818cf8" : "#4ade80",
                    border: `1px solid ${r.source === "serp" ? "rgba(99,102,241,0.3)" : "rgba(34,197,94,0.25)"}`
                  }}>
                    {r.source === "serp" ? "WEB" : "MAPS"}
                  </span>
                  <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
                    style={{ background: "var(--border)", color: "var(--muted-foreground)" }}>{r.category}</span>
                </div>
              </div>

              <div style={{ minWidth: 0, paddingRight: 16 }}>
                {r.relevanceScore === null ? (
                  <span className="text-[12px] text-muted-foreground">—</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent)" }}>
                      <div className="h-full rounded-full" style={{ width: `${r.relevanceScore}%`, background: scoreColor(r.relevanceScore, r.relevanceStatus) }} />
                    </div>
                    <span className="text-[12px] font-bold w-7 text-right" style={{ color: scoreColor(r.relevanceScore, r.relevanceStatus) }}>{r.relevanceScore}</span>
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                {activeVerifyJob?.processingIds.has(r.id)
                  ? verifyBadge("running")
                  : r.verificationProcessed
                    ? verifyBadge(r.verificationStatus)
                    : <span className="text-[12px] text-muted-foreground">—</span>}
              </div>
              <div style={{ minWidth: 0 }}>{relevanceBadge(r.relevanceStatus)}</div>

              <div className="flex gap-1.5">
                <Link to={`/app/business/${r.id}`}>
                  <button title="View details" className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-accent" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </Link>
                {/* Bug 3 fix: save single item directly, no stale-state race condition */}
                <button title="Save to clients" onClick={() => handleSaveSingle(r.id, r.name)}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-accent" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                  ⭐
                </button>
              </div>
            </div>
          ))}

          {!dataLoading && filtered.length === 0 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-3xl mb-3 opacity-40">🔍</div>
              <div className="text-sm font-bold text-foreground mb-1">No results yet</div>
              <div className="text-[12px] text-muted-foreground">
                Run a search above to discover businesses
              </div>
            </div>
          )}

          {!dataLoading && filtered.length === 0 && results.length > 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-3xl mb-3 opacity-40">🔍</div>
              <div className="text-sm font-bold text-foreground mb-1">No results match this filter</div>
              <div className="text-[12px] text-muted-foreground">Try switching to "All" or run a new search</div>
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
