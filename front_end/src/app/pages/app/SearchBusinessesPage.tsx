import { useState } from "react";
import { Link } from "react-router";
import { Search, MapPin, Sparkles, ShieldCheck, Save, ExternalLink, Clock, RefreshCw, Play, Eye, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";

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

const mockResults = [
  { id: "1", name: "TechCorp Industries",   category: "Technology",   location: "Dubai, UAE",      website: "techcorp.ae",           email: "info@techcorp.ae",           phone: "+971 4 123 4567", relevanceScore: 94, relevanceStatus: "passed",         verificationScore: 92, verificationStatus: "verified", reasoning: "Strong B2B export focus, active in MENA markets, verified online presence." },
  { id: "2", name: "Global Exports Ltd",    category: "Trading",      location: "Abu Dhabi, UAE",  website: "globalexports.com",     email: "contact@globalexports.com",  phone: "+971 2 987 6543", relevanceScore: 88, relevanceStatus: "passed",         verificationScore: 85, verificationStatus: "verified", reasoning: "Established export company with verified credentials and strong track record." },
  { id: "3", name: "Innovation Partners",   category: "Consulting",   location: "Sharjah, UAE",    website: "innovationpartners.ae", email: "hello@innovationpartners.ae",phone: null,              relevanceScore: 76, relevanceStatus: "low-confidence", verificationScore: null, verificationStatus: "pending",  reasoning: "Moderate match — service-based, export focus unclear from available data." },
  { id: "4", name: "Emirates Trading Co",   category: "Import/Export",location: "Dubai, UAE",      website: "emiratestrading.ae",    email: "sales@emiratestrading.ae",   phone: "+971 4 555 1234", relevanceScore: 91, relevanceStatus: "passed",         verificationScore: 78, verificationStatus: "partial",  reasoning: "Strong B2B trading match. Some verification data incomplete — re-run recommended." },
  { id: "5", name: "Meridian Supply GmbH",  category: "Wholesale",    location: "Hamburg, DE",     website: "meridian-supply.de",    email: "info@meridian-supply.de",    phone: "+49 40 7890 12",  relevanceScore: 82, relevanceStatus: "passed",         verificationScore: 89, verificationStatus: "verified", reasoning: "German wholesale supplier with verified legal registration and strong domain." },
  { id: "6", name: "Sunrise Distributors", category: "Distribution", location: "Istanbul, TR",     website: "sunrisedist.tr",        email: "sales@sunrisedist.tr",       phone: null,              relevanceScore: 41, relevanceStatus: "failed",         verificationScore: 32, verificationStatus: "failed",   reasoning: "Low relevance — primarily retail focused, does not align with B2B export context." },
];

const recentSearches = [
  { query: "Textile exporters Lahore Pakistan", context: "B2B Outreach", time: "2h ago",  results: 284 },
  { query: "Wholesale distributors UAE",        context: "Export",       time: "5h ago",  results: 156 },
  { query: "Construction suppliers Germany",    context: "Default",      time: "1d ago",  results: 412 },
];

export default function SearchBusinessesPage() {
  const [searchQuery, setSearchQuery]       = useState("");
  const [location, setLocation]             = useState("");
  const [selectedContext, setSelectedContext] = useState("b2b-exporters");
  const [searching, setSearching]           = useState(false);
  const [processingAI, setProcessingAI]     = useState(false);
  const [aiProgress, setAiProgress]         = useState(0);
  const [processingVerify, setProcessingVerify] = useState(false);
  const [selectedIds, setSelectedIds]       = useState<string[]>([]);
  const [activeFilter, setActiveFilter]     = useState("all");
  const [showHistory, setShowHistory]       = useState(false);

  const contexts = [
    { id: "b2b-exporters", name: "B2B Export Outreach", desc: "Companies focused on international B2B export" },
    { id: "tech-partners",  name: "Tech Partners",       desc: "Technology solution providers" },
    { id: "manufacturing",  name: "Manufacturing Buyer", desc: "Industrial manufacturers and suppliers" },
  ];

  const handleSearch = () => {
    if (!searchQuery && !location) { toast.error("Enter a keyword or location to search"); return; }
    setSearching(true);
    toast.loading("Searching businesses…");
    setTimeout(() => { setSearching(false); toast.success("Found 156 businesses"); }, 2200);
  };

  const handleRunAI = () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    setProcessingAI(true);
    setAiProgress(0);
    toast.info(`Running AI relevance on ${selectedIds.length} leads…`);
    const iv = setInterval(() => setAiProgress(p => { if (p >= 95) { clearInterval(iv); setProcessingAI(false); setSelectedIds([]); toast.success("AI scoring complete!"); return 100; } return p + Math.random() * 12; }), 300);
  };

  const handleVerify = () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    setProcessingVerify(true);
    toast.info(`Verifying ${selectedIds.length} leads…`);
    setTimeout(() => { setProcessingVerify(false); setSelectedIds([]); toast.success("Verification complete!"); }, 3500);
  };

  const handleSave = () => {
    if (!selectedIds.length) { toast.error("Select at least one business"); return; }
    toast.success(`${selectedIds.length} businesses saved to Clients`);
    setSelectedIds([]);
  };

  const toggle = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll = () => setSelectedIds(p => p.length === filtered.length ? [] : filtered.map(r => r.id));

  const filtered = mockResults.filter(r => {
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
    { key: "all",     label: `All (${mockResults.length})` },
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
            {searching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Context selector */}
        <div className="mt-4 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[11px] text-[#5a6478] font-semibold">AI Context:</span>
          {contexts.map(c => (
            <button key={c.id} onClick={() => setSelectedContext(c.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
              style={selectedContext === c.id
                ? { background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }
                : { background: "#151a22", border: "1px solid rgba(255,255,255,0.07)", color: "#8a95a8" }}>
              {selectedContext === c.id ? "🧠 " : ""}{c.name}
            </button>
          ))}
          <button onClick={() => toast.info("Context editor coming soon!")}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
            style={{ background: "#151a22", border: "1px solid rgba(255,255,255,0.07)", color: "#5a6478" }}>
            + New Context
          </button>
          <span className="text-[11px] text-[#5a6478] ml-1 italic">
            {contexts.find(c => c.id === selectedContext)?.desc}
          </span>
        </div>
      </div>

      {/* AI Processing Banner */}
      {processingAI && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[#e8edf5]">AI Relevance Scoring in progress — {Math.round(aiProgress)}% complete</div>
            <div className="text-[12px] text-[#8a95a8] mt-0.5">Analysing against "{contexts.find(c => c.id === selectedContext)?.name}" context. Partial results shown below.</div>
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
            <button style={btnGhost} onClick={handleVerify}><ShieldCheck className="h-3.5 w-3.5" />Verify Selected</button>
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
            {recentSearches.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-[#151a22] transition-colors"
                onClick={() => { setSearchQuery(s.query); setShowHistory(false); toast.info("Search reloaded"); }}>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-[#e8edf5]">{s.query}</div>
                  <div className="text-[11px] text-[#5a6478]">{s.context} · {s.results} results · {s.time}</div>
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
            style={{ gridTemplateColumns: "28px 1fr 110px 120px 130px 110px 100px 110px", background: "#151a22", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
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
                gridTemplateColumns: "28px 1fr 110px 120px 130px 110px 100px 110px",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                background: selectedIds.includes(r.id) ? "rgba(59,130,246,0.04)" : "#0f1218",
              }}>
              <div><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggle(r.id)} className="accent-blue-500" /></div>

              <div>
                <div className="text-[13px] font-semibold text-[#e8edf5]">{r.name}</div>
                <a href={`https://${r.website}`} target="_blank" rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5 w-fit"
                  onClick={e => e.stopPropagation()}>
                  <ExternalLink className="h-2.5 w-2.5" />{r.website}
                </a>
              </div>

              <div>
                <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#8a95a8" }}>{r.category}</span>
              </div>

              <div className="text-[12px] text-[#8a95a8] flex items-center gap-1">
                <MapPin className="h-3 w-3 flex-shrink-0" />{r.location}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#1c2230" }}>
                    <div className="h-full rounded-full" style={{ width: `${r.relevanceScore}%`, background: scoreColor(r.relevanceScore) }} />
                  </div>
                  <span className="text-[12px] font-bold w-7 text-right" style={{ color: scoreColor(r.relevanceScore) }}>{r.relevanceScore}</span>
                </div>
                <div className="text-[10px] text-[#5a6478] mt-1 line-clamp-1">{r.reasoning}</div>
              </div>

              <div>{verifyBadge(r.verificationStatus)}</div>
              <div>{relevanceBadge(r.relevanceStatus)}</div>

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

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-3xl mb-3 opacity-40">🔍</div>
              <div className="text-sm font-bold text-[#e8edf5] mb-1">No results match this filter</div>
              <div className="text-[12px] text-[#5a6478]">Try switching to "All" or run a new search</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
