import { useState } from "react";
import { useNavigate } from "react-router";
import { Search, Download, Mail, RefreshCw, Trash2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const card: React.CSSProperties = { background: "#0f1218", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 };
const btnPrimary: React.CSSProperties = { background: "#3b82f6", color: "white", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 5 };
const btnGhost: React.CSSProperties = { background: "transparent", color: "#8a95a8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 5 };

const Badge = ({ children, color }: { children: React.ReactNode; color: "green"|"blue"|"amber"|"red"|"gray" }) => {
  const m = { green: ["rgba(16,185,129,0.1)","#10b981"], blue: ["rgba(59,130,246,0.15)","#60a5fa"], amber: ["rgba(245,158,11,0.1)","#f59e0b"], red: ["rgba(239,68,68,0.1)","#ef4444"], gray: ["rgba(255,255,255,0.05)","#8a95a8"] };
  const [bg,text]=m[color];
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{background:bg,color:text}}>{children}</span>;
};

const clients = [
  { id:"1", name:"TechCorp Industries",   category:"Technology",   location:"Dubai, UAE",      website:"techcorp.ae",        email:"info@techcorp.ae",          relevanceScore:94, verificationStatus:"verified", verificationScore:92, stage:"Email Sent",   savedDate:"2026-03-14",
    signals:{ websiteLive:true, ssl:true, domainAge:"5 years", privacyPolicy:true, terms:true, socialProfiles:3, emailValid:true, legalReg:true, riskFlags:"None" } },
  { id:"2", name:"Global Exports Ltd",    category:"Trading",      location:"Abu Dhabi, UAE",  website:"globalexports.com",  email:"contact@globalexports.com", relevanceScore:88, verificationStatus:"verified", verificationScore:85, stage:"Saved",        savedDate:"2026-03-13",
    signals:{ websiteLive:true, ssl:true, domainAge:"8 years", privacyPolicy:true, terms:true, socialProfiles:2, emailValid:true, legalReg:true, riskFlags:"None" } },
  { id:"3", name:"Emirates Trading Co",   category:"Import/Export",location:"Dubai, UAE",      website:"emiratestrading.ae", email:"sales@emiratestrading.ae",  relevanceScore:91, verificationStatus:"partial",  verificationScore:78, stage:"Re-verify",    savedDate:"2026-03-12",
    signals:{ websiteLive:true, ssl:true, domainAge:"3 years", privacyPolicy:false, terms:false, socialProfiles:1, emailValid:true, legalReg:false, riskFlags:"No privacy policy" } },
  { id:"4", name:"Middle East Partners",  category:"Consulting",   location:"Sharjah, UAE",    website:"mepartners.ae",      email:"info@mepartners.ae",        relevanceScore:82, verificationStatus:"verified", verificationScore:88, stage:"Outreach",     savedDate:"2026-03-11",
    signals:{ websiteLive:true, ssl:true, domainAge:"6 years", privacyPolicy:true, terms:true, socialProfiles:4, emailValid:true, legalReg:true, riskFlags:"None" } },
  { id:"5", name:"Meridian Supply GmbH",  category:"Wholesale",    location:"Hamburg, DE",     website:"meridian-supply.de", email:"info@meridian-supply.de",   relevanceScore:86, verificationStatus:"verified", verificationScore:91, stage:"Saved",        savedDate:"2026-03-10",
    signals:{ websiteLive:true, ssl:true, domainAge:"10 years", privacyPolicy:true, terms:true, socialProfiles:5, emailValid:true, legalReg:true, riskFlags:"None" } },
];

type Client = typeof clients[0];

const ScoreRing = ({ score }: { score: number }) => {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const bg    = score >= 75 ? "rgba(16,185,129,0.1)" : score >= 50 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
      style={{ border: `2px solid ${color}`, background: bg, color }}>{score}</div>
  );
};

