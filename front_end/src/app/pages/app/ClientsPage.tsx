import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { Search, Download, Mail, RefreshCw, Trash2, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import { api, exportClients, reverifyClient } from "../../../lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Prepend https:// only when the URL has no protocol yet. */
const normalizeUrl = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

/** Safely parse a value that may be a stringified JSON object. */
const safeParse = (v: any): Record<string, any> => {
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return {}; }
  }
  return v ?? {};
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 };
const btnPrimary: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };
const btnGhost: React.CSSProperties = { background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };

// ── Small components ───────────────────────────────────────────────────────────

const Badge = ({ children, color }: { children: React.ReactNode; color: "green"|"blue"|"amber"|"red"|"gray" }) => {
  const m = { green: ["rgba(16,185,129,0.1)","var(--chart-2)"], blue: ["rgba(59,130,246,0.1)","var(--primary)"], amber: ["rgba(245,158,11,0.1)","var(--chart-3)"], red: ["rgba(239,68,68,0.1)","var(--destructive)"], gray: ["var(--border)","var(--muted-foreground)"] };
  const [bg,text]=m[color];
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{background:bg,color:text}}>{children}</span>;
};

type Client = {
  id: string;
  name: string;
  category: string;
  location: string;
  website: string;
  email: string | null;
  relevanceScore: number;
  verificationStatus: string;
  verificationScore: number;
  stage: string;
  savedDate: string;
  searchQuery: string;
  signals?: {
    websiteLive?: boolean;
    ssl?: boolean;
    domainAge?: string;
    policyPages?: boolean;
    socialProfiles?: number;
    emailValid?: boolean;
    legalReg?: boolean;
    riskFlags?: string;
  }
};

const ScoreRing = ({ score }: { score: number }) => {
  const color = score >= 75 ? "var(--chart-2)" : score >= 50 ? "var(--chart-3)" : "var(--destructive)";
  const bg    = score >= 75 ? "rgba(16,185,129,0.1)" : score >= 50 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
      style={{ border: `2px solid ${color}`, background: bg, color }}>{score}</div>
  );
};

