import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Mail, Send, RefreshCw, Eye, Sparkles, Check, X, Edit2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";

const card: React.CSSProperties = { background: "#0f1218", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 };
const btnPrimary: React.CSSProperties = { background: "#3b82f6", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };
const btnGhost: React.CSSProperties = { background: "transparent", color: "#8a95a8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 5 };

const Badge = ({ children, color }: { children: React.ReactNode; color: "green"|"blue"|"amber"|"red"|"gray" }) => {
  const m = {green:["rgba(16,185,129,0.1)","#10b981"],blue:["rgba(59,130,246,0.15)","#60a5fa"],amber:["rgba(245,158,11,0.1)","#f59e0b"],red:["rgba(239,68,68,0.1)","#ef4444"],gray:["rgba(255,255,255,0.05)","#8a95a8"]};
  const [bg,text]=m[color];
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{background:bg,color:text}}>{children}</span>;
};

type DraftStatus = "pending" | "generating" | "generated" | "approved" | "sent" | "failed";
type CampaignPhase = "select" | "generating" | "review" | "done";

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
      .catch(console.error)
      .finally(() => setLoading(false));
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
    if (!user || !selectedClient) return;
    setGenerating(true);
    const toastId = toast.loading("Generating personalised email…");
    try {
      const targetId = selectedClient.result_id || selectedClient.id || selectedClient.business_id;
      const result = await api.generateEmail(targetId, user.user_id);
      console.log("Single Send generateEmail result:", result);

      if (result.draft_id) {
        setCurrentDraftId(result.draft_id);
        const draft = await api.emailDraftDetail(result.draft_id);
        console.log("Single Send emailDraftDetail result:", draft);
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
      console.error("Single Send generateEmail error caught:", err);
      toast.error(err.message || "Generation failed", { id: toastId });
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

  const renderDashboard = () => {
    const stats = {
      contacted: clients.filter(c => c.outreach_status && c.outreach_status !== "pending").length,
      sent: clients.filter(c => c.outreach_status === "sent").length,
      opened: clients.filter(c => c.outreach_status === "opened").length,
      replied: clients.filter(c => c.outreach_status === "replied").length,
      bounced: clients.filter(c => c.outreach_status === "bounced").length,
    };

    return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label:"Total Contacted", value: stats.contacted.toString(), color:"#3b82f6" },
          { label:"Sent",            value: stats.sent.toString(), color:"#10b981" },
          { label:"Opened",          value: stats.opened.toString(), color:"#8b5cf6" },
          { label:"Replied",         value: stats.replied.toString(), color:"#10b981" },
          { label:"Bounced",         value: stats.bounced.toString(), color:"#ef4444" },
        ].map((s,i) => (
          <div key={i} style={card} className="p-4">
            <div className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest mb-2">{s.label}</div>
            <div className="text-2xl font-bold text-[#e8edf5]" style={{fontFamily:"Syne,sans-serif"}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={card} className="overflow-hidden">
        <div className="px-4 py-3" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="text-[11px] font-bold text-[#5a6478] uppercase tracking-widest">All Clients</div>
        </div>

        {clients.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center">
            <Mail className="h-12 w-12 text-[#5a6478] mb-3 opacity-40" />
            <div className="text-sm font-bold text-[#e8edf5]">No clients with emails</div>
            <div className="text-[12px] text-[#5a6478] mt-1">Find clients first to start sending emails</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest" style={{background:"#0a0d12"}}>
                  <th className="text-left px-4 py-3">Business Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Email Status</th>
                  <th className="text-left px-4 py-3">Last Contacted</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.result_id} style={{borderBottom: i<clients.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none"}}>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[#e8edf5]">{c.business_name || "Unknown"}</div>
                      <div className="text-[11px] text-[#5a6478] mt-0.5">{c.business_type || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#8a95a8]">
                      {c.email_found ? c.email_found : <Badge color="gray">No email</Badge>}
                    </td>
                    <td className="px-4 py-3">{statusBadge(c.outreach_status || "pending")}</td>
                    <td className="px-4 py-3 text-[12px] text-[#8a95a8]">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a6478]" />
              <input
                placeholder="Search clients…"
                value={campaignSearchQuery}
                onChange={e => setCampaignSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] text-[#e8edf5] outline-none"
                style={{ background: "#151a22", border: "1px solid rgba(255,255,255,0.09)" }}
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
                    : { background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "#8a95a8" }}
                >
                  {f === "all" ? "All" : f === "not_sent" ? "Not Sent" : "Sent"}
                </button>
              ))}
            </div>
          </div>

          <div style={card} className="overflow-hidden">
            <div className="px-4 py-3 flex items-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
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
              <div className="text-[11px] font-bold text-[#5a6478] uppercase tracking-widest ml-3">Select All</div>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {filteredCampaignClients.map((c, i) => (
                <div
                  key={c.result_id}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[rgba(255,255,255,0.02)]"
                  style={{ borderBottom: i < filteredCampaignClients.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
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
                    <div className="text-[13px] font-semibold text-[#e8edf5]">{c.business_name || "Unknown"}</div>
                    <div className="text-[11px] text-[#5a6478] mt-0.5">
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
                      const result = await api.generateEmail(Number(id), user.user_id);
                      console.log(`Campaign generateEmail result for id ${id}:`, result);
                      
                      let draftId = result.draft_id;
                      let subject = "";
                      let body = "";
                      
                      if (draftId) {
                        const draft = await api.emailDraftDetail(draftId);
                        console.log(`Campaign emailDraftDetail result for id ${id}:`, draft);
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
                        setCampaignDrafts(prev => ({
                          ...prev,
                          [id]: { draftId, subject, body, status: "generated" }
                        }));
                      } else {
                        setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "failed" } }));
                      }
                    } catch (err) {
                      console.error(`Campaign generateEmail error caught for id ${id}:`, err);
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
            <div className="text-sm font-bold text-[#e8edf5] mb-2" style={{ fontFamily: "Syne,sans-serif" }}>
              Generating emails… {completedCount} of {totalCount} complete
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#151a22" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "#3b82f6" }} />
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
                    style={{ borderBottom: i < selectedClientIds.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      {draft?.status === "pending" && <div className="w-3 h-3 rounded-full bg-[#5a6478] opacity-50" />}
                      {draft?.status === "generating" && <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />}
                      {draft?.status === "generated" && <Check className="h-4 w-4 text-green-500" />}
                      {draft?.status === "failed" && <X className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[#e8edf5]">{client?.business_name || "Unknown"}</div>
                      {draft?.status === "generating" && <div className="text-[11px] text-[#5a6478] mt-0.5">Generating…</div>}
                      {draft?.status === "generated" && <div className="text-[11px] text-[#5a6478] mt-0.5">{draft.subject}</div>}
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
            <button
              style={btnGhost}
              onClick={() => {
                const newDrafts = { ...campaignDrafts };
                for (const id in newDrafts) {
                  if (newDrafts[id].status === "generated") {
                    newDrafts[id].status = "approved";
                  }
                }
                setCampaignDrafts(newDrafts);
              }}
            >
              Approve All
            </button>
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
                    border: isApproved ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.07)",
                    background: isApproved ? "rgba(16,185,129,0.05)" : "#0f1218"
                  }}
                  className="p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#e8edf5]">{client?.business_name || "Unknown"}</div>
                      <div className="text-[11px] text-[#5a6478] mt-0.5">
                        {client?.email_found ? client.email_found : <Badge color="gray">No email</Badge>}
                      </div>
                    </div>
                    {isApproved && <Badge color="green">Approved</Badge>}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editSubject}
                        onChange={e => setEditSubject(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-[13px] text-[#e8edf5] outline-none"
                        style={{ background: "#151a22", border: "1px solid rgba(255,255,255,0.09)" }}
                      />
                      <textarea
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-[13px] text-[#e8edf5] outline-none resize-none"
                        style={{ background: "#151a22", border: "1px solid rgba(255,255,255,0.09)", minHeight: 120 }}
                      />
                      <div className="flex gap-2">
                        <button
                          style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }}
                          onClick={() => {
                            setCampaignDrafts(prev => ({
                              ...prev,
                              [id]: { ...prev[id], subject: editSubject, body: editBody }
                            }));
                            setEditingDraftId(null);
                          }}
                        >
                          Save
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
                      <div className="text-[13px] font-semibold text-[#e8edf5] mb-1">{draft.subject}</div>
                      <div className="text-[12px] text-[#8a95a8] mb-3">
                        {draft.body.substring(0, 100)}…
                      </div>
                      <div className="flex gap-2">
                        {!isApproved && (
                          <button
                            style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }}
                            onClick={() => {
                              setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "approved" } }));
                            }}
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </button>
                        )}
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
                style={btnPrimary}
                onClick={async () => {
                  const approvedIds = Object.keys(campaignDrafts).filter(id => campaignDrafts[id].status === "approved");
                  
                  for (const id of approvedIds) {
                    setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "generating" } }));
                    try {
                      await api.approveDraft(campaignDrafts[id].draftId);
                      await api.sendDraft(campaignDrafts[id].draftId);
                      setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "sent" } }));
                    } catch (err: any) {
                      setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "failed" } }));
                      toast.error(err.message || "Send failed");
                    }
                  }

                  setCampaignPhase("done");
                }}
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
            <div className="text-lg font-bold text-[#e8edf5] mb-2" style={{ fontFamily: "Syne,sans-serif" }}>
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
        <div className="px-4 py-3 flex items-center justify-between" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div className="text-[11px] font-bold text-[#5a6478] uppercase tracking-widest">Select Client</div>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {clients.map((c,i) => (
            <div key={c.result_id}
              className="px-3 py-3 cursor-pointer transition-colors"
              style={{
                borderBottom: i<clients.length-1?"1px solid rgba(255,255,255,0.05)":"none",
                background: selectedClient?.result_id===c.result_id ? "rgba(59,130,246,0.06)" : "transparent",
              }}
              onClick={()=>setSelectedClient(c)}>
              <div className="text-[13px] font-semibold text-[#e8edf5] truncate">{c.business_name || "Unknown"}</div>
              <div className="text-[11px] text-[#5a6478] truncate mt-0.5">
                {c.email_found ? c.email_found : <Badge color="gray">No email</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card} className="flex flex-col">
        <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div>
            <div className="text-sm font-bold text-[#e8edf5]" style={{fontFamily:"Syne,sans-serif"}}>Draft Email</div>
            {selectedClient && (
              <div className="text-[11px] text-[#5a6478] mt-0.5">To: {selectedClient.business_name} &lt;{selectedClient.email_found}&gt;</div>
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
            <label className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest block mb-1.5">Subject</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Email subject line…"
              className="w-full rounded-lg px-3 py-2 text-[13px] text-[#e8edf5] outline-none"
              style={{background:"#151a22",border:"1px solid rgba(255,255,255,0.09)"}} />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest block mb-1.5">Body</label>
            <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write or generate your email body…"
              className="flex-1 w-full rounded-lg px-3 py-2.5 text-[13px] text-[#e8edf5] outline-none resize-none"
              style={{background:"#151a22",border:"1px solid rgba(255,255,255,0.09)",minHeight:240,lineHeight:1.7}} />
            {body && <div className="text-[11px] text-[#5a6478] mt-1 text-right">{body.length} chars</div>}
          </div>

          <div className="flex gap-2 pt-1">
            <button style={btnPrimary} onClick={handleSend} disabled={!currentDraftId}>
              <Send className="h-3.5 w-3.5"/>Approve & Send
            </button>
            <button style={btnGhost} onClick={handleGenerate} disabled={generating || !selectedClient}>
              <RefreshCw className="h-3.5 w-3.5"/>Regenerate
            </button>
            <button style={{...btnGhost,marginLeft:"auto",color:"#ef4444"}} onClick={()=>{setSubject("");setBody("");setCurrentDraftId(null);}}>Discard</button>
          </div>
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
              : {background:"transparent",border:"1px solid rgba(255,255,255,0.07)",color:"#8a95a8"}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={card} className="p-12 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 text-[#5a6478] animate-spin" />
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