import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Star,
  Sparkles,
  ShieldCheck,
  Save,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { api, Lead, SearchSession } from "../../../lib/api";
import { useBackgroundJobs } from "../../../lib/background-jobs-context";

const PAGE_SIZE = 40;

const GRID_COLUMNS = "28px minmax(0,1fr) 90px 130px 120px 130px 130px 100px";

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
};

const actionBtnStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  color: "var(--muted-foreground)",
  background: "transparent",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  background: "var(--primary)",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "DM Sans, sans-serif",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--muted-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "DM Sans, sans-serif",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const FILTER_PILLS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending_relevancy", label: "Pending Relevancy" },
  { value: "relevant", label: "Relevant" },
  { value: "irrelevant", label: "Irrelevant" },
  { value: "pending_verification", label: "Pending Verification" },
  { value: "verified", label: "Verified" },
  { value: "failed_verification", label: "Failed Verification" },
  { value: "has_email", label: "Has Email" },
  { value: "no_email", label: "No Email" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All" },
  { value: "maps", label: "Maps" },
  { value: "serp", label: "SERP" },
] as const;

function filterLabel(value: string): string {
  return FILTER_PILLS.find((p) => p.value === value)?.label ?? value;
}

function humanizeStatus(status: string | null): string {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function scoreColor(n: number, decision: string | null): string {
  if (decision === "irrelevant") return "var(--destructive)";
  if (n >= 75) return "var(--chart-2)";
  if (n >= 50) return "var(--chart-3)";
  return "var(--destructive)";
}

function relevancyPill(decision: string | null) {
  if (!decision) {
    return { label: "Pending", bg: "rgba(107,114,128,0.15)", color: "#9ca3af" };
  }
  if (decision === "relevant") {
    return { label: "Relevant", bg: "rgba(34,197,94,0.12)", color: "#4ade80" };
  }
  if (decision === "irrelevant") {
    return { label: "Irrelevant", bg: "rgba(239,68,68,0.1)", color: "#f87171" };
  }
  if (decision === "low_confidence") {
    return { label: "Low Confidence", bg: "rgba(245,158,11,0.1)", color: "#fbbf24" };
  }
  return { label: humanizeStatus(decision), bg: "var(--border)", color: "var(--muted-foreground)" };
}

function computeLeadStatus(lead: Lead): { label: string; bg: string; color: string } {
  const score = lead.verification_score;
  if (lead.is_saved_client && score != null && score >= 50) {
    return { label: "Saved", bg: "rgba(20,184,166,0.15)", color: "#2dd4bf" };
  }
  if (score != null && score >= 50) {
    return { label: "Verified", bg: "rgba(34,197,94,0.12)", color: "#4ade80" };
  }
  if (score != null && score < 50) {
    return { label: "Failed Verification", bg: "rgba(239,68,68,0.1)", color: "#f87171" };
  }
  if (lead.relevance_decision === "relevant" && score == null) {
    return { label: "Pending Verification", bg: "rgba(59,130,246,0.15)", color: "#60a5fa" };
  }
  if (lead.relevance_decision === "irrelevant") {
    return { label: "Rejected Relevancy", bg: "rgba(239,68,68,0.1)", color: "#f87171" };
  }
  if (lead.relevance_decision === "low_confidence") {
    return { label: "Low Confidence", bg: "rgba(245,158,11,0.1)", color: "#fbbf24" };
  }
  return { label: "Pending Relevancy", bg: "rgba(107,114,128,0.15)", color: "#9ca3af" };
}

function SourceBadge({ source }: { source: string }) {
  const isSerp = source === "serp";
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 4,
        letterSpacing: "0.04em",
        display: "inline-block",
        background: isSerp ? "rgba(99,102,241,0.15)" : "rgba(34,197,94,0.12)",
        color: isSerp ? "#818cf8" : "#4ade80",
        border: `1px solid ${isSerp ? "rgba(99,102,241,0.3)" : "rgba(34,197,94,0.25)"}`,
      }}
    >
      {isSerp ? "WEB" : "MAPS"}
    </span>
  );
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = searchParams.get("filter") || "all";
  const sourceParam = searchParams.get("source") || "";
  const sessionParam = searchParams.get("session_id") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState<"save" | null>(null);

  const {
    relevanceJob: activeRelevanceJob,
    verifyJob: activeVerifyJob,
    startRelevanceJob,
    pauseRelevanceJob,
    dismissRelevanceBanner,
    startVerifyJob,
    cancelVerifyJob,
    dismissVerifyBanner,
  } = useBackgroundJobs();

  const sessionId = sessionParam ? parseInt(sessionParam, 10) : undefined;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setFilter = (value: string) => {
    updateParams({ filter: value === "all" ? null : value, page: "1" });
  };

  const setSource = (value: string) => {
    updateParams({ source: value || null, page: "1" });
  };

  const setSession = (value: string) => {
    updateParams({ session_id: value === "all" ? null : value, page: "1" });
  };

  const setPage = (p: number) => {
    updateParams({ page: p === 1 ? null : String(p) });
  };

  const fetchLeads = useCallback(() => {
    setLoading(true);
    api
      .getLeads({
        filter: filter === "all" ? undefined : filter,
        source: sourceParam || undefined,
        session_id: sessionId,
        page,
      })
      .then((res) => {
        setLeads(res.leads);
        setTotal(res.total);
        setTotalPages(res.total_pages);
      })
      .catch((err: Error) => {
        toast.error(err.message || "Failed to load leads");
        setLeads([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [filter, sourceParam, sessionId, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    api.sessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  const setRowAction = (id: number, action: string | null) => {
    setActionLoading((prev) => {
      const next = { ...prev };
      const key = String(id);
      if (action) next[key] = action;
      else delete next[key];
      return next;
    });
  };

  const handleSaveClient = async (lead: Lead) => {
    setRowAction(lead.id, "save");
    try {
      await api.updateClientStatus(lead.id, true);
      toast.success(`${lead.name} saved to Clients`);
      fetchLeads();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save client");
    } finally {
      setRowAction(lead.id, null);
    }
  };

  const toggleId = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  const toggleAll = () =>
    setSelectedIds((prev) =>
      prev.length === leads.length ? [] : leads.map((l) => l.id)
    );

  const handleRunAI = async () => {
    if (!selectedIds.length) { toast.error("Select at least one lead"); return; }
    const idsToRun = leads
      .filter(l => selectedIds.includes(l.id) && l.relevance_decision == null)
      .map(l => l.id);
    if (!idsToRun.length) { toast.error("Selected leads already have a relevancy decision."); return; }

    const businesses = leads
      .filter(l => idsToRun.includes(l.id))
      .map(l => ({
        result_id: l.id,
        business_name: l.name,
        business_type: "",
        address: "",
        website: l.website ?? "",
      }));

    setSelectedIds([]);

    await startRelevanceJob({
      selectedIds: idsToRun.map(String),
      sessionId: leads.find(l => idsToRun.includes(l.id))?.search_id ?? 0,
      contextId: null,
      contextName: undefined,
      businesses,
      onItemUpdate: (_id, partial) => {
        setLeads(prev =>
          prev.map(l =>
            String(l.id) === _id
              ? {
                  ...l,
                  ...(partial.relevance_decision != null ? { relevance_decision: partial.relevance_decision } : {}),
                  ...(partial.relevance_score != null ? { relevance_score: partial.relevance_score } : {}),
                  ...(partial.relevance_reason != null ? { relevance_reason: partial.relevance_reason } : {}),
                }
              : l
          )
        );
      },
      onSessionRefresh: fetchLeads,
    });
  };

  const handleVerify = () => {
    if (!selectedIds.length) { toast.error("Select at least one lead"); return; }
    const validIds = leads
      .filter(l =>
        selectedIds.includes(l.id) &&
        l.relevance_decision === "relevant" &&
        l.verification_score == null
      )
      .map(l => l.id);
    if (!validIds.length) {
      toast.error("No relevant unverified leads selected. Run AI relevance first, then verify only relevant leads.");
      return;
    }
    const sessionId = leads.find(l => validIds.includes(l.id))?.search_id ?? 0;
    setSelectedIds([]);
    startVerifyJob({
      validIds,
      sessionId,
      onItemUpdate: (_id, partial) => {
        setLeads(prev =>
          prev.map(l =>
            String(l.id) === _id
              ? {
                  ...l,
                  ...(partial.verification_score != null ? { verification_score: partial.verification_score } : {}),
                }
              : l
          )
        );
      },
    });
  };

  const handleBulkSave = async () => {
    if (!selectedIds.length) {
      toast.error("Select at least one lead");
      return;
    }
    const eligible = selectedIds.filter((id) => {
      const lead = leads.find((l) => l.id === id);
      return (
        lead &&
        !lead.is_saved_client &&
        lead.verification_score != null &&
        lead.verification_score >= 50
      );
    });
    if (!eligible.length) {
      toast.error(
        "No verified leads selected. Only verified leads (score ≥ 50) can be saved."
      );
      return;
    }
    setBulkBusy("save");
    try {
      const results = await Promise.allSettled(
        eligible.map((id) => api.updateClientStatus(id, true))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === eligible.length) {
        toast.error("Failed to save leads");
      } else if (failed > 0) {
        toast.warning(`${eligible.length - failed} saved, ${failed} failed`);
      } else {
        toast.success(`${eligible.length} lead(s) saved to Clients`);
      }
      setSelectedIds([]);
      fetchLeads();
    } finally {
      setBulkBusy(null);
    }
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    border: active ? "1px solid #3b82f6" : "1px solid var(--border)",
    background: active ? "rgba(59,130,246,0.15)" : "transparent",
    color: active ? "#60a5fa" : "var(--muted-foreground)",
    fontFamily: "DM Sans, sans-serif",
  });

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid var(--border)",
    background: active ? "var(--muted)" : "transparent",
    color: active ? "var(--foreground)" : "var(--muted-foreground)",
    fontFamily: "DM Sans, sans-serif",
  });

  return (
    <div className="p-6 space-y-5 page-enter" style={{ background: "var(--background)", minHeight: "100%" }}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          Leads Hub
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          All discovered leads across every search session
        </p>
      </div>

      <div style={card} className="p-4 space-y-3">
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              style={pillStyle(filter === pill.value || (pill.value === "all" && filter === "all"))}
              onClick={() => setFilter(pill.value)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Source
            </span>
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                style={toggleStyle(sourceParam === opt.value)}
                onClick={() => setSource(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Session
            </span>
            <select
              value={sessionParam || "all"}
              onChange={(e) => setSession(e.target.value)}
              className="text-sm rounded-md px-3 py-1.5"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontFamily: "DM Sans, sans-serif",
                maxWidth: 280,
              }}
            >
              <option value="all">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.search_id} value={String(s.search_id)}>
                  {s.search_query || `Session #${s.search_id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-between px-4 py-2 rounded-lg"
        style={card}
      >
        <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {loading ? "…" : `${total} leads`}
        </span>
        <span
          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
        >
          {filterLabel(filter)}
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
          style={{
            background: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.25)",
          }}
        >
          <span className="text-sm font-semibold text-blue-400">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              style={btnPrimary}
              onClick={handleRunAI}
              disabled={activeRelevanceJob?.isRunning === true}
            >
              {activeRelevanceJob?.isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Run AI Relevance
            </button>
            <button
              type="button"
              style={btnGhost}
              onClick={handleVerify}
              disabled={activeVerifyJob?.isRunning === true}
            >
              {activeVerifyJob?.isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              Verify Selected
            </button>
            <button
              type="button"
              style={btnGhost}
              onClick={handleBulkSave}
              disabled={bulkBusy !== null}
            >
              {bulkBusy === "save" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save to Clients
            </button>
          </div>
          <button
            type="button"
            style={{ ...btnGhost, marginLeft: "auto" }}
            onClick={() => setSelectedIds([])}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      )}

      {activeRelevanceJob?.bannerVisible && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {activeRelevanceJob.isRunning
                ? <>AI Relevance Scoring in progress — {Math.round(activeRelevanceJob.progress)}% complete</>
                : activeRelevanceJob.isComplete
                ? <>AI Relevance Scoring complete — {activeRelevanceJob.completedIds.size} leads processed</>
                : <>AI Relevance Scoring paused — {activeRelevanceJob.completedIds.size} leads processed so far</>}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {activeRelevanceJob.activeItemId && (
                <div className="font-medium">
                  Processing: {leads.find(l => String(l.id) === activeRelevanceJob.activeItemId)?.name ?? activeRelevanceJob.activeItemId}
                </div>
              )}
              {activeRelevanceJob.activeItemId && activeRelevanceJob.phaseById[activeRelevanceJob.activeItemId] && (
                <div className="mt-1">{activeRelevanceJob.phaseById[activeRelevanceJob.activeItemId]}</div>
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
            <button type="button" style={btnGhost} onClick={dismissRelevanceBanner}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {activeVerifyJob?.bannerVisible && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <span className="text-2xl">🔒</span>
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {activeVerifyJob.isRunning
                ? <>Verifying {activeVerifyJob.completedIds.size}/{activeVerifyJob.totalCount}</>
                : <>Verification complete — {activeVerifyJob.completedIds.size} leads verified</>}
              {activeVerifyJob.activeItemId && ` — ${leads.find(l => String(l.id) === activeVerifyJob.activeItemId)?.name ?? ""}`}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {(activeVerifyJob.activeItemId && activeVerifyJob.phaseById[activeVerifyJob.activeItemId]) || "Checking SSL, domain age, social presence, legal registration…"}
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent)" }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${activeVerifyJob.totalCount > 0 ? (activeVerifyJob.completedIds.size / activeVerifyJob.totalCount) * 100 : 0}%`, background: "var(--chart-2)" }} />
            </div>
          </div>
          <div className="flex gap-2">
            {activeVerifyJob.isRunning && (
              <button type="button" style={btnGhost} onClick={cancelVerifyJob}>Cancel</button>
            )}
            <button type="button" style={btnGhost} onClick={dismissVerifyBanner}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div style={{ ...card, overflowX: "auto" }}>
        <div style={{ minWidth: 900 }}>
          <div
            className="grid text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 py-3"
            style={{
              gridTemplateColumns: GRID_COLUMNS,
              background: "var(--muted)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={selectedIds.length === leads.length && leads.length > 0}
                onChange={toggleAll}
              />
            </div>
            <div>Company</div>
            <div>Source</div>
            <div>Relevance</div>
            <div>Verification</div>
            <div>Decision</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <div
              className="grid px-4 py-12 text-center text-sm text-muted-foreground"
              style={{ gridTemplateColumns: GRID_COLUMNS, background: "var(--card)" }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                Loading leads…
              </div>
            </div>
          ) : leads.length === 0 ? (
            <div
              className="grid px-4 py-12 text-center text-sm text-muted-foreground"
              style={{ gridTemplateColumns: GRID_COLUMNS, background: "var(--card)" }}
            >
              <div style={{ gridColumn: "1 / -1" }}>No leads match this filter.</div>
            </div>
          ) : (
            leads.map((lead) => {
              const rel = relevancyPill(lead.relevance_decision);
              const status = computeLeadStatus(lead);
              const verScore = lead.verification_score;
              const rowKey = String(lead.id);
              const busy = actionLoading[rowKey];
              const canSave =
                !lead.is_saved_client &&
                lead.verification_score != null &&
                lead.verification_score >= 50;
              const isSaved = lead.is_saved_client;
              const saving = busy === "save";

              return (
                <div
                  key={lead.id}
                  className="grid items-center px-4 py-3 transition-colors hover:bg-muted"
                  style={{
                    gridTemplateColumns: GRID_COLUMNS,
                    borderBottom: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                >
                  <div>
                    {activeRelevanceJob?.activeItemId === String(lead.id) || activeVerifyJob?.activeItemId === String(lead.id) ? (
                      <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                    ) : activeRelevanceJob?.completedIds.has(String(lead.id)) || activeVerifyJob?.completedIds.has(String(lead.id)) ? (
                      <span style={{ color: "var(--chart-2)", fontSize: 14, lineHeight: 1 }}>✓</span>
                    ) : (
                      <input type="checkbox" className="accent-blue-500" checked={selectedIds.includes(lead.id)} onChange={() => toggleId(lead.id)} />
                    )}
                  </div>

                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-left hover:underline"
                      style={{
                        color: "#60a5fa",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                        maxWidth: "100%",
                      }}
                      onClick={() => navigate(`/app/business/${lead.id}`)}
                    >
                      {lead.name}
                    </button>
                    {lead.website && (
                      <a
                        href={
                          lead.website.startsWith("http")
                            ? lead.website
                            : `https://${lead.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] hover:text-blue-300 flex items-center gap-1 mt-0.5"
                        style={{
                          color: "#60a5fa",
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {lead.website}
                        </span>
                      </a>
                    )}
                  </div>

                  <div>
                    <SourceBadge source={lead.source} />
                  </div>

                  <div>
                    {lead.relevance_score == null ? (
                      <span
                        className="text-[12px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        —
                      </span>
                    ) : (
                      <div className="flex items-center" style={{ paddingRight: 8 }}>
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--accent)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width:
                                lead.relevance_decision === "irrelevant"
                                  ? "0%"
                                  : `${lead.relevance_score}%`,
                              background: scoreColor(
                                lead.relevance_score,
                                lead.relevance_decision
                              ),
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    {verScore == null ? (
                      <span
                        className="text-[12px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Not run
                      </span>
                    ) : (
                      <div className="flex items-center" style={{ paddingRight: 8 }}>
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--accent)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${verScore}%`,
                              background:
                                verScore >= 50
                                  ? "var(--chart-2)"
                                  : "var(--destructive)",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: rel.bg, color: rel.color }}
                    >
                      {rel.label}
                    </span>
                  </div>

                  <div>
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex gap-1.5 items-center">
                    <button
                      type="button"
                      title="View details"
                      onClick={() => navigate(`/app/business/${lead.id}`)}
                      className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-accent"
                      style={actionBtnStyle}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={
                        isSaved
                          ? "Saved to clients"
                          : canSave
                            ? "Save to clients"
                            : "Save requires verification ≥ 50"
                      }
                      disabled={isSaved || !canSave || saving}
                      onClick={canSave ? () => handleSaveClient(lead) : undefined}
                      className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-accent"
                      style={{
                        ...actionBtnStyle,
                        cursor: isSaved
                          ? "default"
                          : canSave && !saving
                            ? "pointer"
                            : "not-allowed",
                        opacity: !isSaved && !canSave ? 0.4 : 1,
                      }}
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Star
                          className="h-3.5 w-3.5"
                          style={{ color: "#fbbf24" }}
                          fill={isSaved ? "#fbbf24" : "none"}
                        />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage(page - 1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
          style={{
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            background: "transparent",
            cursor: page <= 1 ? "not-allowed" : "pointer",
          }}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {pageNumbers.map((n, i) =>
          n === "ellipsis" ? (
            <span key={`e-${i}`} className="px-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              disabled={loading}
              className="w-8 h-8 rounded-md text-sm font-semibold"
              style={{
                border: n === page ? "1px solid #3b82f6" : "1px solid var(--border)",
                background: n === page ? "rgba(59,130,246,0.15)" : "transparent",
                color: n === page ? "#60a5fa" : "var(--muted-foreground)",
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          )
        )}

        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage(page + 1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
          style={{
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            background: "transparent",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <p className="text-center text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {PAGE_SIZE} leads per page
      </p>
    </div>
  );
}