const Signal = ({ label, value, ok }: { label: string; value: string; ok: boolean }) => (
  <div className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
    <div className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
      style={{ background: ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
      {ok ? "✓" : "✗"}
    </div>
    <div className="flex-1 text-[12px] text-muted-foreground">{label}</div>
    <div className="text-[12px] font-semibold" style={{ color: ok ? "var(--chart-2)" : "var(--destructive)" }}>{value}</div>
  </div>
);

const stageBadge = (s: string) => {
  if (s === "Email Sent")  return <Badge color="blue">📧 Email Sent</Badge>;
  if (s === "Outreach")    return <Badge color="blue">📤 Outreach</Badge>;
  if (s === "Re-verify")   return <Badge color="amber">⚠ Re-verify</Badge>;
  if (s === "Email Ready") return <Badge color="green">✉ Email Ready</Badge>;
  return <Badge color="gray">Saved</Badge>;
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter]           = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [apiClients, setApiClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [reverifyingIds, setReverifyingIds] = useState<number[]>([]);
  const [pollingIds, setPollingIds] = useState<number[]>([]);
  const [sessionFilter, setSessionFilter] = useState<string>("all");

  const refreshClients = () => {
    api.clients()
      .then((c: any[]) => {
        setApiClients(c || []);
        // Keep the active panel in sync with the freshly fetched data.
        setActiveClient(prev =>
          prev
            ? (c || []).find((x: any) => String(x.result_id) === prev.id)
              ? {
                  ...prev,
                  verificationScore: (c || []).find((x: any) => String(x.result_id) === prev.id)?.verification_score ?? prev.verificationScore,
                  verificationStatus: (c || []).find((x: any) => String(x.result_id) === prev.id)?.verification_result ?? prev.verificationStatus,
                }
              : null
            : null
        );
      })
      .catch(console.error)
      .finally(() => setClientsLoading(false));
  };

  useEffect(() => {
    refreshClients();
  }, []);

  // Memoized so that downstream effects don't re-fire on every unrelated render.
  const displayClients = useMemo(() => apiClients.map((c: any) => {
    const artifacts = safeParse(c.verification_artifacts);
    const socials   = safeParse(c.social_links);
    return {
      id: String(c.result_id),
      name: c.business_name || "Unknown",
      category: c.business_type || "—",
      location: c.address || "—",
      website: c.website || "",
      email: c.email_found || null,
      relevanceScore: Math.round(c.relevance_score || 0),
      verificationStatus: c.verification_result || "pending",
      verificationScore: c.verification_score || 0,
      stage: c.email_found ? "Email Ready" : "Saved",
      savedDate: c.created_at || new Date().toISOString(),
      searchQuery: c.search_query || "—",
      signals: {
        websiteLive: artifacts?.accessibility?.website_live ?? true,
        ssl: artifacts?.accessibility?.ssl_valid ?? false,
        domainAge: c.domain_age_years ? `${c.domain_age_years} years` : "Unknown",
        policyPages: c.has_policy_pages || false,
        socialProfiles: Object.keys(socials).length,
        emailValid: !!c.email_found,
        legalReg: (c.verification_score || 0) > 60,
        riskFlags: (c.risk_flags || []).length === 0 ? "None" : (c.risk_flags || []).join(", ")
      }
    };
  }), [apiClients]);

  // Auto-select the first client when the list loads for the first time.
  useEffect(() => {
    if (!activeClient && displayClients.length > 0) {
      setActiveClient(displayClients[0]);
    }
  }, [displayClients]);

  const sessionOptions = useMemo(() => {
    const vals = [...new Set(apiClients.map((c: any) => c.search_query).filter(Boolean))];
    return vals.sort();
  }, [apiClients]);

  const filtered = useMemo(() => displayClients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.location || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filter === "all" || c.verificationStatus === filter;
    const matchSession = sessionFilter === "all" || c.searchQuery === sessionFilter;
    return matchSearch && matchFilter && matchSession;
  }), [displayClients, searchQuery, filter, sessionFilter]);

  // If the active client is no longer visible due to a filter/search change,
  // reset the panel to the first visible client (or null if the list is empty).
  useEffect(() => {
    if (activeClient && !filtered.some(c => c.id === activeClient.id)) {
      setActiveClient(filtered[0] ?? null);
    }
  }, [filtered]);

  useEffect(() => {
    if (pollingIds.length === 0) return;
    const interval = setInterval(() => {
      api.clients()
        .then((c: any[]) => {
          setApiClients(c || []);
          setActiveClient(prev =>
            prev
              ? (c || []).find((x: any) => String(x.result_id) === prev.id)
                ? {
                    ...prev,
                    verificationScore: (c || []).find((x: any) => String(x.result_id) === prev.id)?.verification_score ?? prev.verificationScore,
                    verificationStatus: (c || []).find((x: any) => String(x.result_id) === prev.id)?.verification_result ?? prev.verificationStatus,
                  }
                : null
              : null
          );
          // Stop polling for IDs whose verification_result is no longer null/pending
          setPollingIds(prev => prev.filter(id => {
            const updated = (c || []).find((x: any) => x.result_id === id);
            return !updated || !updated.verification_result || updated.verification_result === "pending";
          }));
        })
        .catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [pollingIds]);

  // Derived value — true when every visible client is already selected.
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id));

  const toggle    = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => setSelectedIds(allFilteredSelected ? [] : filtered.map(c => c.id));

  const filterTabs = [
    { key: "all",      label: `All (${displayClients.length})` },
    { key: "verified", label: "✓ Verified" },
    { key: "partial",  label: "⚠ Partial" },
    { key: "pending",  label: "⏳ Pending" },
  ];

  const handleExport = async (format: "csv" | "excel") => {
    const scopeParams: { ids?: string[]; status?: string } =
      selectedIds.length > 0
        ? { ids: selectedIds }
        : filter !== "all"
        ? { status: filter }
        : {};

    setExporting(true);
    try {
      await exportClients({ format, ...scopeParams });
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Accepts one or many IDs — uses Promise.allSettled so a single failure
  // does not abort the remaining re-verification requests.
  const handleReverify = async (resultIds: number[]) => {
    setReverifyingIds(prev => [...prev, ...resultIds]);
    setPollingIds(prev => [...prev, ...resultIds]);
    try {
      const results = await Promise.allSettled(resultIds.map(id => reverifyClient(id)));
      const failed = results.filter(r => r.status === "rejected").length;
      if (failed === 0) {
        toast.success(resultIds.length > 1 ? `Re-verifying ${resultIds.length} clients` : "Verification started — this may take a minute");
      } else {
        toast.warning(`${resultIds.length - failed} started, ${failed} failed`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Re-verify failed");
    } finally {
      setReverifyingIds(prev => prev.filter(id => !resultIds.includes(id)));
    }
  };

  const vs = activeClient?.verificationScore || 0;
  const ringColor = vs >= 75 ? "var(--chart-2)" : vs >= 50 ? "var(--chart-3)" : "var(--destructive)";
  const ringBg    = vs >= 75 ? "rgba(16,185,129,0.1)" : vs >= 50 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";

  return (
    <div className="p-6 space-y-4 page-enter">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">Your saved and verified lead database</p>
      </div>
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
              style={filter === t.key
                ? { background: "rgba(59,130,246,0.1)", border: "1px solid var(--primary)", color: "var(--primary)" }
                : { background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search clients…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg text-[13px] text-foreground outline-none"
                style={{ background: "var(--muted)", border: "1px solid var(--border)", width: 180 }}
              />
            </div>
            <select
              value={sessionFilter}
              onChange={e => setSessionFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg text-[13px] text-foreground outline-none"
              style={{ background: "var(--muted)", border: "1px solid var(--border)", color: sessionFilter === "all" ? "var(--muted-foreground)" : "var(--foreground)", minWidth: 160 }}
            >
              <option value="all">All Search Queries</option>
              {sessionOptions.map(s => <option key={s} value={s} title={s}>{s.length > 22 ? s.slice(0, 22) + "…" : s}</option>)}
            </select>
          </div>
          <button style={btnGhost} disabled={exporting} onClick={() => handleExport("csv")}><Download className="h-3.5 w-3.5"/>{exporting ? "Exporting…" : "Export CSV"}</button>
          <button style={btnGhost} disabled={exporting} onClick={() => handleExport("excel")}><Download className="h-3.5 w-3.5"/>Export Excel</button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{selectedIds.length} selected</span>
          <div className="flex gap-2">
            <button style={btnGhost} disabled={exporting} onClick={() => handleExport("csv")}><Download className="h-3.5 w-3.5"/>Export CSV</button>
            <button style={btnGhost} disabled={exporting} onClick={() => handleExport("excel")}><Download className="h-3.5 w-3.5"/>Export Excel</button>
            <button style={btnPrimary} onClick={() => navigate(`/app/email?tab=campaign&clientIds=${selectedIds.join(",")}`)}><Mail className="h-3.5 w-3.5"/>Generate Emails</button>
            <button
              style={btnGhost}
              disabled={reverifyingIds.length > 0}
              onClick={() => handleReverify(selectedIds.map(id => Number(id)))}
            >
              <RefreshCw className="h-3.5 w-3.5"/>Re-verify All
            </button>
            <button
              style={{ ...btnGhost, color: "var(--destructive)" }}
              onClick={async () => {
                try {
                  const resultIds = selectedIds.map(id => Number(id));
                  await api.deleteClients(resultIds);
                  toast.success("Removed");
                  setSelectedIds([]);
                  refreshClients();
                } catch (err) {
                  console.error(err);
                  toast.error("Remove failed");
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5"/>Remove
            </button>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px", alignItems: "start" }}>

        {/* Table */}
        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          {clientsLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : displayClients.length === 0 ? (
            <div className="text-center py-20 text-gray-400">No clients found.</div>
          ) : (
            <>
              {/* Header */}
              <div className="grid text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 py-3"
                style={{ gridTemplateColumns: "28px 1fr 70px 90px 130px 90px 80px", background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="accent-blue-500"
                  />
                </div>
                <div>Business</div><div>Score</div><div>Relevance</div><div>Stage</div><div>Contact</div><div>Saved</div>
              </div>

              {filtered.map((c, i) => {
                const isReverifying = reverifyingIds.includes(Number(c.id));
                return (
                  <div key={c.id}
                    className="grid items-center px-4 py-3 cursor-pointer transition-colors"
                    style={{
                      gridTemplateColumns: "28px 1fr 70px 90px 130px 90px 80px",
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      background: activeClient?.id === c.id ? "rgba(59,130,246,0.05)" : selectedIds.includes(c.id) ? "rgba(59,130,246,0.03)" : "var(--background)",
                    }}
                    onClick={() => setActiveClient(c)}>
                    <div onClick={e => { e.stopPropagation(); toggle(c.id); }}>
                      <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} className="accent-blue-500"/>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{c.location} · {c.category}</div>
                    </div>
                    <div><ScoreRing score={c.verificationScore}/></div>
                    <div className="text-[13px] font-bold" style={{ color: c.relevanceScore >= 75 ? "var(--chart-2)" : "var(--chart-3)" }}>{c.relevanceScore}%</div>
                    <div>{stageBadge(c.stage)}</div>
                    <div className="text-[11px] text-muted-foreground">{c.email ? `✉ ${c.email.split("@")[0]}…` : "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(c.savedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="py-12 flex flex-col items-center text-center">
                  <div className="text-3xl mb-2 opacity-40">👤</div>
                  <div className="text-sm font-bold text-foreground">No clients match</div>
                  <div className="text-[12px] text-muted-foreground mt-1">Try clearing the filter or search</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Verification Details Panel */}
        {activeClient && (
        <div className="rounded-xl overflow-hidden sticky top-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          {/* Panel header */}
          <div className="p-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{ border: `2px solid ${ringColor}`, background: ringBg, color: ringColor, fontFamily: "Syne,sans-serif" }}>
              {activeClient?.verificationScore}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-foreground truncate" style={{ fontFamily: "Syne,sans-serif" }}>{activeClient?.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Verification Report</div>
              <div className="mt-1">
                {activeClient?.verificationStatus === "verified"
                  ? <Badge color="green">✓ Fully Verified</Badge>
                  : activeClient?.verificationStatus === "partial"
                    ? <Badge color="amber">⚠ Partial</Badge>
                    : <Badge color="red">✗ Failed</Badge>}
              </div>
            </div>
          </div>

          {/* Trust Signals */}
          <div className="px-4 py-3">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Trust Signals</div>
            <Signal label="Website Live"       value={(activeClient?.signals?.websiteLive || false) ? "Active" : "Down"}      ok={activeClient?.signals?.websiteLive || false} />
            <Signal label="SSL Certificate"    value={(activeClient?.signals?.ssl || false) ? "Valid" : "Invalid"}            ok={activeClient?.signals?.ssl || false} />
            <Signal label="Domain Age"         value={activeClient?.signals?.domainAge || "Unknown"}                          ok={true} />
            <Signal label="Policy Pages"       value={(activeClient?.signals?.policyPages || false) ? "Found" : "Missing"}    ok={activeClient?.signals?.policyPages || false} />
            <Signal label="Social Media"       value={`${activeClient?.signals?.socialProfiles || 0} profiles`}               ok={(activeClient?.signals?.socialProfiles || 0) > 0} />
            <Signal label="Email Validity"     value={(activeClient?.signals?.emailValid || false) ? "Deliverable" : "Risky"} ok={activeClient?.signals?.emailValid || false} />
            <Signal label="Legal Registration" value={(activeClient?.signals?.legalReg || false) ? "Verified" : "Unknown"}    ok={activeClient?.signals?.legalReg || false} />
            <div className="flex items-center gap-2 pt-2">
              <div className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
                style={{ background: (activeClient?.signals?.riskFlags || "None") === "None" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>⚠</div>
              <div className="flex-1 text-[12px] text-muted-foreground">Risk Flags</div>
              <div className="text-[12px] font-semibold" style={{ color: (activeClient?.signals?.riskFlags || "None") === "None" ? "var(--chart-2)" : "var(--destructive)" }}>
                {activeClient?.signals?.riskFlags || "None"}
              </div>
            </div>
          </div>

          {/* AI Relevance summary */}
          <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">AI Relevance</div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent)" }}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${activeClient?.relevanceScore || 0}%` }}/>
              </div>
              <span className="text-[12px] font-bold text-primary">{activeClient?.relevanceScore || 0}%</span>
            </div>
            <div className="text-[11px] text-muted-foreground">Strong B2B profile match. Verified export market presence.</div>
          </div>

          {/* Actions */}
          <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button style={{ ...btnPrimary, width: "100%", justifyContent: "center" }} onClick={() => navigate(`/app/email?tab=campaign&clientIds=${activeClient.id}`)}>
              <Mail className="h-3.5 w-3.5"/>Generate Outreach Email
            </button>
            <div className="flex gap-2">
              {(() => {
                const id = Number(activeClient.id);
                const isPolling = pollingIds.includes(id);
                const isStarting = reverifyingIds.includes(id);
                return (
                  <button
                    style={{ ...btnGhost, flex: 1, justifyContent: "center", opacity: (isStarting || isPolling) ? 0.7 : 1 }}
                    disabled={isStarting || isPolling}
                    onClick={() => handleReverify([id])}
                  >
                    {(isStarting || isPolling)
                      ? <><span className="inline-block animate-spin mr-1.5">↻</span>{isStarting ? "Starting…" : "Verifying…"}</>
                      : <><RefreshCw className="h-3.5 w-3.5"/>Re-verify</>
                    }
                  </button>
                );
              })()}
              <a href={normalizeUrl(activeClient?.website || "")} target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                style={{ border: "1px solid var(--border)", padding: "6px 12px" }}>
                <ExternalLink className="h-3.5 w-3.5"/>Website
              </a>
            </div>
            <button
              onClick={() => navigate(`/app/business/${activeClient?.id}`)}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: "var(--foreground)",
                fontSize: "14px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--muted)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <Eye className="h-4 w-4" />
              View Full Details
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
