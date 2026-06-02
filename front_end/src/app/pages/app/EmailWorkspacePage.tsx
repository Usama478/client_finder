import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router";
import { Mail, Send, RefreshCw, Sparkles, Check, X, Edit2, Search, Upload, ChevronDown, ChevronUp, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 };
const btnPrimary: React.CSSProperties = { background: "var(--primary)", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 };
const btnGhost: React.CSSProperties = { background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 5 };
const btnCompact: React.CSSProperties = { ...btnPrimary, padding: "6px 12px", fontSize: 12 };
const btnCompactGhost: React.CSSProperties = { ...btnGhost, padding: "6px 12px", fontSize: 12 };

const Badge = ({ children, color }: { children: React.ReactNode; color: "green"|"blue"|"amber"|"red"|"gray" }) => {
  const m = {green:["rgba(16,185,129,0.1)","var(--chart-2)"],blue:["rgba(59,130,246,0.15)","#60a5fa"],amber:["rgba(245,158,11,0.1)","var(--chart-3)"],red:["rgba(239,68,68,0.1)","var(--destructive)"],gray:["var(--border)","var(--muted-foreground)"]};
  const [bg,text]=m[color];
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{background:bg,color:text}}>{children}</span>;
};

type DraftStatus = "pending" | "generating" | "generated" | "pending_review" | "approved" | "sent" | "failed" | "no_email";
type CampaignPhase = "select" | "generating" | "review" | "done";
type CampaignView = "setup" | "review" | "email-detail";
type CampaignFilter = "all" | "pending" | "drafted" | "sent";
type EmailTemplate = { id: string; name: string; content: string };

const emailTemplatesStorageKey = (userId: number) => `email_templates_${userId}`;
const draftTemplateMapStorageKey = (userId: number) => `draft_template_map_${userId}`;

const relevanceScoreColor = (score: number | null | undefined): "green"|"amber"|"red"|"gray" => {
  if (score == null) return "gray";
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "red";
};

const getClientId = (c: any) => String(c.result_id || c.id);

const getClientEmail = (c: any) => (c?.primary_contact_email || c?.email_found || "").trim();

const normalizeApiDraftStatus = (status: string | undefined): DraftStatus => {
  if (status === "approved" || status === "sent" || status === "failed") return status;
  if (status === "pending_review") return "pending_review";
  return "pending_review";
};

const isDraftedStatus = (s: DraftStatus) =>
  s === "pending_review" || s === "generated" || s === "approved";

const isViewableDraftStatus = (s: DraftStatus) => isDraftedStatus(s) || s === "sent";

