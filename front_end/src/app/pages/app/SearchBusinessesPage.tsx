import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, MapPin, Sparkles, ShieldCheck, Save, ExternalLink, Clock, RefreshCw, Play, Eye, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/auth-context";
import { api, CreditError } from "../../../lib/api";

/* ── Types ── */
interface SearchSession {
  search_id: number;
  search_query: string;
  search_location: string;
  context_id: number | null;
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
  email_found: string | null;
  all_phones_found: string[];
  relevance_decision: "relevant" | "irrelevant" | "unknown" | "skipped" | "error" | null;
  relevance_score: number | null;
  relevance_reason: string;
  verification_status: string | null;
  verification_result: string | null;
  verification_score: number | null;
  verification_reason: string;
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
  const [searchQuery, setSearchQuery]       = useState("");
  const [location, setLocation]             = useState("");
  const [industry, setIndustry]             = useState("");
  const [showOtherIndustry, setShowOtherIndustry] = useState(false);
  const [otherIndustry, setOtherIndustry]   = useState("");
  const [selectedContext, setSelectedContext] = useState<number | null>(null);
  const [searching, setSearching]           = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [processingAI, setProcessingAI]     = useState(false);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set());
  const [aiProgress, setAiProgress]         = useState(0);
  const [processingVerify, setProcessingVerify] = useState(false);
  const [selectedIds, setSelectedIds]       = useState<string[]>([]);
  const [activeFilter, setActiveFilter]     = useState("all");
  const [showHistory, setShowHistory]       = useState(false);
  const [sessions, setSessions]             = useState<SearchSession[]>([]);
  const [results, setResults]               = useState<BusinessResult[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [dataLoading, setDataLoading]       = useState(false);
  const [apiContexts, setApiContexts]       = useState<ApiContext[]>([]);
  const [nextPageToken, setNextPageToken]   = useState<string | null>(null);
  const [pollingIds, setPollingIds]         = useState<Set<string>>(new Set());
  const pollingIntervalsRef          = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const isMountedRef                 = useRef(true);
  const cancelAIRef                  = useRef(false);
  const abortControllerRef           = useRef<AbortController | null>(null);
  const contextRestoredForSessionRef = useRef<number | null>(null);

  const hasScoredLeads = results.some(
    r => r.relevance_decision !== null && r.relevance_decision !== undefined
  );

  /* ── Initial data load ── */
  useEffect(() => {
    if (!user) return;
    const isFresh = routerLocation.state?.fresh === true;
    api.sessions(user.user_id)
      .then(s => {
        const sessions = (s || []) as SearchSession[];
        setSessions(sessions);
        if (!isFresh) {
          const lastId = localStorage.getItem("cf_last_session_id");
          if (lastId) {
            const parsed = Number(lastId);
            const belongsToUser = sessions.some(
              (session: SearchSession) => session.search_id === parsed
            );
            if (belongsToUser) {
              setSelectedSessionId(parsed);
            } else {
              localStorage.removeItem("cf_last_session_id");
              if (sessions.length > 0) {
                setSelectedSessionId(sessions[0].search_id);
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
      setSelectedSessionId(null);
      setResults([]);
      setSearchQuery("");
      setLocation("");
      setIndustry("");
      setSelectedContext(null);
      setActiveFilter("all");
      setSelectedIds([]);
      setNextPageToken(null);
      contextRestoredForSessionRef.current = null;
      return;
    }
    if (routerLocation.state?.sessionId) {
      setSelectedSessionId(routerLocation.state.sessionId);
    }
  }, [routerLocation.state]);

  /* ── Load results whenever the active session changes ──
     NOTE: `sessions` intentionally removed from deps — it caused a redundant
     fetch every time the sessions list refreshed after a search. The context
     auto-restore is handled separately below. */
  useEffect(() => {
    if (!selectedSessionId) return;
    localStorage.setItem("cf_last_session_id", String(selectedSessionId));
    setProcessingAI(false);
    setAiProgress(0);
    setCompletedItemIds(new Set());
    setDataLoading(true);
    api.results(selectedSessionId)
      .then(r => {
        if (!isMountedRef.current) return;
        setResults((r || []) as BusinessResult[]);
      })
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") })
      .finally(() => { if (isMountedRef.current) setDataLoading(false); });
  }, [selectedSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Auto-restore context from session (runs when sessions list arrives) ──
     Uses a ref to track which session has already had its context restored,
     preventing a race condition where rapidly-firing effects (e.g. browser
     back/forward) would overwrite a context the user already selected. */
  useEffect(() => {
    if (!selectedSessionId || sessions.length === 0) return;
    if (contextRestoredForSessionRef.current === selectedSessionId) return;
    const matchedSession = sessions.find(s => s.search_id === selectedSessionId);
    if (matchedSession?.context_id) {
      setSelectedContext(matchedSession.context_id);
      contextRestoredForSessionRef.current = selectedSessionId;
    }
  }, [selectedSessionId, sessions]);

  /* ── Cleanup on unmount: mark as unmounted + clear all polling intervals ── */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      pollingIntervalsRef.current.forEach(clearInterval);
      pollingIntervalsRef.current.clear();
    };
  }, []);

  const stopPollingId = useCallback((id: string) => {
    const handle = pollingIntervalsRef.current.get(id);
    if (handle !== undefined) {
      clearInterval(handle);
      pollingIntervalsRef.current.delete(id);
    }
    setPollingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      if (next.size === 0) setProcessingVerify(false);
      return next;
    });
  }, []);

  const startPolling = useCallback((id: string) => {
    const handle = setInterval(async () => {
      try {
        const status = await api.verificationStatus(Number(id));
        const isTerminal =
          status.verification_status !== null &&
          status.verification_status !== undefined &&
          status.verification_status !== "processing" &&
          status.verification_status !== "skipped";
        if (isTerminal) {
          stopPollingId(id);
          setResults(prev =>
            prev.map(r =>
              r.result_id === Number(id)
                ? {
                    ...r,
                    verification_status: status.verification_status,
                    verification_result: status.verification_result,
                    verification_score: status.verification_score,
                  }
                : r
            )
          );
        }
      } catch (err) {
        console.error(`Polling failed for business ${id}`, err);
      }
    }, 3000);
    pollingIntervalsRef.current.set(id, handle);
  }, [stopPollingId]);

  const contexts = apiContexts.length > 0
    ? apiContexts.map(c => ({ id: (c.id ?? c.context_id) as number, name: c.name, desc: c.prompt_text || "" }))
    : [];
  const contextLocked = selectedSessionId !== null;

  const handleSearch = async () => {
    if (!searchQuery.trim()) { toast.error("Enter a search query"); return; }
    if (!user) return;
    if (selectedContext === null) { toast.error("Please select an AI context before searching"); return; }
    if (credits && credits.empty) {
      toast.error("Credits exhausted — contact your team to top up.");
      return;
    }
    if (credits && credits.credits_remaining < 10) {
      toast.error(`Insufficient credits. Search costs 10 credits. You have ${credits.credits_remaining}.`);
      return;
    }
    setSearching(true);
    const searchToastId = toast.loading("Searching for businesses…");
    try {
      const finalIndustry = showOtherIndustry ? otherIndustry : industry;
      const parts = [searchQuery, finalIndustry, location].filter(Boolean);
      const finalQuery = parts.join(" ");
      const searchResponse = await api.createSession({
        user_id: user.user_id,
        query: finalQuery,
        search_location: location || "",
        context_id: selectedContext ?? null,
      });
      setNextPageToken(searchResponse?.next_page_token || null);
      toast.dismiss(searchToastId);
      toast.success("Search complete!");
      await refreshCredits();
      const newSessions = await api.sessions(user.user_id);
      if (!isMountedRef.current) return;
      setSessions((newSessions || []) as SearchSession[]);
      if (newSessions && newSessions.length > 0) {
        setSelectedSessionId(newSessions[0].search_id);
        localStorage.setItem("cf_last_session_id", String(newSessions[0].search_id));
      }
    } catch (err: unknown) {
      toast.dismiss(searchToastId);
      if (err instanceof CreditError) {
        toast.error("Credits exhausted — contact your team to top up.");
      } else {
        toast.error((err as Error).message || "Search failed");
      }
    } finally {
      if (isMountedRef.current) setSearching(false);
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
    if (credits && credits.empty) {
      toast.error("Credits exhausted — contact your team to top up.");
      return;
    }
    const cost = selectedIds.length * 1;
    if (credits && credits.credits_remaining < cost) {
      toast.error(`Insufficient credits. AI scoring ${selectedIds.length} leads costs ${cost} credits. You have ${credits.credits_remaining}.`);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    cancelAIRef.current = false;
    setProcessingAI(true);
    setAiProgress(0);
    setProcessingItemId(null);
    setCompletedItemIds(new Set());
    toast.info(`Running AI relevance on ${selectedIds.length} leads…`);

    let passed = 0;
    let failed = 0;
    let creditErrorHit = false;
    const totalIds = selectedIds.length;
    let processedCount = 0;

    /* Process a single lead — called concurrently inside each chunk */
    const processSingleLead = async (id: string): Promise<void> => {
      if (cancelAIRef.current) return;
      setProcessingItemId(id);
      const businessObject = results.find(r => String(r.result_id) === id);
      if (!businessObject) return;

      try {
        if (!businessObject.website) {
          setResults(prev => prev.map(r =>
            r.result_id === Number(id)
              ? { ...r, relevance_decision: "skipped" as const, relevance_reason: "No website — skipped" }
              : r
          ));
          failed++;
          return;
        }
        const response = await api.runRelevancy(
          businessObject, selectedSessionId || 0, selectedContext, controller.signal
        );
        if (!isMountedRef.current) return;
        setResults(prev => prev.map(r =>
          r.result_id === Number(id)
            ? { ...r,
                relevance_decision: response.relevance_decision,
                relevance_score: response.relevance_score != null ? response.relevance_score : (response.relevance_decision === "irrelevant" ? 0 : response.confidence),
                relevance_reason: response.relevance_reason }
            : r
        ));
        passed++;
      } catch (err: unknown) {
        /* AbortError means user paused — stop silently */
        if ((err as DOMException).name === "AbortError") return;
        if (err instanceof CreditError) {
          creditErrorHit = true;
          cancelAIRef.current = true;
          controller.abort();
          return;
        }
        if (isMountedRef.current) {
          setResults(prev => prev.map(r =>
            r.result_id === Number(id)
              ? { ...r, relevance_decision: "error" as const, relevance_reason: (err as Error).message }
              : r
          ));
        }
        failed++;
      } finally {
        if (!isMountedRef.current) return;
        processedCount++;
        setCompletedItemIds(prev => new Set(prev).add(id));
        setProcessingItemId(null);
        setAiProgress(Math.min((processedCount / totalIds) * 100, 95));
      }
    };

    /* Run leads in parallel chunks of 3 instead of one-by-one */
    const CHUNK_SIZE = 3;
    try {
      for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
        if (cancelAIRef.current) break;
        const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(id => processSingleLead(id)));
      }

      if (creditErrorHit) {
        toast.error("Credits exhausted — contact your team to top up.");
        await refreshCredits();
        return;
      }

      const wasCancelled = cancelAIRef.current;
      if (selectedSessionId) {
        const r = await api.results(selectedSessionId);
        if (isMountedRef.current) setResults((r || []) as BusinessResult[]);
      }
      await refreshCredits();
      if (wasCancelled) {
        toast.info(`AI paused: ${passed} scored, ${failed} skipped/failed`);
      } else {
        toast.success(`AI complete: ${passed} scored, ${failed} skipped/failed`);
      }
    } catch (err: unknown) {
      if (err instanceof CreditError) {
        toast.error("Credits exhausted — contact your team to top up.");
      } else {
        toast.error((err as Error).message || "AI scoring failed");
      }
    } finally {
      if (isMountedRef.current) {
        setProcessingAI(false);
        setAiProgress(100);
        setProcessingItemId(null);
        setCompletedItemIds(new Set());
        setSelectedIds([]);
      }
    }
  };

  const handleVerify = () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
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

    api.verifyBatch(validIds)
      .then(() => refreshCredits())
      .catch((err: unknown) => {
        if (err instanceof CreditError) {
          toast.error("Credits exhausted — contact your team to top up.");
        } else {
          toast.error((err as Error).message || "Verification request failed");
        }
      });

    toast.info(`Verifying ${validIds.length} leads…`);
    setProcessingVerify(true);
    setSelectedIds([]);

    const idStrings = validIds.map(String);
    setPollingIds(prev => {
      const next = new Set(prev);
      idStrings.forEach(id => next.add(id));
      return next;
    });
    idStrings.forEach(startPolling);
  };

  /* Bug 2 fix: Cancel actually stops all active polling intervals */
  const handleCancelVerify = useCallback(() => {
    pollingIds.forEach(id => stopPollingId(id));
    setProcessingVerify(false);
  }, [pollingIds, stopPollingId]);

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

  /* Bug 5 fix: Export wired up to the real API */
  const handleExport = async () => {
    if (!selectedSessionId) { toast.error("No active search session to export"); return; }
    try {
      await api.exportResults(selectedSessionId);
      toast.success("Export started — check your downloads");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Export failed");
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

  const tableData = results.length > 0 ? results.map(r => ({
    id: String(r.result_id),
    name: r.business_name || "Unknown",
    category: r.business_type || "—",
    location: r.address || "—",
    website: r.website || "",
    email: r.email_found || null,
    phone: (r.all_phones_found || [])[0] || null,
    relevanceScore: r.relevance_decision === "irrelevant" ? 0 : Math.round(r.relevance_score || 0),
    relevanceStatus: r.relevance_decision === "relevant" ? "passed"
      : r.relevance_decision === "irrelevant" ? "failed"
      : r.relevance_decision === "unknown" ? "low-confidence"
      : "pending",
    verificationScore: r.verification_score || null,
    verificationStatus: r.verification_result || "pending",
    reasoning: r.relevance_reason || "",
    verificationReasoning: r.verification_reason || "",
  })) : [];

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
    if (s === "partial")  return <Badge color="amber">⚠ Partial</Badge>;
    if (s === "failed")   return <Badge color="red">✗ Failed</Badge>;
    if (s === "running")  return <Badge color="blue">⏳ Running</Badge>;
    return <Badge color="gray">–</Badge>;
  };

  const scoreColor = (n: number, status?: string) => status === "failed" ? "var(--destructive)" : n >= 75 ? "var(--chart-2)" : n >= 50 ? "var(--chart-3)" : "var(--destructive)";

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
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Keywords / Business Type</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="e.g. textile exporters, wholesale distributors…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Country, city…" value={location} onChange={e => setLocation(e.target.value)} />
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
                  setShowOtherIndustry(true);
                  setIndustry("");
                } else {
                  setShowOtherIndustry(false);
                  setIndustry(val);
                  setOtherIndustry("");
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
                onChange={e => setOtherIndustry(e.target.value)}
              />
            </div>
          )}
          <button style={btnPrimary} onClick={handleSearch}
            disabled={searching || selectedContext === null || !!(credits && credits.empty)}>
            {searching && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {!searching && <Search className="h-3.5 w-3.5" />}
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
        {selectedContext === null && (
          <span className="text-[11px] text-red-400 mt-1 block">Please select an AI context before searching</span>
        )}

        {/* Context selector */}
        <div className="mt-4 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[11px] text-muted-foreground font-semibold">AI Context:</span>
          {contexts.length === 0 ? (
            <span className="text-[11px] text-muted-foreground italic">No contexts available. Create one in the Context page.</span>
          ) : (
            <>
              <button onClick={() => setSelectedContext(null)}
                disabled={searching || contextLocked}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                style={{
                  ...(selectedContext === null
                    ? { background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }
                    : { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }),
                  ...(searching ? { opacity: 0.4, cursor: "not-allowed" } : {}),
                  ...(contextLocked ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                }}>
                {selectedContext === null ? "🧠 " : ""}None
              </button>
              {contexts.map(c => (
                <button key={c.id} onClick={() => setSelectedContext(c.id)}
                  disabled={searching || contextLocked}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                  style={{
                    ...(selectedContext === c.id
                      ? { background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }
                      : { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }),
                    ...(searching ? { opacity: 0.4, cursor: "not-allowed" } : {}),
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
          <span className="text-[11px] text-muted-foreground mt-1 block">Context is locked to this search session. Start a new search to change it.</span>
        )}
      </div>

      {/* AI Processing Banner */}
      {processingAI && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">AI Relevance Scoring in progress — {Math.round(aiProgress)}% complete</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Analysing against "{contexts.find(c => c.id === selectedContext)?.name || "default"}" context. Partial results shown below.</div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent)" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${aiProgress}%`, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }} />
            </div>
          </div>
          <button style={btnGhost} onClick={() => {
            cancelAIRef.current = true;
            abortControllerRef.current?.abort();
            setProcessingAI(false);
          }}>Pause</button>
        </div>
      )}

      {/* Verification Banner */}
      {processingVerify && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <span className="text-2xl">🔒</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Verification checks running…</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Checking SSL, domain age, social presence, legal registration…</div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent)" }}>
              <div className="h-full rounded-full" style={{ width: "60%", background: "var(--chart-2)", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          </div>
          {/* Bug 2 fix: handleCancelVerify stops all active polling intervals */}
          <button style={btnGhost} onClick={handleCancelVerify}>Cancel</button>
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
              <button key={t.key} onClick={() => setActiveFilter(t.key)}
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
          {/* Bug 5 fix: Export button wired to handleExport */}
          <button style={btnGhost} onClick={handleExport} disabled={!selectedSessionId}>↓ Export</button>
        </div>

        {/* History Dropdown */}
        {showHistory && (
          <div className="mt-2 p-4 rounded-xl space-y-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Recent Searches</div>
            {/* Minor cleanup: use s.search_id as key instead of array index */}
            {sessions.slice(0, 5).map(s => (
              <div key={s.search_id} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                onClick={async () => {
                  try {
                    /* Minor cleanup: api.results always returns an array — no need for fallback destructuring */
                    const r = await api.results(s.search_id);
                    setResults((r || []) as BusinessResult[]);
                    setSelectedSessionId(s.search_id);
                    setSearchQuery(s.search_query || "");
                    setLocation(s.search_location || "");
                    setNextPageToken(s.next_page_token || null);
                    toast.success("Search history loaded");
                  } catch { toast.error("Failed to load history"); }
                }}>
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
                <button style={btnGhost} className="text-[11px]"><Play className="h-3 w-3" />Reload</button>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="mt-2 overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          {/* Header */}
          <div className="grid text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 py-3"
            style={{ gridTemplateColumns: "28px minmax(0, 1fr) 90px 130px 140px 100px 110px 90px", background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            <div><input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-blue-500" /></div>
            <div>Business</div>
            <div>Industry</div>
            <div>Location</div>
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
                gridTemplateColumns: "28px minmax(0, 1fr) 90px 130px 140px 100px 110px 90px",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                background: selectedIds.includes(r.id) ? "rgba(59,130,246,0.04)" : "var(--card)",
              }}>
              <div className="flex items-center justify-center">
                {processingItemId === r.id ? (
                  <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                ) : completedItemIds.has(r.id) ? (
                  <span style={{ color: "var(--chart-2)", fontSize: 14, lineHeight: 1 }}>✓</span>
                ) : processingAI && selectedIds.includes(r.id) ? (
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
                <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
                  style={{ background: "var(--border)", color: "var(--muted-foreground)" }}>{r.category}</span>
              </div>

              <div className="text-[12px] text-muted-foreground flex items-center gap-1" style={{ minWidth: 0, overflow: "hidden" }}>
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.location}</span>
              </div>

              <div style={{ minWidth: 0 }}>
                {(r.relevanceStatus === "passed" || r.relevanceStatus === "failed") && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent)" }}>
                      <div className="h-full rounded-full" style={{ width: `${r.relevanceScore}%`, background: scoreColor(r.relevanceScore, r.relevanceStatus) }} />
                    </div>
                    <span className="text-[12px] font-bold w-7 text-right" style={{ color: scoreColor(r.relevanceScore, r.relevanceStatus) }}>{r.relevanceScore}</span>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1" title={r.reasoning}>{r.reasoning}</div>
              </div>

              <div style={{ minWidth: 0 }}>
                {verifyBadge(pollingIds.has(r.id) ? "running" : r.verificationStatus)}
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