const Signal = ({ label, value, ok }: { label: string; value: string; ok: boolean }) => (
  <div className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
      style={{ background: ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
      {ok ? "✓" : "✗"}
    </div>
    <div className="flex-1 text-[12px] text-[#8a95a8]">{label}</div>
    <div className="text-[12px] font-semibold" style={{ color: ok ? "#10b981" : "#ef4444" }}>{value}</div>
  </div>
);

const stageBadge = (s: string) => {
  if (s === "Email Sent") return <Badge color="blue">📧 Email Sent</Badge>;
  if (s === "Outreach")   return <Badge color="blue">📤 Outreach</Badge>;
  if (s === "Re-verify")  return <Badge color="amber">⚠ Re-verify</Badge>;
  return <Badge color="gray">Saved</Badge>;
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter]           = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeClient, setActiveClient] = useState<Client>(clients[0]);

  const toggle = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i=>i!==id) : [...p,id]);
  const toggleAll = () => setSelectedIds(p => p.length===filtered.length ? [] : filtered.map(c=>c.id));

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filter==="all" || c.verificationStatus===filter;
    return matchSearch && matchFilter;
  });

  const filterTabs = [
    { key:"all",      label:`All (${clients.length})` },
    { key:"verified", label:"✓ Verified" },
    { key:"partial",  label:"⚠ Partial" },
    { key:"pending",  label:"⏳ Pending" },
  ];

  const vs = activeClient.verificationScore;
  const ringColor = vs>=75 ? "#10b981" : vs>=50 ? "#f59e0b" : "#ef4444";
  const ringBg    = vs>=75 ? "rgba(16,185,129,0.1)" : vs>=50 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";

  return (
    <div className="p-6 space-y-4 page-enter">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(t => (
            <button key={t.key} onClick={()=>setFilter(t.key)}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
              style={filter===t.key
                ? {background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",color:"#60a5fa"}
                : {background:"#151a22",border:"1px solid rgba(255,255,255,0.07)",color:"#8a95a8"}}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a6478]" />
            <input placeholder="Search clients…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg text-[13px] text-[#e8edf5] outline-none"
              style={{background:"#151a22",border:"1px solid rgba(255,255,255,0.09)",width:200}} />
          </div>
          <button style={btnGhost} onClick={()=>toast.success("CSV exported!")}><Download className="h-3.5 w-3.5"/>Export CSV</button>
          <button style={btnPrimary} onClick={()=>navigate("/app/email")}><Mail className="h-3.5 w-3.5"/>Generate Emails</button>
        </div>
      </div>

      {/* Bulk bar */}
      {selectedIds.length>0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
          style={{background:"rgba(59,130,246,0.05)",border:"1px solid rgba(59,130,246,0.2)"}}>
          <span className="text-sm font-semibold text-blue-400">{selectedIds.length} selected</span>
          <div className="flex gap-2">
            <button style={btnGhost} onClick={()=>toast.success("CSV exported!")}><Download className="h-3.5 w-3.5"/>Export</button>
            <button style={btnPrimary} onClick={()=>navigate("/app/email")}><Mail className="h-3.5 w-3.5"/>Generate Emails</button>
            <button style={btnGhost} onClick={()=>toast.info("Re-running verification…")}><RefreshCw className="h-3.5 w-3.5"/>Re-verify</button>
            <button style={{...btnGhost,color:"#ef4444"}} onClick={()=>{toast.success("Removed");setSelectedIds([]);}}><Trash2 className="h-3.5 w-3.5"/>Remove</button>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-4" style={{gridTemplateColumns:"1fr 340px",alignItems:"start"}}>

        {/* Table */}
        <div className="overflow-hidden rounded-xl" style={{border:"1px solid rgba(255,255,255,0.07)"}}>
          {/* Header */}
          <div className="grid text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest px-4 py-3"
            style={{gridTemplateColumns:"28px 1fr 70px 70px 100px 90px 80px 60px",background:"#151a22",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <div><input type="checkbox" checked={selectedIds.length===filtered.length&&filtered.length>0} onChange={toggleAll} className="accent-blue-500"/></div>
            <div>Business</div><div>Score</div><div>Relevance</div><div>Stage</div><div>Contact</div><div>Saved</div><div>Actions</div>
          </div>

          {filtered.map((c,i) => (
            <div key={c.id}
              className="grid items-center px-4 py-3 cursor-pointer transition-colors"
              style={{
                gridTemplateColumns:"28px 1fr 70px 70px 100px 90px 80px 60px",
                borderBottom: i<filtered.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                background: activeClient.id===c.id ? "rgba(59,130,246,0.05)" : selectedIds.includes(c.id) ? "rgba(59,130,246,0.03)" : "#0f1218",
              }}
              onClick={()=>setActiveClient(c)}>
              <div onClick={e=>{e.stopPropagation();toggle(c.id);}}>
                <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={()=>toggle(c.id)} className="accent-blue-500"/>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#e8edf5]">{c.name}</div>
                <div className="text-[11px] text-[#5a6478] mt-0.5">{c.location} · {c.category}</div>
              </div>
              <div><ScoreRing score={c.verificationScore}/></div>
              <div className="text-[13px] font-bold" style={{color: c.relevanceScore>=75?"#10b981":"#f59e0b"}}>{c.relevanceScore}%</div>
              <div>{stageBadge(c.stage)}</div>
              <div className="text-[11px] text-[#5a6478]">{c.email?`✉ ${c.email.split("@")[0]}…`:"—"}</div>
              <div className="text-[11px] text-[#5a6478]">{new Date(c.savedDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</div>
              <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                <button onClick={()=>navigate("/app/email")}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-[#1c2230]"
                  style={{border:"1px solid rgba(255,255,255,0.07)",color:"#8a95a8"}}>✉️</button>
                <button onClick={()=>toast.info("Re-running verification…")}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-[#1c2230]"
                  style={{border:"1px solid rgba(255,255,255,0.07)",color:"#8a95a8"}}>⋯</button>
              </div>
            </div>
          ))}

          {filtered.length===0 && (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="text-3xl mb-2 opacity-40">👤</div>
              <div className="text-sm font-bold text-[#e8edf5]">No clients match</div>
              <div className="text-[12px] text-[#5a6478] mt-1">Try clearing the filter or search</div>
            </div>
          )}
        </div>

        {/* Verification Details Panel */}
        <div className="rounded-xl overflow-hidden sticky top-4" style={{border:"1px solid rgba(255,255,255,0.07)",background:"#0f1218"}}>
          {/* Panel header */}
          <div className="p-4 flex items-center gap-3" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{border:`2px solid ${ringColor}`,background:ringBg,color:ringColor,fontFamily:"Syne,sans-serif"}}>
              {activeClient.verificationScore}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[#e8edf5] truncate" style={{fontFamily:"Syne,sans-serif"}}>{activeClient.name}</div>
              <div className="text-[11px] text-[#5a6478] mt-0.5">Verification Report</div>
              <div className="mt-1">
                {activeClient.verificationStatus==="verified"
                  ? <Badge color="green">✓ Fully Verified</Badge>
                  : activeClient.verificationStatus==="partial"
                    ? <Badge color="amber">⚠ Partial</Badge>
                    : <Badge color="red">✗ Failed</Badge>}
              </div>
            </div>
          </div>

          {/* Trust Signals */}
          <div className="px-4 py-3">
            <div className="text-[10px] font-bold text-[#5a6478] uppercase tracking-widest mb-1">Trust Signals</div>
            <Signal label="Website Live"          value={activeClient.signals.websiteLive?"Active":"Down"}   ok={activeClient.signals.websiteLive} />
            <Signal label="SSL Certificate"       value={activeClient.signals.ssl?"Valid":"Invalid"}          ok={activeClient.signals.ssl} />
            <Signal label="Domain Age"            value={activeClient.signals.domainAge}                       ok={true} />
            <Signal label="Privacy Policy"        value={activeClient.signals.privacyPolicy?"Found":"Missing"} ok={activeClient.signals.privacyPolicy} />
            <Signal label="Terms & Conditions"    value={activeClient.signals.terms?"Found":"Missing"}         ok={activeClient.signals.terms} />
            <Signal label="Social Media"          value={`${activeClient.signals.socialProfiles} profiles`}    ok={activeClient.signals.socialProfiles>0} />
            <Signal label="Email Validity"        value={activeClient.signals.emailValid?"Deliverable":"Risky"} ok={activeClient.signals.emailValid} />
            <Signal label="Legal Registration"    value={activeClient.signals.legalReg?"Verified":"Unknown"}   ok={activeClient.signals.legalReg} />
            <div className="flex items-center gap-2 pt-2">
              <div className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
                style={{background: activeClient.signals.riskFlags==="None"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)"}}>⚠</div>
              <div className="flex-1 text-[12px] text-[#8a95a8]">Risk Flags</div>
              <div className="text-[12px] font-semibold" style={{color: activeClient.signals.riskFlags==="None"?"#10b981":"#ef4444"}}>
                {activeClient.signals.riskFlags}
              </div>
            </div>
          </div>

          {/* AI Relevance summary */}
          <div className="px-4 py-3" style={{borderTop:"1px solid rgba(255,255,255,0.07)"}}>
            <div className="text-[10px] font-bold text-[#5a6478] uppercase tracking-widest mb-2">AI Relevance</div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:"#1c2230"}}>
                <div className="h-full rounded-full" style={{width:`${activeClient.relevanceScore}%`,background:"#8b5cf6"}}/>
              </div>
              <span className="text-[12px] font-bold text-[#8b5cf6]">{activeClient.relevanceScore}%</span>
            </div>
            <div className="text-[11px] text-[#5a6478]">Strong B2B profile match. Verified export market presence.</div>
          </div>

          {/* Actions */}
          <div className="px-4 py-3 space-y-2" style={{borderTop:"1px solid rgba(255,255,255,0.07)"}}>
            <button style={{...btnPrimary,width:"100%",justifyContent:"center"}} onClick={()=>navigate("/app/email")}>
              <Mail className="h-3.5 w-3.5"/>Generate Outreach Email
            </button>
            <div className="flex gap-2">
              <button style={{...btnGhost,flex:1,justifyContent:"center"}} onClick={()=>toast.info("Re-running verification…")}>
                <RefreshCw className="h-3.5 w-3.5"/>Re-verify
              </button>
              <a href={`https://${activeClient.website}`} target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1 rounded-lg text-[12px] font-medium text-[#8a95a8] hover:text-[#e8edf5] transition-colors"
                style={{border:"1px solid rgba(255,255,255,0.1)",padding:"6px 12px"}}>
                <ExternalLink className="h-3.5 w-3.5"/>Website
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