export default function EmailWorkspacePage() {
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
  const [campaignGenerating, setCampaignGenerating] = useState(false);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("all");
  const [campaignView, setCampaignView] = useState<CampaignView>("setup");
  const [detailClient, setDetailClient] = useState<any>(null);
  const [detailDraft, setDetailDraft] = useState<any>(null);
  const [detailPolling, setDetailPolling] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [detailFadeIn, setDetailFadeIn] = useState(false);
  const detailPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [singleApproved, setSingleApproved] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState("")
  const [draftTemplateMap, setDraftTemplateMap] = useState<Record<string, string>>({})
  const [temperature, setTemperature] = useState(0.4)
  const [exporterProfile, setExporterProfile] = useState<any>(null)
  const [singleClientSearch, setSingleClientSearch] = useState("")
  const [showSingleTemplate, setShowSingleTemplate] = useState(false)
  const [expandedReviewDraftId, setExpandedReviewDraftId] = useState<string | null>(null)
  const [showDetailRefine, setShowDetailRefine] = useState(false)
  const [detailSessionContext, setDetailSessionContext] = useState<string | null>(null)
  const [dashboardFilter, setDashboardFilter] = useState<"all" | "drafted" | "sent" | "pending">("all")
  const [draftModalClient, setDraftModalClient] = useState<any>(null)
  const [draftModalData, setDraftModalData] = useState<{ subject: string; body: string; draftId: number } | null>(null)
  const [draftModalLoading, setDraftModalLoading] = useState(false)

  const getEffectiveTemplateContent = (): string =>
    globalTemplateContext.trim() || selectedTemplate?.content?.trim() || "";

  const appendTemplateToInstructions = (parts: string[]) => {
    const template = getEffectiveTemplateContent();
    if (template) {
      parts.push("--- EMAIL TEMPLATE ---");
      parts.push(template);
    }
  };

  const buildInstructions = (specific?: string): string => {
    const parts: string[] = [];
    if (specific?.trim()) parts.push(specific.trim());
    appendTemplateToInstructions(parts);
    return parts.join("\n\n");
  };

  const buildCampaignInstructions = (specific?: string): string => {
    const parts: string[] = [];
    if (specific?.trim()) parts.push(specific.trim());
    appendTemplateToInstructions(parts);
    return parts.join("\n\n");
  };

  const getClientAiContext = (client: any | null): string => {
    if (!client) return "—";
    const name = (client.context_name || "").trim();
    return name || "—";
  };

  const fetchActiveDraftForBusiness = async (businessId: number): Promise<{
    draftId: number;
    subject: string;
    body: string;
    status: DraftStatus;
  } | null> => {
    try {
      const existing = await api.emailDrafts(businessId);
      const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
      const active = list.find(d => d?.status && d.status !== "failed");
      if (!active?.id) return null;
      const detail = await api.emailDraftDetail(active.id);
      const draftData = Array.isArray(detail) ? detail[0] : detail;
      if (!draftData) return null;
      return {
        draftId: draftData.id,
        subject: draftData.subject || "",
        body: draftData.body || "",
        status: normalizeApiDraftStatus(draftData.status),
      };
    } catch {
      return null;
    }
  };

  const buildRegenerateInstructions = (instructions: string, prevSubject?: string, prevBody?: string): string => {
    const parts: string[] = [];
    if (instructions.trim()) parts.push(instructions.trim());
    if (prevSubject != null && prevBody != null) {
      parts.push(`--- Previous email for reference ---\nSubject: ${prevSubject}\n\n${prevBody}`);
    }
    const templateContent = getEffectiveTemplateContent();
    if (templateContent) {
      parts.push(`--- EMAIL TEMPLATE ---\n${templateContent}`);
    }
    return parts.join("\n\n");
  };

  const clientMatchesCampaignFilter = (c: any, filter: CampaignFilter): boolean => {
    if (filter === "all") return true;
    const ds = c.draft_status as string | null | undefined;
    const hasDraft = c.has_draft === true;
    if (filter === "pending") return !hasDraft || !ds || ds === "failed";
    if (filter === "drafted") return hasDraft && (ds === "pending_review" || ds === "approved");
    if (filter === "sent") return ds === "sent";
    return true;
  };

  const stopDetailPolling = useCallback(() => {
    if (detailPollRef.current) {
      clearInterval(detailPollRef.current);
      detailPollRef.current = null;
    }
    setDetailPolling(false);
  }, []);

  const startDetailPolling = useCallback((businessId: number, clientId: string) => {
    stopDetailPolling();
    setDetailPolling(true);
    setDetailDraft(null);
    detailPollRef.current = setInterval(async () => {
      try {
        const drafts = await api.emailDrafts(businessId);
        const list = Array.isArray(drafts) ? drafts : drafts ? [drafts] : [];
        const active = list.find(d => d?.status && d.status !== "failed");
        if (!active?.id) return;
        const detail = await api.emailDraftDetail(active.id);
        const draftData = Array.isArray(detail) ? detail[0] : detail;
        if (!draftData) return;
        setDetailDraft(draftData);
        setDetailFadeIn(true);
        const status = normalizeApiDraftStatus(draftData.status);
        setCampaignDrafts(prev => ({
          ...prev,
          [clientId]: {
            draftId: draftData.id,
            subject: draftData.subject || "",
            body: draftData.body || "",
            status,
          },
        }));
        stopDetailPolling();
        setRegenerating(false);
      } catch {
        /* keep polling */
      }
    }, 2000);
  }, [stopDetailPolling]);

  useEffect(() => () => stopDetailPolling(), [stopDetailPolling]);

  useEffect(() => {
    const client = detailClient?.search_id
      ? detailClient
      : activeTab === "single" && selectedClient?.search_id
        ? selectedClient
        : null;
    if (!client?.search_id) {
      setDetailSessionContext(null);
      return;
    }
    const searchId = client.search_id;
    api.sessions()
      .then(sessions => {
        const session = (sessions || []).find((s: any) => s.search_id === searchId);
        const name = (session?.context_name || "").trim();
        const display = name || null;
        if (detailClient?.search_id === searchId) {
          setDetailSessionContext(display);
        }
        const patch = { context_name: session?.context_name ?? null };
        if (detailClient?.search_id === searchId) {
          setDetailClient((prev: any) => (prev?.search_id === searchId ? { ...prev, ...patch } : prev));
        }
        if (selectedClient?.search_id === searchId) {
          setSelectedClient((prev: any) => (prev?.search_id === searchId ? { ...prev, ...patch } : prev));
        }
      })
      .catch(() => setDetailSessionContext(null));
  }, [detailClient, selectedClient, activeTab]);

  const persistTemplates = (next: EmailTemplate[]) => {
    if (!user?.user_id) return;
    setTemplates(next);
    localStorage.setItem(emailTemplatesStorageKey(user.user_id), JSON.stringify(next));
  };

  const recordDraftTemplate = (draftId: number, templateName: string) => {
    if (!user?.user_id) return;
    setDraftTemplateMap(prev => {
      const next = { ...prev, [String(draftId)]: templateName };
      localStorage.setItem(draftTemplateMapStorageKey(user.user_id), JSON.stringify(next));
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
    api.getMyProfile().then(p => {
      if (p?.id) {
        setExporterProfileId(p.id);
        setExporterProfile(p);
      }
    }).catch(() => {})
    fetch("/api/v1/dashboard/stats", { headers: { Authorization: `Bearer ${localStorage.getItem("cf_token")}` } })
      .then(r => r.json())
      .then(data => setEmailStats(data))
      .catch(() => {})
  }, []);

  useEffect(() => {
    if (!user?.user_id) {
      setTemplates([]);
      setSelectedTemplate(null);
      setGlobalTemplateContext("");
      setDraftTemplateMap({});
      return;
    }
    try {
      const savedTemplates = JSON.parse(
        localStorage.getItem(emailTemplatesStorageKey(user.user_id)) || "[]",
      );
      setTemplates(Array.isArray(savedTemplates) ? savedTemplates : []);
    } catch {
      setTemplates([]);
    }
    try {
      const savedMap = JSON.parse(
        localStorage.getItem(draftTemplateMapStorageKey(user.user_id)) || "{}",
      );
      setDraftTemplateMap(savedMap && typeof savedMap === "object" ? savedMap : {});
    } catch {
      setDraftTemplateMap({});
    }
    setSelectedTemplate(null);
    setGlobalTemplateContext("");
  }, [user?.user_id]);

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
      const result = await api.generateEmail(targetId, user.user_id, exporterProfileId, buildInstructions(), temperature);

      if (result.draft_id) {
        setCurrentDraftId(result.draft_id);
        recordDraftTemplate(result.draft_id, selectedTemplate?.name || (globalTemplateContext.trim() ? "Custom" : "None"));
        const draft = await api.emailDraftDetail(result.draft_id);
        const draftData = Array.isArray(draft) ? draft[0] : draft;
        setSubject(draftData?.subject || "");
        setBody(draftData?.body || "");
        toast.success("Email draft generated!", { id: toastId });
      } else if (
        result.skip_code === "draft_already_pending" ||
        result.skip_code === "draft_already_sent" ||
        result.status === "skipped"
      ) {
        const existing = await fetchActiveDraftForBusiness(Number(targetId));
        if (existing) {
          setCurrentDraftId(existing.draftId);
          setSubject(existing.subject);
          setBody(existing.body);
          toast.success("Loaded existing draft", { id: toastId });
        } else {
          toast.error(result.reason || "No existing draft found", { id: toastId });
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
      const result = await api.generateEmail(targetId, user.user_id, exporterProfileId, buildInstructions(instructions), temperature);

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
    const toastId = toast.loading("Sending email…");
    try {
      await api.updateDraft(currentDraftId, { subject, body });
      if (!singleApproved) {
        await api.approveDraft(currentDraftId);
      }
      await api.sendDraft(currentDraftId);
      toast.success(`Email sent to ${selectedClient?.business_name || "client"}!`, { id: toastId });
      setSubject(""); 
      setBody(""); 
      setCurrentDraftId(null);
      setSingleApproved(false);
    } catch (err: any) {
      toast.error(err.message || "Send failed", { id: toastId });
    }
  };

  const handleCampaignSend = async () => {
    const approved = Object.entries(campaignDrafts).filter(([, d]) => d.status === "approved");
    if (approved.length === 0) {
      toast.error("Approve at least one draft before sending");
      return;
    }
    const toastId = toast.loading(`Sending ${approved.length} email(s)…`);
    let sent = 0;
    for (const [id, draft] of approved) {
      try {
        await api.sendDraft(draft.draftId);
        sent += 1;
        setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "sent" } }));
      } catch (err: any) {
        toast.error(`${id}: ${err.message || "Send failed"}`);
      }
    }
    if (sent > 0) {
      toast.success(`${sent} email(s) sent`, { id: toastId });
      setCampaignPhase("done");
    } else {
      toast.error("No emails were sent", { id: toastId });
    }
  };

  const handleCampaignGenerate = async () => {
    if (!user) { toast.error("Not logged in"); return; }
    if (!exporterProfileId) { toast.error("Set up your exporter profile in Settings first"); return; }
    if (selectedClientIds.length === 0) return;

    setCampaignGenerating(true);
    try {
    setCampaignPhase("generating");
    setCampaignView("setup");
    const drafts: Record<string, { draftId: number; subject: string; body: string; status: DraftStatus }> = {};
    for (const id of selectedClientIds) {
      drafts[id] = { draftId: 0, subject: "", body: "", status: "pending" };
    }
    setCampaignDrafts(drafts);

    const userInstructions = buildCampaignInstructions();

    for (const id of selectedClientIds) {
      const client = campaignClients.find(c => getClientId(c) === id);
      if (!getClientEmail(client)) {
        setCampaignDrafts(prev => ({ ...prev, [id]: { draftId: 0, subject: "", body: "", status: "no_email" } }));
        continue;
      }

      try {
        const existingDraft = await fetchActiveDraftForBusiness(Number(id));
        if (existingDraft && isViewableDraftStatus(existingDraft.status)) {
          setCampaignDrafts(prev => ({ ...prev, [id]: existingDraft }));
          continue;
        }

        setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "generating" } }));

        const result = await api.generateEmail(Number(id), user.user_id, exporterProfileId!, userInstructions, temperature);

        let draftId = result.draft_id;
        let subject = "";
        let body = "";
        let status: DraftStatus = "failed";

        if (draftId) {
          const draft = await api.emailDraftDetail(draftId);
          const draftData = Array.isArray(draft) ? draft[0] : draft;
          subject = draftData?.subject || "";
          body = draftData?.body || "";
          status = normalizeApiDraftStatus(draftData?.status);
        } else if (result.skip_code === "draft_already_pending" || result.skip_code === "draft_already_sent" || result.status === "skipped") {
          const loaded = await fetchActiveDraftForBusiness(Number(id));
          if (loaded) {
            draftId = loaded.draftId;
            subject = loaded.subject;
            body = loaded.body;
            status = loaded.status;
          }
        }

        if (draftId) {
          recordDraftTemplate(draftId, selectedTemplate?.name || (globalTemplateContext.trim() ? "Custom" : "None"));
          setCampaignDrafts(prev => ({
            ...prev,
            [id]: { draftId, subject, body, status },
          }));
        } else {
          setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "failed" } }));
        }
      } catch {
        setCampaignDrafts(prev => ({ ...prev, [id]: { ...prev[id], status: "failed" } }));
      }
    }

    setCampaignPhase("review");
    setCampaignView("review");
    } finally {
      setCampaignGenerating(false);
    }
  };

  const openEmailDetail = async (client: any) => {
    if (!user || !exporterProfileId) return;
    const clientId = getClientId(client);
    const fullClient = campaignClients.find(c => getClientId(c) === clientId) || client;
    const businessId = Number(fullClient.result_id || fullClient.id);
    setDetailClient(fullClient);
    setCampaignView("email-detail");
    setRegenInstructions("");
    setDetailFadeIn(false);
    setShowDetailRefine(false);

    const cached = campaignDrafts[clientId];
    if (cached?.status === "no_email") return;

    if (cached?.draftId && isViewableDraftStatus(cached.status)) {
      try {
        const detail = await api.emailDraftDetail(cached.draftId);
        const draftData = Array.isArray(detail) ? detail[0] : detail;
        setDetailDraft(draftData);
        setDetailFadeIn(true);
        stopDetailPolling();
        return;
      } catch {
        /* fall through */
      }
    }

    try {
      const loaded = await fetchActiveDraftForBusiness(businessId);
      if (loaded) {
        const detail = await api.emailDraftDetail(loaded.draftId);
        const draftData = Array.isArray(detail) ? detail[0] : detail;
        if (draftData) {
          setDetailDraft(draftData);
          setDetailFadeIn(true);
          setCampaignDrafts(prev => ({
            ...prev,
            [clientId]: loaded,
          }));
          stopDetailPolling();
          return;
        }
      }
    } catch {
      /* show empty state below */
    }

    setDetailDraft(null);
    stopDetailPolling();
  };

  const handleDetailGenerate = async () => {
    if (!user || !exporterProfileId || !detailClient) return;
    const clientId = getClientId(detailClient);
    const businessId = Number(detailClient.result_id || detailClient.id);
    setRegenerating(true);
    setDetailFadeIn(false);
    setDetailDraft(null);
    setCampaignDrafts(prev => ({
      ...prev,
      [clientId]: { draftId: 0, subject: "", body: "", status: "generating" },
    }));
    startDetailPolling(businessId, clientId);
    try {
      const result = await api.generateEmail(
        businessId,
        user.user_id,
        exporterProfileId,
        buildCampaignInstructions(regenInstructions),
        temperature,
      );
      if (result.draft_id) {
        recordDraftTemplate(
          result.draft_id,
          selectedTemplate?.name || (globalTemplateContext.trim() ? "Custom" : "None"),
        );
        const detail = await api.emailDraftDetail(result.draft_id);
        const draftData = Array.isArray(detail) ? detail[0] : detail;
        if (draftData) {
          const status = normalizeApiDraftStatus(draftData.status);
          setDetailDraft(draftData);
          setDetailFadeIn(true);
          setCampaignDrafts(prev => ({
            ...prev,
            [clientId]: {
              draftId: draftData.id,
              subject: draftData.subject || "",
              body: draftData.body || "",
              status,
            },
          }));
          stopDetailPolling();
        }
      } else if (result.skip_code === "draft_already_pending" || result.skip_code === "draft_already_sent") {
        const loaded = await fetchActiveDraftForBusiness(businessId);
        if (loaded) {
          const detail = await api.emailDraftDetail(loaded.draftId);
          const draftData = Array.isArray(detail) ? detail[0] : detail;
          if (draftData) {
            setDetailDraft(draftData);
            setDetailFadeIn(true);
            setCampaignDrafts(prev => ({ ...prev, [clientId]: loaded }));
          }
        }
        stopDetailPolling();
      } else {
        toast.error(result.reason || "Generation failed");
        setCampaignDrafts(prev => ({ ...prev, [clientId]: { draftId: 0, subject: "", body: "", status: "failed" } }));
        stopDetailPolling();
      }
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
      setCampaignDrafts(prev => ({ ...prev, [clientId]: { draftId: 0, subject: "", body: "", status: "failed" } }));
      stopDetailPolling();
    } finally {
      setRegenerating(false);
    }
  };

  const handleDetailRegenerate = async () => {
    if (!user || !exporterProfileId || !detailClient || !detailDraft?.id) return;
    const clientId = getClientId(detailClient);
    const businessId = Number(detailClient.result_id || detailClient.id);
    setRegenerating(true);
    setDetailFadeIn(false);
    try {
      const combinedInstructions = buildRegenerateInstructions(
        regenInstructions,
        detailDraft.subject,
        detailDraft.body,
      );
      await api.deleteDraft(detailDraft.id);
      setDetailDraft(null);
      setCampaignDrafts(prev => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
      setCampaignDrafts(prev => ({
        ...prev,
        [clientId]: { draftId: 0, subject: "", body: "", status: "generating" },
      }));
      startDetailPolling(businessId, clientId);
      const result = await api.generateEmail(businessId, user.user_id, exporterProfileId, combinedInstructions, temperature);
      if (result.draft_id) {
        recordDraftTemplate(
          result.draft_id,
          selectedTemplate?.name || (globalTemplateContext.trim() ? "Custom" : "None"),
        );
        const detail = await api.emailDraftDetail(result.draft_id);
        const draftData = Array.isArray(detail) ? detail[0] : detail;
        if (draftData) {
          const status = normalizeApiDraftStatus(draftData.status);
          setDetailDraft(draftData);
          setDetailFadeIn(true);
          setCampaignDrafts(prev => ({
            ...prev,
            [clientId]: {
              draftId: draftData.id,
              subject: draftData.subject || "",
              body: draftData.body || "",
              status,
            },
          }));
          stopDetailPolling();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Regeneration failed");
      stopDetailPolling();
    } finally {
      setRegenerating(false);
    }
  };

  const handleDetailApproveAndSend = async () => {
    if (!detailDraft?.id || !detailClient) return;
    const clientId = getClientId(detailClient);
    const toastId = toast.loading("Sending email…");
    try {
      await api.approveDraft(detailDraft.id);
      await api.sendDraft(detailDraft.id);
      setDetailDraft((prev: any) => (prev ? { ...prev, status: "sent" } : prev));
      setCampaignDrafts(prev => ({
        ...prev,
        [clientId]: { ...prev[clientId], status: "sent" },
      }));
      toast.success("Email sent!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Send failed", { id: toastId });
    }
  };

  const handleDetailDeleteDraft = async () => {
    if (!detailDraft?.id || !detailClient) return;
    const clientId = getClientId(detailClient);
    try {
      await api.deleteDraft(detailDraft.id);
      setDetailDraft(null);
      setDetailFadeIn(false);
      setCampaignDrafts(prev => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
      setCampaignClients(prev =>
        prev.map(c =>
          getClientId(c) === clientId ? { ...c, has_draft: false, draft_status: null } : c,
        ),
      );
      stopDetailPolling();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete draft");
    }
  };

  const filterCampaignClients = () => campaignClients.filter(c => {
    const matchSearch = (c.business_name || "").toLowerCase().includes(campaignSearchQuery.toLowerCase());
    return matchSearch && clientMatchesCampaignFilter(c, campaignFilter);
  });

  const statusBadge = (s: string) => {
    if (s==="sent")    return <Badge color="blue">Sent</Badge>;
    if (s==="opened")  return <Badge color="green">Opened</Badge>;
    if (s==="replied") return <Badge color="green">Replied</Badge>;
    if (s==="bounced") return <Badge color="red">Bounced</Badge>;
    return <Badge color="gray">Pending</Badge>;
  };

  const handleOpenDraftModal = async (client: any) => {
    setDraftModalClient(client);
    setDraftModalData(null);
    setDraftModalLoading(true);
    try {
      const targetId = client.result_id || client.id;
      const drafts = await api.emailDrafts(targetId);
      const summary = Array.isArray(drafts) ? drafts[0] : drafts;
      if (summary?.id) {
        const detail = await api.emailDraftDetail(summary.id);
        const d = Array.isArray(detail) ? detail[0] : detail;
        setDraftModalData({
          subject: d?.subject || "",
          body: d?.body || "",
          draftId: summary.id,
        });
      }
    } catch {
      // no draft exists — modal shows empty state
    } finally {
      setDraftModalLoading(false);
    }
  };

  const draftStatusBadge = (s: DraftStatus) => {
    if (s === "no_email") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-amber-400 bg-amber-400/10">No Email</span>;
    if (s === "approved") return <Badge color="green">Approved</Badge>;
    if (s === "sent") return <Badge color="blue">Sent</Badge>;
    if (s === "failed") return <Badge color="red">Failed</Badge>;
    if (s === "generating") return <Badge color="amber">Generating</Badge>;
    if (s === "pending_review" || s === "generated") return <Badge color="gray">Generated</Badge>;
    return <Badge color="gray">Pending</Badge>;
  };

  const detailStatusBadge = (status: string | undefined) => {
    if (status === "sent") return <Badge color="blue">Sent</Badge>;
    if (status === "approved") return <Badge color="green">Approved</Badge>;
    if (status === "pending_review") return <Badge color="gray">Pending</Badge>;
    if (status === "failed") return <Badge color="red">Failed</Badge>;
    return <Badge color="gray">Generated</Badge>;
  };

  const formatList = (val: unknown): string => {
    if (Array.isArray(val)) return val.length ? val.join(", ") : "—";
    if (val == null || val === "") return "—";
    return String(val);
  };

  const renderTemperatureControl = (compact = false) => {
    if (compact) {
      return (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{temperature.toFixed(1)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            className="w-20 accent-blue-500"
            title="Email creativity (0.0–1.0)"
          />
        </div>
      );
    }
    return (
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">
          Email Creativity — {temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onChange={e => setTemperature(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>Precise (0.0)</span>
          <span>Creative (1.0)</span>
        </div>
      </div>
    );
  };

  const renderTemplateContent = (includeTemperature = false) => (
    <div className="space-y-3">
      {includeTemperature && renderTemperatureControl()}
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
              <option value="">None</option>
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
          placeholder="Paste template with {{company_name}}, {{product_category}}, {{website}} placeholders..."
          className="w-full rounded-lg px-3 py-2 text-[12px] text-foreground outline-none resize-none"
          style={{ background: "#0a0d12", border: "1px solid var(--border)", minHeight: 120, lineHeight: 1.6 }}
        />
        {globalTemplateContext && (
          <div className="text-[10px] text-muted-foreground mt-1 text-right">{globalTemplateContext.length} chars</div>
        )}
      </div>

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
        This context is combined with exporter profile, lead data, campaign AI context, and sent to GPT-4o-mini.
        Use placeholders: {"{{company_name}}"}, {"{{product_category}}"}, {"{{website}}"}, {"{{seller_company}}"}, {"{{certification}}"}.
      </div>
    </div>
  );

  const StatCard = ({ label, value, accentColor }: { label: string; value: string; accentColor: string }) => (
    <div style={{ ...card, borderLeft: `3px solid ${accentColor}` }} className="p-4">
      <div className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "Syne,sans-serif" }}>{value}</div>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</div>
    </div>
  );

  const ContextStrip = ({ client }: { client: any | null }) => (
    <div style={{ ...card, display: "flex", overflow: "hidden", minHeight: 140 }}>
      <div className="flex-1 px-4 py-3" style={{ borderRight: "1px solid var(--border)" }}>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Sending As</div>
        {!exporterProfile ? (
          <div className="text-[11px] text-muted-foreground">
            No profile. <Link to="/app/profile" className="text-blue-400 underline">Profile</Link>
          </div>
        ) : (
          <>
            <div className="text-[14px] font-semibold text-foreground truncate">{exporterProfile.company_name || "—"}</div>
            <div className="text-[11px] text-muted-foreground mt-1 truncate">
              {formatList(exporterProfile.product_categories || exporterProfile.products)}
            </div>
          </>
        )}
      </div>
      <div className="flex-1 px-4 py-3" style={{ borderRight: "1px solid var(--border)" }}>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Lead Intel</div>
        {client ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {client.relevance_decision ? (
                <Badge color={client.relevance_decision === "relevant" ? "green" : "amber"}>{client.relevance_decision}</Badge>
              ) : <Badge color="gray">—</Badge>}
              {client.relevance_score != null && (
                <span className="text-[13px] font-semibold text-foreground">{client.relevance_score}</span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Verification {client.verification_score ?? "—"} · Legitimacy {client.legitimacy_score ?? "—"}
            </div>
          </>
        ) : (
          <div className="text-[11px] text-muted-foreground">Select a client</div>
        )}
      </div>
      <div className="flex-1 px-4 py-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">AI Context</div>
        {getClientAiContext(client) ? (
          <div className="text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-wrap">{getClientAiContext(client)}</div>
        ) : (
          <div className="text-[11px] text-muted-foreground">—</div>
        )}
      </div>
    </div>
  );

  const SendingAsCard = () => (
    <div style={card} className="p-4">
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Sending As</div>
      {!exporterProfile ? (
        <div className="text-[12px] text-muted-foreground">
          No exporter profile configured.{" "}
          <Link to="/app/profile" className="text-blue-400 underline">Set up in Profile</Link>
        </div>
      ) : (
        <div className="space-y-1.5 text-[12px]">
          <div><span className="text-muted-foreground">Company:</span> {exporterProfile.company_name || "—"}</div>
          <div><span className="text-muted-foreground">Location:</span> {exporterProfile.company_location || exporterProfile.location || "—"}</div>
          <div><span className="text-muted-foreground">Products:</span> {formatList(exporterProfile.product_categories || exporterProfile.products)}</div>
          <div><span className="text-muted-foreground">Certifications:</span> {formatList(exporterProfile.certifications)}</div>
          <div><span className="text-muted-foreground">Export markets:</span> {formatList(exporterProfile.export_markets || exporterProfile.target_markets)}</div>
          <div><span className="text-muted-foreground">Target buyers:</span> {formatList(exporterProfile.target_buyer_types)}</div>
          {exporterProfile.value_proposition && (
            <div className="text-muted-foreground mt-2 line-clamp-3">{exporterProfile.value_proposition}</div>
          )}
        </div>
      )}
    </div>
  );

  const GenerationSettingsCard = () => (
    <div style={card} className="p-4">
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Generation Settings</div>
      <div className="text-[11px] text-muted-foreground mb-3">
        Each email is personalized using lead data, your exporter profile, and campaign context
      </div>
      <div className="space-y-1.5 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500 shrink-0" /> Exporter profile</div>
        <div className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500 shrink-0" /> Lead relevance & verification data</div>
        <div className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500 shrink-0" /> Product catalog</div>
        <div className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500 shrink-0" /> SERP enrichment</div>
        <div className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500 shrink-0" /> Campaign AI context</div>
        <div className="flex items-center gap-2"><Check className="h-3 w-3 text-green-500 shrink-0" /> Your template (if provided)</div>
      </div>
    </div>
  );

  const CampaignClientRow = ({ client, selected, onToggle, interactive = true }: { client: any; selected: boolean; onToggle: () => void; interactive?: boolean }) => (
    <div
      className={`px-3 flex items-center gap-3 ${interactive ? "cursor-pointer hover:bg-[#0f1420]" : ""}`}
      style={{ minHeight: 48, borderBottom: "1px solid var(--border)" }}
      onClick={interactive ? onToggle : undefined}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => {}}
        onClick={e => { if (interactive) { e.stopPropagation(); onToggle(); } }}
        disabled={!interactive}
        className="accent-blue-500"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">{client.business_name || "Unknown"}</div>
        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
          {client.email_found ? client.email_found : <Badge color="gray">No email</Badge>}
        </div>
      </div>
      <div>{statusBadge(client.outreach_status || "pending")}</div>
    </div>
  );

  const renderCampaignClientPanel = (interactive: boolean) => {
    const filtered = filterCampaignClients();
    const allSelected = filtered.length > 0 && filtered.every(c => selectedClientIds.includes(getClientId(c)));

    return (
      <div style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Select Clients</div>
          <Badge color="blue">{selectedClientIds.length}/{filtered.length}</Badge>
        </div>

        <div className="p-3 space-y-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              placeholder="Search clients…"
              value={campaignSearchQuery}
              onChange={e => setCampaignSearchQuery(e.target.value)}
              disabled={!interactive}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] text-foreground outline-none"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            />
          </div>
          <div className="flex gap-1.5">
            {([
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "drafted", label: "Drafted" },
              { key: "sent", label: "Sent" },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => interactive && setCampaignFilter(f.key)}
                disabled={!interactive}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={campaignFilter === f.key
                  ? { background: "var(--primary)", color: "white", border: "none" }
                  : { background: "transparent", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {interactive && (
          <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                if (allSelected) {
                  setSelectedClientIds([]);
                } else {
                  setSelectedClientIds(filtered.map(c => getClientId(c)));
                }
              }}
              className="accent-blue-500"
            />
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Select All</div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {campaignClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-muted-foreground text-sm text-center">
              Select a campaign to view emails
            </div>
          ) : (
            filtered.map(c => {
              const id = getClientId(c);
              return (
                <CampaignClientRow
                  key={id}
                  client={c}
                  selected={selectedClientIds.includes(id)}
                  interactive={interactive}
                  onToggle={() => {
                    if (selectedClientIds.includes(id)) {
                      setSelectedClientIds(selectedClientIds.filter(x => x !== id));
                    } else {
                      setSelectedClientIds([...selectedClientIds, id]);
                    }
                  }}
                />
              );
            })
          )}
        </div>

        {interactive && (
          <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--border)", background: "#0a0d12" }}>
            <div className="text-[12px] font-semibold text-foreground">{selectedClientIds.length} clients selected</div>
            <button
              style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: selectedClientIds.length === 0 || !exporterProfileId || campaignGenerating ? 0.5 : 1 }}
              disabled={selectedClientIds.length === 0 || !exporterProfileId || campaignGenerating}
              title={!exporterProfileId ? "Set up your exporter profile in Settings first" : selectedClientIds.length === 0 ? "Select at least one client" : campaignGenerating ? "Generating…" : undefined}
              onClick={handleCampaignGenerate}
            >
              {campaignGenerating ? "Generating…" : "Generate Emails →"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderDashboard = () => {
    const stats = {
      contacted: clients.filter(c => c.outreach_status && c.outreach_status !== "pending").length,
      sent: emailStats?.emails_sent ?? 0,
      opened: emailStats?.emails_opened ?? 0,
      replied: emailStats?.emails_replied ?? 0,
      bounced: clients.filter(c => c.outreach_status === "bounced").length,
    };

    const filteredDashboardClients = clients.filter(c => {
      if (dashboardFilter === "all") return true
      if (dashboardFilter === "drafted")
        return c.has_draft === true && c.draft_status !== "sent"
      if (dashboardFilter === "sent")
        return c.outreach_status === "sent" ||
               c.outreach_status === "opened" ||
               c.outreach_status === "replied" ||
               c.draft_status === "sent"
      if (dashboardFilter === "pending")
        return !c.has_draft && 
               (!c.outreach_status || c.outreach_status === "pending")
      return true
    })

    const dashboardFilterPillStyle = (active: boolean): React.CSSProperties => active
      ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }
      : { background: "transparent", border: "1px solid var(--border)", color: "var(--muted-foreground)", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif" };

    return (
      <>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Contacted", value: stats.contacted.toString(), color: "var(--primary)" },
              { label: "Sent", value: String(stats.sent ?? 0), color: "var(--chart-2)" },
              { label: "Opened", value: `${String(stats.opened ?? 0)} (${emailStats?.emails_sent && emailStats.emails_sent > 0 ? Math.round((stats.opened / emailStats.emails_sent) * 100) : 0}%)`, color: "#8b5cf6" },
              { label: "Replied", value: `${String(stats.replied ?? 0)} (${emailStats?.emails_sent && emailStats.emails_sent > 0 ? Math.round((stats.replied / emailStats.emails_sent) * 100) : 0}%)`, color: "var(--chart-2)" },
              { label: "Bounced", value: stats.bounced.toString(), color: "var(--destructive)" },
            ].map((s, i) => (
              <StatCard key={i} label={s.label} value={s.value} accentColor={s.color} />
            ))}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: "all", label: "All" },
              { key: "drafted", label: "Drafted" },
              { key: "sent", label: "Sent" },
              { key: "pending", label: "Pending" },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setDashboardFilter(f.key)}
                style={dashboardFilterPillStyle(dashboardFilter === f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={card} className="overflow-hidden">
            <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">All Clients</div>
            </div>

            {filteredDashboardClients.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-center">
                <Mail className="h-12 w-12 text-muted-foreground mb-3 opacity-40" />
                <div className="text-sm font-bold text-foreground">No clients with emails</div>
                <div className="text-[12px] text-muted-foreground mt-1">Find clients first to start sending emails</div>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
                      style={{ background: "#0a0d12", position: "sticky", top: 0, zIndex: 1 }}
                    >
                      <th className="text-left px-4 py-2">Business Name</th>
                      <th className="text-left px-4 py-2">Email</th>
                      <th className="text-left px-4 py-2">Relevance</th>
                      <th className="text-left px-4 py-2">Verification</th>
                      <th className="text-left px-4 py-2">Email Status</th>
                      <th className="text-left px-4 py-2">Last Contacted</th>
                      <th className="text-left px-4 py-2 w-12">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDashboardClients.map((c, i) => (
                      <tr
                        key={c.result_id}
                        style={{
                          borderBottom: i < filteredDashboardClients.length - 1 ? "1px solid var(--border)" : "none",
                          background: i % 2 === 0 ? "#0d1117" : "#0f1420",
                        }}
                      >
                        <td className="px-4 py-2">
                          <div className="text-[13px] font-semibold text-foreground">{c.business_name || "Unknown"}</div>
                        </td>
                        <td className="px-4 py-2 text-[12px] text-muted-foreground">
                          {c.primary_contact_email || c.email_found ? (c.primary_contact_email || c.email_found) : <Badge color="gray">No email</Badge>}
                        </td>
                        <td className="px-4 py-2">
                          {c.relevance_score != null ? (
                            <Badge color={relevanceScoreColor(c.relevance_score)}>{c.relevance_score}</Badge>
                          ) : (
                            <Badge color="gray">—</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[12px] text-muted-foreground">
                          {c.verification_score != null ? `${c.verification_score}/100` : "—"}
                        </td>
                        <td className="px-4 py-2">{statusBadge(c.outreach_status || "pending")}</td>
                        <td className="px-4 py-2 text-[12px] text-muted-foreground">
                          {c.processed_at ? new Date(c.processed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            style={{ ...btnGhost, padding: "5px 8px" }}
                            title="Draft email"
                            onClick={() => handleOpenDraftModal(c)}
                          >
                            <Mail className="h-3.5 w-3.5" />
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

        {draftModalClient && (
          <>
            <div
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50 }}
              onClick={() => { setDraftModalClient(null); setDraftModalData(null); }}
            />
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 600,
                maxHeight: "80vh",
                overflowY: "auto",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 0,
                zIndex: 51,
              }}
            >
              <div className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="text-[14px] font-semibold text-foreground">{draftModalClient.business_name || "Unknown"}</div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">
                    {draftModalClient.primary_contact_email || draftModalClient.email_found || "—"}
                  </div>
                </div>
                <button
                  style={{ ...btnGhost, padding: "4px 6px" }}
                  onClick={() => { setDraftModalClient(null); setDraftModalData(null); }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-4">
                {draftModalLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin mb-2" />
                    <div className="text-[13px] text-muted-foreground">Loading draft…</div>
                  </div>
                ) : draftModalData ? (
                  <>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">SUBJECT</div>
                    <div
                      className="text-[13px] text-foreground rounded px-3 py-2 mt-1"
                      style={{ background: "var(--muted)" }}
                    >
                      {draftModalData.subject}
                    </div>
                    <div className="mt-3">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">BODY</div>
                      <div
                        className="text-[13px] text-foreground px-3 py-2 mt-1"
                        style={{
                          lineHeight: 1.8,
                          maxHeight: 320,
                          overflowY: "auto",
                          background: "var(--muted)",
                          borderRadius: 8,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {draftModalData.body}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center py-8">
                    <Mail className="h-10 w-10 text-muted-foreground opacity-40" />
                    <div className="text-[14px] font-semibold text-foreground mt-3">No draft yet</div>
                    <div className="text-[12px] text-muted-foreground mt-1">No email has been generated for this client yet.</div>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="text-[11px] text-muted-foreground">
                  {draftModalData ? `Draft ID: ${draftModalData.draftId}` : ""}
                </div>
                <div className="flex items-center gap-2">
                  {draftModalData ? (
                    <button
                      style={btnPrimary}
                      onClick={() => {
                        setSelectedClient(draftModalClient);
                        setSubject(draftModalData.subject);
                        setBody(draftModalData.body);
                        setCurrentDraftId(draftModalData.draftId);
                        setActiveTab("single");
                        setDraftModalClient(null);
                        setDraftModalData(null);
                      }}
                    >
                      Edit in Single Send
                    </button>
                  ) : !draftModalLoading ? (
                    <button
                      style={btnPrimary}
                      onClick={() => {
                        setSelectedClient(draftModalClient);
                        setSubject("");
                        setBody("");
                        setCurrentDraftId(null);
                        setSingleApproved(false);
                        setRegenerateInstructions("");
                        setActiveTab("single");
                        setDraftModalClient(null);
                        setDraftModalData(null);
                      }}
                    >
                      Generate Email
                    </button>
                  ) : null}
                  <button
                    style={btnGhost}
                    onClick={() => { setDraftModalClient(null); setDraftModalData(null); }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </>
    );
  };

  const renderSingleSend = () => {
    const filteredClients = clients.filter(c =>
      (c.business_name || "").toLowerCase().includes(singleClientSearch.toLowerCase()) ||
      (c.email_found || "").toLowerCase().includes(singleClientSearch.toLowerCase())
    );

    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: "280px 1fr", height: "calc(100vh - 140px)" }}>
        <div style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search clients…"
                value={singleClientSearch}
                onChange={e => setSingleClientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-[12px] text-foreground outline-none"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredClients.map((c, i) => {
              const isSelected = selectedClient?.result_id === c.result_id;
              return (
                <div
                  key={c.result_id}
                  className="px-3 py-2.5 cursor-pointer transition-colors flex items-center gap-2"
                  style={{
                    minHeight: 56,
                    borderBottom: i < filteredClients.length - 1 ? "1px solid var(--border)" : "none",
                    borderLeft: isSelected ? "3px solid var(--primary)" : "3px solid transparent",
                    background: isSelected ? "rgba(59,130,246,0.06)" : "transparent",
                  }}
                  onClick={() => setSelectedClient(c)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">{c.business_name || "Unknown"}</div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {c.email_found ? c.email_found : "No email"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {c.relevance_score != null && (
                      <Badge color={relevanceScoreColor(c.relevance_score)}>{c.relevance_score}</Badge>
                    )}
                    {c.verification_score != null && (
                      <span className="text-[10px] text-muted-foreground">V{c.verification_score}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 min-w-0 min-h-0">
          <ContextStrip client={selectedClient} />

          {!selectedClient ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground text-sm" style={{ ...card }}>
              Select a lead to draft an email
            </div>
          ) : (
          <div style={{ ...card, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }} className="min-w-0">
            <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-bold text-foreground" style={{ fontFamily: "Syne,sans-serif" }}>Draft Email</div>
                  {currentDraftId && getTemplateForDraft(currentDraftId) && getTemplateForDraft(currentDraftId) !== "None" && (
                    <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                      {getTemplateForDraft(currentDraftId)}
                    </span>
                  )}
                  {singleApproved && <Badge color="green">Approved</Badge>}
                </div>
                {selectedClient && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedClient.business_name} · {selectedClient.email_found || selectedClient.primary_contact_email || "—"}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {renderTemperatureControl(true)}
                <button style={btnCompactGhost} onClick={handleGenerate} disabled={generating || !selectedClient}>
                  {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generating ? "Generating…" : "AI Generate"}
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
              <div style={{ borderBottom: "1px solid var(--border)" }}>
                <button
                  className="w-full py-2 flex items-center justify-between text-left"
                  onClick={() => setShowSingleTemplate(v => !v)}
                >
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                    Template / Instructions
                    {selectedTemplate && (
                      <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
                        {selectedTemplate.name}
                      </span>
                    )}
                  </div>
                  {showSingleTemplate ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {showSingleTemplate && (
                  <div className="pb-3">{renderTemplateContent()}</div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Subject</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Email subject line…"
                  className="w-full rounded-lg px-3 py-2 text-[13px] text-foreground outline-none"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
                />
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">Body</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write or generate your email body…"
                  className="flex-1 w-full rounded-lg px-3 py-2.5 text-[13px] text-foreground outline-none resize-none"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", minHeight: 280, lineHeight: 1.8 }}
                />
                {body && <div className="text-[11px] text-muted-foreground mt-1 text-right">{body.length} chars</div>}
              </div>

              <div>
                <input
                  value={regenerateInstructions}
                  onChange={e => setRegenerateInstructions(e.target.value)}
                  placeholder="Add instructions for next generation..."
                  className="w-full rounded-lg px-3 py-2 text-[13px] text-foreground outline-none"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  {currentDraftId && (
                    <button
                      style={{
                        ...btnCompact,
                        ...(singleApproved ? { background: "rgba(16,185,129,0.15)", color: "var(--chart-2)", border: "1px solid rgba(16,185,129,0.3)" } : {}),
                      }}
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
                      style={btnCompactGhost}
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
                  <button style={btnCompactGhost} onClick={() => handleRegenerate(regenerateInstructions)} disabled={generating || !selectedClient}>
                    <RefreshCw className="h-3.5 w-3.5" />Regenerate
                  </button>
                  <button
                    style={{ ...btnCompactGhost, color: "var(--destructive)" }}
                    onClick={() => { setSubject(""); setBody(""); setCurrentDraftId(null); setRegenerateInstructions(""); setSingleApproved(false); }}
                  >
                    Discard
                  </button>
                </div>
                <button
                  style={btnCompact}
                  onClick={handleSend}
                  disabled={!currentDraftId || (!subject && !body)}
                >
                  <Send className="h-3.5 w-3.5" />Send
                </button>
              </div>

              <button
                disabled={scheduling}
                onClick={async () => {
                  setScheduling(true);
                  try {
                    toast.success("Follow-up scheduled for 3 days");
                  } catch { toast.error("Could not schedule follow-up"); }
                  finally { setScheduling(false); }
                }}
                className="px-3 py-1.5 text-[12px] rounded border text-muted-foreground hover:bg-accent disabled:opacity-50"
                style={{ borderColor: "var(--border)" }}
              >
                {scheduling ? "Scheduling..." : "Schedule Follow-up in 3 days"}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    );
  };

  const renderCampaign = () => {
    if (campaignPhase === "select") {
      return (
        <div className="grid gap-4" style={{ gridTemplateColumns: "360px 1fr", height: "calc(100vh - 140px)" }}>
          {renderCampaignClientPanel(true)}
          <div className="space-y-3 overflow-y-auto min-h-0">
            <SendingAsCard />
            <div style={card} className="p-4">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Template</div>
              {renderTemplateContent(true)}
            </div>
            <GenerationSettingsCard />
          </div>
        </div>
      );
    }

    if (campaignPhase === "generating") {
      const totalCount = selectedClientIds.length;
      const completedCount = Object.values(campaignDrafts).filter(
        d => d.status === "generated" || d.status === "pending_review" || d.status === "failed" || d.status === "no_email" || d.status === "sent" || d.status === "approved"
      ).length;
      const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

      return (
        <div className="grid gap-4" style={{ gridTemplateColumns: "360px 1fr", height: "calc(100vh - 140px)" }}>
          {renderCampaignClientPanel(false)}
          <div className="space-y-3 min-h-0 flex flex-col">
            <div style={card} className="p-4">
              <div className="text-sm font-bold text-foreground mb-2" style={{ fontFamily: "Syne,sans-serif" }}>
                Generating emails… {completedCount} of {totalCount} complete
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--primary)" }} />
              </div>
            </div>

            <div style={{ ...card, flex: 1, overflow: "hidden" }}>
              <div className="overflow-y-auto max-h-full">
                {selectedClientIds.map((id, i) => {
                  const client = campaignClients.find(c => getClientId(c) === id);
                  const draft = campaignDrafts[id];
                  return (
                    <div
                      key={id}
                      className="px-4 py-2.5 flex items-center gap-3"
                      style={{ minHeight: 48, borderBottom: i < selectedClientIds.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {draft?.status === "pending" && <div className="w-3 h-3 rounded-full bg-[#5a6478] opacity-50" />}
                        {draft?.status === "generating" && <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />}
                        {(draft?.status === "generated" || draft?.status === "pending_review") && <Check className="h-4 w-4 text-green-500" />}
                        {draft?.status === "no_email" && <Mail className="h-4 w-4 text-amber-400" />}
                        {draft?.status === "failed" && <X className="h-4 w-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-foreground truncate">{client?.business_name || "Unknown"}</div>
                        {draft?.status === "generating" && <div className="text-[11px] text-muted-foreground mt-0.5">Generating…</div>}
                        {(draft?.status === "generated" || draft?.status === "pending_review") && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{draft.subject}</div>}
                        {draft?.status === "no_email" && <div className="text-[11px] text-amber-400 mt-0.5">No email address</div>}
                        {draft?.status === "failed" && <div className="text-[11px] text-red-500 mt-0.5">Failed</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (campaignPhase === "review" && campaignView === "email-detail" && detailClient) {
      const clientId = getClientId(detailClient);
      const isLoading = detailPolling || regenerating;
      const canSend = detailDraft?.status === "pending_review" || detailDraft?.status === "approved" || detailDraft?.status === "generated";
      const activeTemplateLabel = selectedTemplate?.name || (getEffectiveTemplateContent() ? "Custom" : "None");

      return (
        <div className="flex flex-col max-w-4xl mx-auto w-full" style={{ height: "calc(100vh - 140px)" }}>
          <div className="flex items-center justify-between mb-4 gap-4 shrink-0">
            <button
              type="button"
              className="text-sm text-[#5a6478] hover:text-[#e8edf5] transition-colors"
              onClick={() => {
                stopDetailPolling();
                setCampaignView("review");
                setDetailClient(null);
                setDetailDraft(null);
                setDetailSessionContext(null);
                setRegenInstructions("");
                setShowDetailRefine(false);
              }}
            >
              ← Back to Drafts
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-foreground truncate">{detailClient.business_name || "Unknown"}</div>
              <div className="text-xs text-muted-foreground truncate">{detailClient.website || "—"}</div>
            </div>
            {detailStatusBadge(detailDraft?.status)}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            <ContextStrip client={detailClient} />

            {isLoading ? (
              <div style={card} className="p-6 space-y-4">
                <div className="animate-pulse rounded h-5 w-3/4" style={{ background: "var(--muted)" }} />
                <div className="animate-pulse rounded h-5 w-1/2" style={{ background: "var(--muted)" }} />
                <div className="space-y-2 pt-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded h-3"
                      style={{ background: "var(--muted)", width: `${85 - (i % 4) * 12}%` }}
                    />
                  ))}
                </div>
              </div>
            ) : campaignDrafts[clientId]?.status === "no_email" ? (
              <div style={card} className="p-6 text-sm text-muted-foreground">
                Cannot process — no email address found
              </div>
            ) : detailDraft ? (
              <div style={card} className={`p-6 transition-opacity duration-300 ${detailFadeIn ? "opacity-100" : "opacity-90"}`}>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Subject</div>
                <h2 className="text-lg font-semibold text-foreground mb-4">{detailDraft.subject}</h2>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Body</div>
                <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{detailDraft.body}</div>
              </div>
            ) : (
              <div style={card} className="p-6 text-sm text-muted-foreground">
                No draft yet. Expand &ldquo;Refine this email&rdquo; below to add instructions and generate.
              </div>
            )}

            {detailDraft && !isLoading && (
              <div className="flex gap-3">
                <button
                  type="button"
                  style={btnPrimary}
                  disabled={!canSend || detailDraft.status === "sent"}
                  onClick={handleDetailApproveAndSend}
                >
                  Approve & Send
                </button>
                <button
                  type="button"
                  style={{ ...btnGhost, color: "var(--destructive)", borderColor: "rgba(239,68,68,0.3)" }}
                  onClick={handleDetailDeleteDraft}
                >
                  Delete Draft
                </button>
              </div>
            )}

            <div style={card} className="overflow-hidden">
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center justify-between text-left"
                onClick={() => setShowDetailRefine(v => !v)}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[13px] font-semibold text-foreground">
                    {detailDraft ? "Refine this email" : "Generate email"}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
                    {activeTemplateLabel}
                  </span>
                </div>
                {showDetailRefine ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {showDetailRefine && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-[11px] text-muted-foreground pt-3">
                    Using template: {activeTemplateLabel}
                  </p>
                  {detailSessionContext && (
                    <p className="text-xs text-[#5a6478] italic mt-1">
                      Context: {detailSessionContext}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {detailDraft
                      ? "Add instructions and regenerate. Exporter profile, lead data, AI context, and your template are sent to the LLM automatically."
                      : "Optional instructions for generation. Exporter profile, lead data, AI context, and your selected template are sent to the LLM automatically."}
                  </p>
                  <textarea
                    value={regenInstructions}
                    onChange={e => setRegenInstructions(e.target.value)}
                    placeholder="e.g. Make it shorter, focus on linen fabrics, use a more formal tone..."
                    className="w-full rounded-lg px-3 py-2 text-[13px] text-foreground outline-none resize-none"
                    style={{ background: "var(--muted)", border: "1px solid var(--border)", minHeight: 100, lineHeight: 1.6 }}
                  />
                  {detailDraft ? (
                    <button
                      type="button"
                      style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}
                      disabled={regenerating || !detailDraft?.id || campaignDrafts[clientId]?.status === "no_email"}
                      onClick={handleDetailRegenerate}
                    >
                      {regenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {regenerating ? "Regenerating…" : "Regenerate with instructions"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}
                      disabled={regenerating || campaignDrafts[clientId]?.status === "no_email"}
                      onClick={handleDetailGenerate}
                    >
                      {regenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {regenerating ? "Generating…" : "Generate Email"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (campaignPhase === "review") {
      const approvedCount = Object.values(campaignDrafts).filter(d => d.status === "approved").length;
      const failedCount = Object.values(campaignDrafts).filter(d => d.status === "failed").length;
      const pendingCount = Object.values(campaignDrafts).filter(
        d => d.status === "generated" || d.status === "pending_review"
      ).length;
      const approvableStatuses: DraftStatus[] = ["generated", "pending_review"];

      return (
        <div className="flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => {
                  setCampaignPhase("select");
                  setCampaignView("setup");
                  setCampaignDrafts({});
                }}
              >
                ← Back to Setup
              </button>
              <div className="text-sm font-bold text-foreground" style={{ fontFamily: "Syne,sans-serif" }}>Review Drafts</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                style={btnGhost}
                onClick={async () => {
                  const toApprove = Object.entries(campaignDrafts)
                    .filter(([, d]) => approvableStatuses.includes(d.status))
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
              {approvedCount > 0 && (
                <button style={btnPrimary} onClick={handleCampaignSend}>
                  <Send className="h-3.5 w-3.5" />
                  Send Approved ({approvedCount})
                </button>
              )}
            </div>
          </div>

          <div style={{ ...card, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
                    style={{ background: "#0a0d12", position: "sticky", top: 0, zIndex: 1 }}
                  >
                    <th className="text-left px-3 py-2">Client</th>
                    <th className="text-left px-3 py-2">Subject</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2 w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(campaignDrafts).map((id, i) => {
                    const client = campaignClients.find(c => getClientId(c) === id);
                    const draft = campaignDrafts[id];
                    const showView = isViewableDraftStatus(draft.status);
                    const isSent = draft.status === "sent";

                    return (
                      <tr
                        key={id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: i % 2 === 0 ? "#0d1117" : "#0f1420",
                        }}
                      >
                        <td className="px-3 py-2">
                          <div className="text-[13px] font-semibold text-foreground">{client?.business_name || "Unknown"}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {getClientEmail(client) || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[12px] max-w-xs truncate">
                          {draft.status === "no_email" ? (
                            <span className="text-muted-foreground">Cannot process — no email address found</span>
                          ) : (
                            <span className="text-foreground">{draft.subject || "—"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{draftStatusBadge(draft.status)}</td>
                        <td className="px-3 py-2">
                          {showView && client && (
                            <button
                              type="button"
                              className={`text-[12px] font-semibold bg-transparent border-none cursor-pointer p-0 ${
                                isSent ? "text-muted-foreground" : "text-[#60a5fa] hover:text-[#93c5fd]"
                              }`}
                              onClick={() => openEmailDetail(client)}
                            >
                              {isSent ? "View" : "View →"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="flex items-center justify-between px-4 py-3 mt-3 rounded-lg shrink-0"
            style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)" }}
          >
            <div className="text-[12px] text-muted-foreground">
              {approvedCount} approved · {failedCount} failed · {pendingCount} pending
            </div>
            {approvedCount > 0 && (
              <button style={btnPrimary} onClick={handleCampaignSend}>
                <Send className="h-3.5 w-3.5" />
                Send Approved ({approvedCount})
              </button>
            )}
          </div>
        </div>
      );
    }


    if (campaignPhase === "done") {
      const sentCount = Object.values(campaignDrafts).filter(d => d.status === "sent").length;
      return (
        <div style={card} className="p-24 flex items-center justify-center">
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <div className="text-lg font-bold text-foreground mb-4" style={{ fontFamily: "Syne,sans-serif" }}>
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
                setCampaignView("setup");
                setDetailClient(null);
                setDetailDraft(null);
                stopDetailPolling();
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

  return (
    <div className="p-6 space-y-5 page-enter">
      <div className="flex gap-1.5 mb-1">
        {[
          { key: "dashboard", label: "Dashboard" },
          { key: "campaign", label: "Campaign" },
          { key: "single", label: "Single Send" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="px-4 py-2 text-[13px] font-semibold transition-all"
            style={activeTab === t.key
              ? { background: "var(--primary)", color: "white", border: "none", borderRadius: 999 }
              : { background: "transparent", border: "1px solid var(--border)", color: "var(--muted-foreground)", borderRadius: 999 }}
          >
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
