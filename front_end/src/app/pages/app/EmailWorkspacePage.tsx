import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Mail, Send, RefreshCw, Sparkles, Check, X, Edit2, Search, Upload, ChevronDown, ChevronUp, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 };
const btnPrimary: React.CSSProperties = { background: "var(--primary)", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };
const btnGhost: React.CSSProperties = { background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 5 };

const Badge = ({ children, color }: { children: React.ReactNode; color: "green"|"blue"|"amber"|"red"|"gray" }) => {
  const m = {green:["rgba(16,185,129,0.1)","var(--chart-2)"],blue:["rgba(59,130,246,0.15)","#60a5fa"],amber:["rgba(245,158,11,0.1)","var(--chart-3)"],red:["rgba(239,68,68,0.1)","var(--destructive)"],gray:["var(--border)","var(--muted-foreground)"]};
  const [bg,text]=m[color];
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{background:bg,color:text}}>{children}</span>;
};

type DraftStatus = "pending" | "generating" | "generated" | "approved" | "sent" | "failed";
type CampaignPhase = "select" | "generating" | "review" | "done";
type EmailTemplate = { id: string; name: string; content: string };

export default function EmailWorkspacePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);

  const [campaignClients, setCampaignClients] = useState<any[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [campaignDrafts, setCampaignDrafts] = useState<Record<string, { draftId: number; subject: string; body: string; status: DraftStatus }>>({});
  const [campaignPhase, setCampaignPhase] = useState<CampaignPhase>("select");
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<"all" | "not_sent" | "sent">("all");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [exporterProfileId, setExporterProfileId] = useState<number|null>(null)
  const [emailStats, setEmailStats] = useState<any>(null)
  const [scheduling, setScheduling] = useState(false)
  const [regenerateInstructions, setRegenerateInstructions] = useState("")
  const [campaignInstructions, setCampaignInstructions] = useState<Record<string, string>>({})
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  const [globalTemplateContext, setGlobalTemplateContext] = useState("")
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [singleApproved, setSingleApproved] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState("")
  const [draftTemplateMap, setDraftTemplateMap] = useState<Record<string, string>>({})

  const buildInstructions = (specific?: string): string => {
    const parts: string[] = [];
    if (specific?.trim()) parts.push(specific.trim());
    if (globalTemplateContext.trim()) {
      parts.push("--- TEMPLATE CONTEXT ---");
      parts.push(globalTemplateContext.trim());
    }
    return parts.join("\n\n");
  };

  const persistTemplates = (next: EmailTemplate[]) => {
    setTemplates(next);
    localStorage.setItem("email_templates", JSON.stringify(next));
  };

  const recordDraftTemplate = (draftId: number, templateName: string) => {
    setDraftTemplateMap(prev => {
      const next = { ...prev, [String(draftId)]: templateName };
      localStorage.setItem("draft_template_map", JSON.stringify(next));
      return next;
    });
  };

  const getTemplateForDraft = (draftId: number): string | null =>
    draftTemplateMap[String(draftId)] ?? null;

  const handleSaveTemplate = () => {
    const name = saveAsName.trim();
    if (!name) { toast.error("Enter a template name"); return; }
    const existing = templates.find(t => t.name === name);
    let next: EmailTemplate[];
    if (existing) {
      next = templates.map(t => t.name === name ? { ...t, content: globalTemplateContext } : t);
      toast.success(`Template "${name}" updated`);
    } else {
      const newT: EmailTemplate = { id: Date.now().toString(), name, content: globalTemplateContext };
      next = [...templates, newT];
      toast.success(`Template "${name}" saved`);
    }
    persistTemplates(next);
    setSelectedTemplate(next.find(t => t.name === name) || null);
    setShowSaveAs(false);
    setSaveAsName("");
  };

  const handleDeleteTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id);
    persistTemplates(templates.filter(t => t.id !== id));
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null);
      setGlobalTemplateContext("");
    }
    if (tpl) toast.success(`Template "${tpl.name}" deleted`);
  };

  const handleTxtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100_000) {
      toast.error("File too large. Maximum size is 100 KB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setGlobalTemplateContext(prev => prev ? `${prev}\n\n${text}` : text);
      setSelectedTemplate(null);
      toast.success(`Loaded "${file.name}" into context`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    api.clients()
      .then(c => {
        const withEmail = (c || []);
        setClients(withEmail);
        setCampaignClients(withEmail);
        if (withEmail.length > 0 && !selectedClient) {
          setSelectedClient(withEmail[0]);
        }
      })
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") })
      .finally(() => setLoading(false));
    api.getMyProfile().then(p => setExporterProfileId(p.id)).catch(()=>{})
    fetch("/api/v1/dashboard/stats", { headers: { Authorization: `Bearer ${localStorage.getItem("cf_token")}` } })
      .then(r => r.json())
      .then(data => setEmailStats(data))
      .catch(() => {})
    try {
      const savedTemplates = JSON.parse(localStorage.getItem("email_templates") || "[]");
      setTemplates(savedTemplates);
    } catch { /* ignore corrupt storage */ }
    try {
      const savedMap = JSON.parse(localStorage.getItem("draft_template_map") || "{}");
      setDraftTemplateMap(savedMap);
    } catch { /* ignore corrupt storage */ }
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const clientIds = searchParams.get("clientIds");
    if (tab) setActiveTab(tab);
    if (clientIds) {
      const ids = clientIds.split(",").map(id => String(id.trim()));
      setSelectedClientIds(ids);
    }
  }, [searchParams]);

  const handleGenerate = async () => {
    if (!exporterProfileId) {
      toast.error("Set up your exporter profile in Settings first")
      return
    }
    if (!user || !selectedClient) return;
    setGenerating(true);
    setSingleApproved(false);
    const toastId = toast.loading("Generating personalised email…");
    try {
      const targetId = selectedClient.result_id || selectedClient.id || selectedClient.business_id;
      const result = await api.generateEmail(targetId, user.user_id, exporterProfileId, buildInstructions());

      if (result.draft_id) {
        setCurrentDraftId(result.draft_id);
        recordDraftTemplate(result.draft_id, selectedTemplate?.name || (globalTemplateContext.trim() ? "Custom" : "None"));
        const draft = await api.emailDraftDetail(result.draft_id);
        const draftData = Array.isArray(draft) ? draft[0] : draft;
        setSubject(draftData?.subject || "");
        setBody(draftData?.body || "");
        toast.success("Email draft generated!", { id: toastId });
      } else if (result.skip_code === "draft_already_sent" || result.status === "skipped") {
        const drafts = await api.emailDrafts(targetId);
        const summary = Array.isArray(drafts) ? drafts[0] : drafts;
        
        if (summary?.id) {
          const detail = await api.emailDraftDetail(summary.id);
          const draftData = Array.isArray(detail) ? detail[0] : detail;
          
          setCurrentDraftId(summary.id);
          setSubject(draftData?.subject || "");
          setBody(draftData?.body || "");
          toast.success("Loaded existing draft", { id: toastId });
        } else {
          toast.error("Draft already sent and no existing draft found", { id: toastId });
        }
      } else {
        toast.info(result.reason || result.message || "Generation skipped", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Generation failed", { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async (instructions?: string) => {
    if (!exporterProfileId) {
      toast.error("Set up your exporter profile in Settings first")
      return
    }
    if (!user || !selectedClient) return;
    setGenerating(true);
    setSingleApproved(false);
    const toastId = toast.loading("Regenerating email…");
    try {
      if (currentDraftId) {
        await api.deleteDraft(currentDraftId);
      }
      const targetId = selectedClient.result_id || selectedClient.id || selectedClient.business_id;
      const result = await api.generateEmail(targetId, user.user_id, exporterProfileId, buildInstructions(instructions));

      if (result.draft_id) {
        setCurrentDraftId(result.draft_id);
        recordDraftTemplate(result.draft_id, selectedTemplate?.name || (globalTemplateContext.trim() ? "Custom" : "None"));
        const draft = await api.emailDraftDetail(result.draft_id);
        const draftData = Array.isArray(draft) ? draft[0] : draft;
        setSubject(draftData?.subject || "");
        setBody(draftData?.body || "");
        toast.success("Email draft regenerated!", { id: toastId });
      } else {
        toast.info(result.reason || result.message || "Generation skipped", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Regeneration failed", { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!currentDraftId) { 
      toast.error("Generate an email first"); 
      return; 
    }
    try {
      await api.approveDraft(currentDraftId);
      await api.sendDraft(currentDraftId);
      toast.success(`Email sent to ${selectedClient.business_name}!`);
      setSubject(""); 
      setBody(""); 
      setCurrentDraftId(null);
    } catch (err: any) {
      toast.error(err.message || "Send failed");
    }
  };

  const statusBadge = (s: string) => {
    if (s==="sent")    return <Badge color="blue">Sent</Badge>;
    if (s==="opened")  return <Badge color="green">Opened</Badge>;
    if (s==="replied") return <Badge color="green">Replied</Badge>;
    if (s==="bounced") return <Badge color="red">Bounced</Badge>;
    return <Badge color="gray">Pending</Badge>;
  };

  const renderContextPanel = () => (
    <div style={{ ...card, overflow: "hidden" }}>
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        style={{ borderBottom: showContextPanel ? "1px solid var(--border)" : "none", background: "transparent" }}
        onClick={() => setShowContextPanel(v => !v)}
      >
        <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
          <FileText className="h-3.5 w-3.5 text-blue-400" />
          AI Context & Template
          {selectedTemplate && (
            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
              {selectedTemplate.name}
            </span>
          )}
          {!selectedTemplate && globalTemplateContext.trim() && (
            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(245,158,11,0.15)", color: "var(--chart-3)" }}>
              Custom ({globalTemplateContext.length} chars)
            </span>
          )}
        </div>
        {showContextPanel ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {showContextPanel && (
        <div className="p-4 space-y-3">
          {/* Saved template selector */}
          {templates.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">
                Saved Templates
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedTemplate?.id || ""}
                  onChange={e => {
                    const t = templates.find(t => t.id === e.target.value) || null;
                    setSelectedTemplate(t);
                    setGlobalTemplateContext(t?.content || "");
                  }}
                  className="flex-1 rounded-lg px-3 py-2 text-[12px] text-foreground outline-none"
                  style={{ background: "#0a0d12", border: "1px solid var(--border)" }}
                >
                  <option value="">— Select a saved template —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selectedTemplate && (
                  <button
                    style={{ ...btnGhost, color: "var(--destructive)", padding: "7px 10px" }}
                    onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                    title="Delete this template"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Template content textarea */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">
              Template Content {selectedTemplate && <span style={{ color: "#60a5fa" }}>· {selectedTemplate.name}</span>}
            </label>
            <textarea
              value={globalTemplateContext}
              onChange={e => {
                setGlobalTemplateContext(e.target.value);
                if (selectedTemplate && e.target.value !== selectedTemplate.content) {
                  setSelectedTemplate(null);
                }
              }}
              placeholder="Paste your email template, brand guidelines, product info, or any instructions the AI should follow when writing emails…"
              className="w-full rounded-lg px-3 py-2 text-[12px] text-foreground outline-none resize-none"
              style={{ background: "#0a0d12", border: "1px solid var(--border)", minHeight: 120, lineHeight: 1.6 }}
            />
            {globalTemplateContext && (
              <div className="text-[10px] text-muted-foreground mt-1 text-right">{globalTemplateContext.length} chars</div>
            )}
          </div>

          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer"
              style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}
            >
              <Upload className="h-3.5 w-3.5" />Upload .txt
              <input type="file" accept=".txt" className="hidden" onChange={handleTxtUpload} />
            </label>
            {globalTemplateContext.trim() && !showSaveAs && (
              <button
                style={{ ...btnGhost, color: "var(--chart-2)", border: "1px solid rgba(16,185,129,0.3)" }}
                onClick={() => { setSaveAsName(selectedTemplate?.name || ""); setShowSaveAs(true); }}
              >
                <Save className="h-3.5 w-3.5" />Save as Template
              </button>
            )}
            {globalTemplateContext.trim() && (
              <button
                style={btnGhost}
                onClick={() => { setGlobalTemplateContext(""); setSelectedTemplate(null); }}
              >
                <X className="h-3 w-3" />Clear
              </button>
            )}
          </div>

          {/* Save-as name input */}
          {showSaveAs && (
            <div className="flex gap-2">
              <input
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                placeholder="Template name…"
                className="flex-1 rounded-lg px-3 py-2 text-[12px] text-foreground outline-none"
                style={{ background: "#0a0d12", border: "1px solid var(--border)" }}
                onKeyDown={e => e.key === "Enter" && handleSaveTemplate()}
                autoFocus
              />
              <button style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12 }} onClick={handleSaveTemplate}>Save</button>
              <button style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }} onClick={() => { setShowSaveAs(false); setSaveAsName(""); }}>Cancel</button>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            This context is combined with all gathered client data and sent to the AI. Saved templates persist across sessions and are available in all tabs.
          </div>
        </div>
      )}
    </div>
  );

  const renderDashboard = () => {
    const stats = {
      contacted: clients.filter(c => c.outreach_status && c.outreach_status !== "pending").length,
      sent: emailStats?.emails_sent ?? 0,
      opened: emailStats?.emails_opened ?? 0,
      replied: emailStats?.emails_replied ?? 0,
      bounced: clients.filter(c => c.outreach_status === "bounced").length,
    };

    return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label:"Total Contacted", value: stats.contacted.toString(), color:"var(--primary)" },
          { label:"Sent",            value: String(stats.sent ?? 0), color:"var(--chart-2)" },
          { label:"Opened",          value: `${String(stats.opened ?? 0)} (${emailStats?.emails_sent && emailStats.emails_sent > 0 ? Math.round((stats.opened / emailStats.emails_sent) * 100) : 0}%)`, color:"#8b5cf6" },
          { label:"Replied",         value: `${String(stats.replied ?? 0)} (${emailStats?.emails_sent && emailStats.emails_sent > 0 ? Math.round((stats.replied / emailStats.emails_sent) * 100) : 0}%)`, color:"var(--chart-2)" },
          { label:"Bounced",         value: stats.bounced.toString(), color:"var(--destructive)" },
        ].map((s,i) => (
          <div key={i} style={card} className="p-4">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{s.label}</div>
            <div className="text-2xl font-bold text-foreground" style={{fontFamily:"Syne,sans-serif"}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3" style={{borderBottom:"1px solid var(--border)"}}>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">All Clients</div>
        </div>

        {clients.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center">
            <Mail className="h-12 w-12 text-muted-foreground mb-3 opacity-40" />
            <div className="text-sm font-bold text-foreground">No clients with emails</div>
            <div className="text-[12px] text-muted-foreground mt-1">Find clients first to start sending emails</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest" style={{background:"#0a0d12"}}>
                  <th className="text-left px-4 py-3">Business Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Email Status</th>
                  <th className="text-left px-4 py-3">Last Contacted</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.result_id} style={{borderBottom: i<clients.length-1 ? "1px solid var(--border)" : "none"}}>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-foreground">{c.business_name || "Unknown"}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{c.business_type || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {c.email_found ? c.email_found : <Badge color="gray">No email</Badge>}
                    </td>
                    <td className="px-4 py-3">{statusBadge(c.outreach_status || "pending")}</td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {c.processed_at ? new Date(c.processed_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        style={{...btnGhost,padding:"5px 10px"}} 
                        onClick={() => {
                          setSelectedClient(c);
                          setActiveTab("single");
                        }}
                      >
                        <Mail className="h-3 w-3"/>Draft
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
  };

  const renderCampaign = () => {
    if (campaignPhase === "select") {
      const filteredCampaignClients = campaignClients.filter(c => {
        const matchSearch = (c.business_name || "").toLowerCase().includes(campaignSearchQuery.toLowerCase());
        if (campaignFilter === "not_sent") {
          return matchSearch && (!c.outreach_status || c.outreach_status === "pending");
        }
        if (campaignFilter === "sent") {
          return matchSearch && (c.outreach_status === "sent" || c.outreach_status === "opened" || c.outreach_status === "replied");
        }
        return matchSearch;
      });

      const allSelected = filteredCampaignClients.length > 0 && selectedClientIds.length === filteredCampaignClients.length;

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search clients…"
                value={campaignSearchQuery}
                onChange={e => setCampaignSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] text-foreground outline-none"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
              />
            </div>
            <div className="flex gap-2">
              {["all", "not_sent", "sent"].map(f => (
                <button
                  key={f}
                  onClick={() => setCampaignFilter(f as any)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={campaignFilter === f
                    ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }
                    : { background: "transparent", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                >
                  {f === "all" ? "All" : f === "not_sent" ? "Not Sent" : "Sent"}
                </button>
              ))}
            </div>
          </div>

          {renderContextPanel()}

          <div style={card} className="overflow-hidden">
            <div className="px-4 py-3 flex items-center" style={{ borderBottom: "1px solid var(--border)" }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  if (allSelected) {
                    setSelectedClientIds([]);
                  } else {
                    setSelectedClientIds(filteredCampaignClients.map(c => String(c.result_id || c.id)));
                  }
                }}
                className="accent-blue-500"
              />
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-3">Select All</div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {filteredCampaignClients.map((c, i) => (
                <div
                  key={c.result_id}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[var(--border)]"
                  style={{ borderBottom: i < filteredCampaignClients.length - 1 ? "1px solid var(--border)" : "none" }}
                  onClick={() => {
                    if (selectedClientIds.includes(String(c.result_id || c.id))) {
                      setSelectedClientIds(selectedClientIds.filter(id => id !== String(c.result_id || c.id)));
                    } else {
                      setSelectedClientIds([...selectedClientIds, String(c.result_id || c.id)]);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedClientIds.includes(String(c.result_id || c.id))}
                    onChange={() => { }}
                    className="accent-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-foreground">{c.business_name || "Unknown"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {c.email_found ? c.email_found : <Badge color="gray">No email</Badge>}
                    </div>
                  </div>
                  <div>{statusBadge(c.outreach_status || "pending")}</div>
                </div>
              ))}
            </div>
          </div>

          {selectedClientIds.length > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <div className="text-sm font-semibold text-blue-400">{selectedClientIds.length} clients selected</div>
              <button
                style={btnPrimary}
                onClick={async () => {
                  if (!user) { toast.error("Not logged in"); return; }
                  setCampaignPhase("generating");
                  const drafts: Record<string, { draftId: number; subject: string; body: string; status: DraftStatus }> = {};
                  for (const id of selectedClientIds) {
                    drafts[id] = { draftId: 0, subject: "", body: "", status: "pending" };
                  }
                  setCampaignDrafts(drafts);

                  for (const id of selectedClientIds) {
                    setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "generating" } }));
                    try {
                      const result = await api.generateEmail(Number(id), user.user_id, exporterProfileId!, buildInstructions());
                      
                      let draftId = result.draft_id;
                      let subject = "";
                      let body = "";
                      
                      if (draftId) {
                        const draft = await api.emailDraftDetail(draftId);
                        const draftData = Array.isArray(draft) ? draft[0] : draft;
                        subject = draftData?.subject || "";
                        body = draftData?.body || "";
                      } else if (result.skip_code === "draft_already_sent" || result.status === "skipped") {
                        const drafts = await api.emailDrafts(Number(id));
                        const summary = Array.isArray(drafts) ? drafts[0] : drafts;
                        if (summary?.id) {
                          const detail = await api.emailDraftDetail(summary.id);
                          const draftData = Array.isArray(detail) ? detail[0] : detail;
                          
                          draftId = summary.id;
                          subject = draftData?.subject || "";
                          body = draftData?.body || "";
                        }
                      }
                      
                      if (draftId) {
                        recordDraftTemplate(draftId, selectedTemplate?.name || (globalTemplateContext.trim() ? "Custom" : "None"));
                        setCampaignDrafts(prev => ({
                          ...prev,
                          [id]: { draftId, subject, body, status: "generated" }
                        }));
                      } else {
                        setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "failed" } }));
                      }
                    } catch (err) {
                      setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "failed" } }));
                    }
                  }

                  setCampaignPhase("review");
                }}
              >
                Generate Emails
              </button>
            </div>
          )}
        </div>
      );
    }

    if (campaignPhase === "generating") {
      const totalCount = selectedClientIds.length;
      const completedCount = Object.values(campaignDrafts).filter(d => d.status === "generated" || d.status === "failed").length;
      const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

      return (
        <div className="space-y-4">
          <div style={card} className="p-5">
            <div className="text-sm font-bold text-foreground mb-2" style={{ fontFamily: "Syne,sans-serif" }}>
              Generating emails… {completedCount} of {totalCount} complete
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--primary)" }} />
            </div>
          </div>

          <div style={card} className="overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              {selectedClientIds.map((id, i) => {
                const client = campaignClients.find(c => String(c.result_id || c.id) === id);
                const draft = campaignDrafts[id];
                return (
                  <div
                    key={id}
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ borderBottom: i < selectedClientIds.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      {draft?.status === "pending" && <div className="w-3 h-3 rounded-full bg-[#5a6478] opacity-50" />}
                      {draft?.status === "generating" && <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />}
                      {draft?.status === "generated" && <Check className="h-4 w-4 text-green-500" />}
                      {draft?.status === "failed" && <X className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-foreground">{client?.business_name || "Unknown"}</div>
                      {draft?.status === "generating" && <div className="text-[11px] text-muted-foreground mt-0.5">Generating…</div>}
                      {draft?.status === "generated" && <div className="text-[11px] text-muted-foreground mt-0.5">{draft.subject}</div>}
                      {draft?.status === "failed" && <div className="text-[11px] text-red-500 mt-0.5">Failed</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (campaignPhase === "review") {
      const approvedCount = Object.values(campaignDrafts).filter(d => d.status === "approved").length;
      const totalCount = Object.keys(campaignDrafts).length;

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <div className="text-sm font-semibold text-blue-400">{approvedCount} of {totalCount} approved</div>
            <div className="flex gap-2">
              {selectedDraftIds.length > 0 && (
                <button
                  style={btnGhost}
                  onClick={async () => {
                    const toApprove = selectedDraftIds.filter(id => campaignDrafts[id]?.status === "generated");
                    if (toApprove.length === 0) return;
                    try {
                      await Promise.all(toApprove.map(id => api.approveDraft(campaignDrafts[id].draftId)));
                      setCampaignDrafts(prev => {
                        const next = { ...prev };
                        for (const id of toApprove) next[id] = { ...next[id], status: "approved" };
                        return next;
                      });
                      setSelectedDraftIds([]);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to approve selected drafts");
                    }
                  }}
                >
                  Approve Selected ({selectedDraftIds.length})
                </button>
              )}
              <button
                style={btnGhost}
                onClick={async () => {
                  const toApprove = Object.entries(campaignDrafts)
                    .filter(([, d]) => d.status === "generated")
                    .map(([id]) => id);
                  if (toApprove.length === 0) return;
                  try {
                    await Promise.all(toApprove.map(id => api.approveDraft(campaignDrafts[id].draftId)));
                    setCampaignDrafts(prev => {
                      const next = { ...prev };
                      for (const id of toApprove) next[id] = { ...next[id], status: "approved" };
                      return next;
                    });
                  } catch (err: any) {
                    toast.error(err.message || "Failed to approve all drafts");
                  }
                }}
              >
                Approve All
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {Object.keys(campaignDrafts).map(id => {
              const client = campaignClients.find(c => String(c.result_id || c.id) === id);
              const draft = campaignDrafts[id];
              const isEditing = editingDraftId === id;
              const isApproved = draft.status === "approved";

              return (
                <div
                  key={id}
                  style={{
                    ...card,
                    border: isApproved ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border)",
                    background: isApproved ? "rgba(16,185,129,0.05)" : "var(--card)"
                  }}
                  className="p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {!isApproved && (
                        <input
                          type="checkbox"
                          checked={selectedDraftIds.includes(id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (selectedDraftIds.includes(id)) {
                              setSelectedDraftIds(selectedDraftIds.filter(did => did !== id));
                            } else {
                              setSelectedDraftIds([...selectedDraftIds, id]);
                            }
                          }}
                          className="accent-blue-500"
                        />
                      )}
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">{client?.business_name || "Unknown"}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {client?.email_found ? client.email_found : <Badge color="gray">No email</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isApproved && <Badge color="green">Approved</Badge>}
                      {draft.draftId && getTemplateForDraft(draft.draftId) && getTemplateForDraft(draft.draftId) !== "None" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                          {getTemplateForDraft(draft.draftId)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editSubject}
                        onChange={e => setEditSubject(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-[13px] text-foreground outline-none"
                        style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
                      />
                      <textarea
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-[13px] text-foreground outline-none resize-none"
                        style={{ background: "var(--muted)", border: "1px solid var(--border)", minHeight: 120 }}
                      />
                      <div className="flex gap-2">
                        <button
                          style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }}
                          onClick={async () => {
                            try {
                              await api.updateDraft(draft.draftId, { subject: editSubject, body: editBody });
                              setCampaignDrafts(prev => ({
                                ...prev,
                                [id]: { ...prev[id], subject: editSubject, body: editBody }
                              }));
                              setEditingDraftId(null);
                              toast.success("Draft saved");
                            } catch (err: any) {
                              toast.error(err.message || "Failed to save draft");
                            }
                          }}
                        >
                          <Save className="h-3 w-3" />Save
                        </button>
                        <button
                          style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}
                          onClick={() => setEditingDraftId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-[13px] font-semibold text-foreground mb-1">{draft.subject}</div>
                      <div className="text-[12px] text-muted-foreground mb-3">
                        {draft.body.substring(0, 100)}…
                      </div>
                      <input
                        placeholder="Optional instructions for regeneration…"
                        value={campaignInstructions[id] || ""}
                        onChange={e => setCampaignInstructions(prev => ({ ...prev, [id]: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-[12px] text-foreground outline-none mb-2"
                        style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
                      />
                      <div className="flex gap-2">
                        {!isApproved && (
                          <button
                            style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }}
                            onClick={async () => {
                              try {
                                await api.approveDraft(draft.draftId);
                                setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "approved" } }));
                              } catch (err: any) {
                                toast.error(err.message || "Failed to approve draft");
                              }
                            }}
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </button>
                        )}
                        {isApproved && (
                          <button
                            style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}
                            onClick={() => {
                              setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "generated" } }));
                            }}
                          >
                            <X className="h-3 w-3" />
                            Unapprove
                          </button>
                        )}
                        <button
                          style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}
                          onClick={async () => {
                            if (!user) return;
                            setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "generating" } }));
                            try {
                              await api.deleteDraft(draft.draftId);
                              const result = await api.generateEmail(Number(id), user.user_id, exporterProfileId!, buildInstructions(campaignInstructions[id]));
                              
                              let draftId = result.draft_id;
                              let subject = "";
                              let body = "";
                              
                              if (draftId) {
                                const draftDetail = await api.emailDraftDetail(draftId);
                                const draftData = Array.isArray(draftDetail) ? draftDetail[0] : draftDetail;
                                subject = draftData?.subject || "";
                                body = draftData?.body || "";
                              }
                              
                              if (draftId) {
                                recordDraftTemplate(draftId, selectedTemplate?.name || (globalTemplateContext.trim() ? "Custom" : "None"));
                                setCampaignDrafts(prev => ({
                                  ...prev,
                                  [id]: { draftId, subject, body, status: "generated" }
                                }));
                                toast.success("Draft regenerated");
                              } else {
                                setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "failed" } }));
                                toast.error("Regeneration failed");
                              }
                            } catch (err: any) {
                              setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "failed" } }));
                              toast.error(err.message || "Regeneration failed");
                            }
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Regenerate
                        </button>
                        <button
                          style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}
                          onClick={() => {
                            setEditingDraftId(id);
                            setEditSubject(draft.subject);
                            setEditBody(draft.body);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {approvedCount > 0 && (
            <div className="flex items-center justify-end p-4 rounded-lg" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <button
                style={{ ...btnPrimary, opacity: 0.5, cursor: "not-allowed" }}
                disabled
                onClick={() => toast.info("Email sending is coming soon.")}
              >
                <Send className="h-3.5 w-3.5" />
                Send Approved ({approvedCount})
              </button>
            </div>
          )}
        </div>
      );
    }

    if (campaignPhase === "done") {
      const sentCount = Object.values(campaignDrafts).filter(d => d.status === "sent").length;
      return (
        <div style={card} className="p-24 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <div className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "Syne,sans-serif" }}>
              {sentCount} emails sent successfully
            </div>
            <button
              style={btnPrimary}
              onClick={() => {
                setCampaignPhase("select");
                setSelectedClientIds([]);
                setCampaignDrafts({});
                setCampaignSearchQuery("");
                setCampaignFilter("all");
              }}
            >
              Start New Campaign
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderSingleSend = () => (
    <div className="grid gap-4" style={{gridTemplateColumns:"280px 1fr"}}>
      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between" style={{borderBottom:"1px solid var(--border)"}}>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Select Client</div>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {clients.map((c,i) => (
            <div key={c.result_id}
              className="px-3 py-3 cursor-pointer transition-colors"
              style={{
                borderBottom: i<clients.length-1?"1px solid var(--border)":"none",
                background: selectedClient?.result_id===c.result_id ? "rgba(59,130,246,0.06)" : "transparent",
              }}
              onClick={()=>setSelectedClient(c)}>
              <div className="text-[13px] font-semibold text-foreground truncate">{c.business_name || "Unknown"}</div>
              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                {c.email_found ? c.email_found : <Badge color="gray">No email</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card} className="flex flex-col">
        <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:"1px solid var(--border)"}}>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-foreground" style={{fontFamily:"Syne,sans-serif"}}>Draft Email</div>
              {currentDraftId && getTemplateForDraft(currentDraftId) && getTemplateForDraft(currentDraftId) !== "None" && (
                <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                  {getTemplateForDraft(currentDraftId)}
                </span>
              )}
              {singleApproved && <Badge color="green">Approved</Badge>}
            </div>
            {selectedClient && (
              <div className="text-[11px] text-muted-foreground mt-0.5">To: {selectedClient.business_name} &lt;{selectedClient.email_found}&gt;</div>
            )}
          </div>
          <div className="flex gap-2">
            <button style={btnGhost} onClick={handleGenerate} disabled={generating || !selectedClient}>
              {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin"/> : <Sparkles className="h-3.5 w-3.5"/>}
              {generating ? "Generating…" : "AI Generate"}
            </button>
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Subject</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Email subject line…"
              className="w-full rounded-lg px-3 py-2 text-[13px] text-foreground outline-none"
              style={{background:"var(--muted)",border:"1px solid var(--border)"}} />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Body</label>
            <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write or generate your email body…"
              className="flex-1 w-full rounded-lg px-3 py-2.5 text-[13px] text-foreground outline-none resize-none"
              style={{background:"var(--muted)",border:"1px solid var(--border)",minHeight:240,lineHeight:1.7}} />
            {body && <div className="text-[11px] text-muted-foreground mt-1 text-right">{body.length} chars</div>}
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Regenerate Instructions (Optional)</label>
            <input
              value={regenerateInstructions}
              onChange={e => setRegenerateInstructions(e.target.value)}
              placeholder="e.g. Make it more formal, add pricing details…"
              className="w-full rounded-lg px-3 py-2 text-[13px] text-foreground outline-none"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            />
          </div>

          {renderContextPanel()}

          <div className="flex flex-wrap gap-2 pt-1">
            {currentDraftId && (
              <button
                style={{ ...btnPrimary, padding: "8px 16px", ...(singleApproved ? { background: "rgba(16,185,129,0.15)", color: "var(--chart-2)", border: "1px solid rgba(16,185,129,0.3)" } : {}) }}
                disabled={singleApproved}
                onClick={async () => {
                  if (!currentDraftId) return;
                  try {
                    await api.approveDraft(currentDraftId);
                    setSingleApproved(true);
                    toast.success("Draft approved");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to approve draft");
                  }
                }}
              >
                <Check className="h-3.5 w-3.5" />
                {singleApproved ? "Approved" : "Approve"}
              </button>
            )}
            {currentDraftId && (
              <button
                style={btnGhost}
                onClick={async () => {
                  try {
                    await api.updateDraft(currentDraftId, { subject, body });
                    toast.success("Draft saved");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to save draft");
                  }
                }}
                disabled={!subject && !body}
              >
                <Save className="h-3.5 w-3.5" />Save
              </button>
            )}
            <button
              style={{ ...btnPrimary, opacity: 0.5, cursor: "not-allowed" }}
              disabled
              onClick={() => toast.info("Email sending is coming soon.")}
            >
              <Send className="h-3.5 w-3.5"/>Send
            </button>
            <button style={btnGhost} onClick={() => handleRegenerate(regenerateInstructions)} disabled={generating || !selectedClient}>
              <RefreshCw className="h-3.5 w-3.5"/>Regenerate
            </button>
            <button style={{...btnGhost,marginLeft:"auto",color:"var(--destructive)"}} onClick={()=>{setSubject("");setBody("");setCurrentDraftId(null);setRegenerateInstructions("");setSingleApproved(false);}}>Discard</button>
          </div>

          <button
            disabled={scheduling}
            onClick={async () => {
              setScheduling(true)
              try {
                toast.success("Follow-up scheduled for 3 days")
              } catch { toast.error("Could not schedule follow-up") }
              finally { setScheduling(false) }
            }}
            className="mt-2 px-4 py-2 text-sm rounded border border-gray-300 
                       text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            {scheduling ? "Scheduling..." : "Schedule Follow-up in 3 days"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5 page-enter">
      <div className="flex gap-2 mb-1">
        {[
          { key:"dashboard", label:"Dashboard" },
          { key:"campaign",  label:"Campaign" },
          { key:"single",    label:"Single Send" },
        ].map(t => (
          <button key={t.key} onClick={()=>setActiveTab(t.key)}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
            style={activeTab===t.key
              ? {background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",color:"#60a5fa"}
              : {background:"transparent",border:"1px solid var(--border)",color:"var(--muted-foreground)"}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={card} className="p-12 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "campaign" && renderCampaign()}
          {activeTab === "single" && renderSingleSend()}
        </>
      )}
    </div>
  );
}