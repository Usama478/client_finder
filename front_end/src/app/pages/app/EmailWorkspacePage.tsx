import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Mail, Send, RefreshCw, Eye, CheckCircle, XCircle, MousePointerClick, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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

const recipients = [
  { id:"1", name:"TechCorp Industries",  email:"info@techcorp.ae",          verify:92, relevance:94, status:"sent",    statusLabel:"Sent" },
  { id:"2", name:"Global Exports Ltd",   email:"contact@globalexports.com", verify:85, relevance:88, status:"opened",  statusLabel:"Opened" },
  { id:"3", name:"Middle East Partners", email:"info@mepartners.ae",        verify:88, relevance:82, status:"draft",   statusLabel:"Draft" },
  { id:"4", name:"Meridian Supply GmbH", email:"info@meridian-supply.de",   verify:91, relevance:86, status:"replied", statusLabel:"Replied" },
  { id:"5", name:"Emirates Trading Co",  email:"sales@emiratestrading.ae",  verify:78, relevance:91, status:"draft",   statusLabel:"Draft" },
];

const chartData = [
  {day:"Mon", sent:12, opened:4, replied:1},{day:"Tue",sent:28,opened:9,replied:3},{day:"Wed",sent:18,opened:7,replied:2},{day:"Thu",sent:34,opened:14,replied:5},{day:"Fri",sent:22,opened:8,replied:2},{day:"Sat",sent:8,opened:2,replied:0},{day:"Sun",sent:14,opened:5,replied:1},
];

const GENERATED_SUBJECT = "Partnership Opportunity — Expanding Into Your Market";
const GENERATED_BODY = `Dear TechCorp Team,

I hope this message finds you well. I came across TechCorp Industries while researching leading B2B technology providers in the MENA region, and I'm genuinely impressed by your verified presence and track record in export markets.

We work with a network of international distributors and exporters, and based on your profile, I believe there's a strong mutual fit worth exploring.

I'd love to set up a brief 20-minute call to discuss how we might create value together — whether through distribution agreements, co-marketing, or market expansion partnerships.

Would next week work for you?

Best regards,
Ahmed K.
Client Finder Platform`;

export default function EmailWorkspacePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [apiRecipients, setApiRecipients] = useState<any[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [selectedRecipient, setSelectedRecipient] = useState(recipients[0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.sessions(user.user_id)
      .then(async sessions => {
        const allResults: any[] = [];
        for (const session of (sessions || []).slice(0, 5)) {
          const res = await api.results(session.search_id).catch(() => []);
          allResults.push(...(res || []));
        }
        const withEmail = allResults.filter(r => r.email_found);
        const recipientList = withEmail.slice(0, 20).map(r => ({
          id: String(r.result_id),
          name: r.business_name || "Unknown",
          email: r.email_found,
          verify: r.verification_score || 0,
          relevance: Math.round(r.relevance_score || 0),
          status: "draft",
          statusLabel: "Draft",
          businessId: r.result_id,
        }));
        setApiRecipients(recipientList);
        if (recipientList.length > 0) setSelectedRecipient(recipientList[0]);
      })
      .catch(console.error)
      .finally(() => setDraftsLoading(false));
  }, [user]);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    toast.loading("Generating personalised email…");
    try {
      const result = await api.generateEmail(
        Number(selectedRecipient.id), user.user_id);
      if (result.draft_id) {
        const draft = await api.emailDraftDetail(result.draft_id);
        setSubject(draft.subject || "");
        setBody(draft.body || "");
        toast.success("Email draft generated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!subject || !body) { toast.error("Generate or write an email first"); return; }
    toast.success(`Email approved for ${selectedRecipient.name}`);
    setSubject(""); setBody("");
  };

  const statusBadge = (s: string) => {
    if (s==="sent")    return <Badge color="blue">📤 Sent</Badge>;
    if (s==="opened")  return <Badge color="green">👁 Opened</Badge>;
    if (s==="replied") return <Badge color="green">💬 Replied</Badge>;
    if (s==="bounced") return <Badge color="red">✗ Bounced</Badge>;
    return <Badge color="gray">Draft</Badge>;
  };

  const displayRecipients = apiRecipients.length > 0 ? apiRecipients : recipients;

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* Analytics row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { icon:Mail,            label:"Drafted",     value:"23",  color:"#3b82f6" },
          { icon:Send,            label:"Sent",        value:"156", color:"#10b981" },
          { icon:Eye,             label:"Opened",      value:"98",  color:"#8b5cf6" },
          { icon:MousePointerClick,label:"Clicked",    value:"34",  color:"#f59e0b" },
          { icon:XCircle,         label:"Bounced",     value:"3",   color:"#ef4444" },
          { icon:MessageSquare,   label:"Replied",     value:"14",  color:"#10b981" },
        ].map((s,i) => {
          const Icon=s.icon;
          return (
            <div key={i} style={card} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest">{s.label}</div>
                <Icon className="h-3.5 w-3.5" style={{color:s.color,opacity:0.7}} />
              </div>
              <div className="text-2xl font-bold text-[#e8edf5]" style={{fontFamily:"Syne,sans-serif"}}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Main workspace */}
      <div className="grid gap-4" style={{gridTemplateColumns:"260px 1fr"}}>

        {/* Recipient list */}
        <div style={card} className="overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <div className="text-[11px] font-bold text-[#5a6478] uppercase tracking-widest">Recipients</div>
            <button style={{...btnGhost,padding:"4px 8px",fontSize:11}} onClick={()=>navigate("/app/clients")}>+ Add</button>
          </div>
          <div>
            {displayRecipients.map((r,i) => (
              <div key={r.id}
                className="px-3 py-3 cursor-pointer transition-colors"
                style={{
                  borderBottom: i<displayRecipients.length-1?"1px solid rgba(255,255,255,0.05)":"none",
                  background: selectedRecipient.id===r.id ? "rgba(59,130,246,0.06)" : "transparent",
                }}
                onClick={()=>setSelectedRecipient(r)}>
                <div className="text-[13px] font-semibold text-[#e8edf5] truncate">{r.name}</div>
                <div className="text-[11px] text-[#5a6478] truncate mt-0.5">{r.email}</div>
                <div className="mt-1.5">{statusBadge(r.status)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Draft editor */}
        <div style={card} className="flex flex-col">
          <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <div>
              <div className="text-sm font-bold text-[#e8edf5]" style={{fontFamily:"Syne,sans-serif"}}>Draft Email</div>
              <div className="text-[11px] text-[#5a6478] mt-0.5">To: {selectedRecipient.name} &lt;{selectedRecipient.email}&gt;</div>
            </div>
            <div className="flex gap-2">
              <button style={btnGhost} onClick={handleGenerate} disabled={generating}>
                {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin"/> : <Sparkles className="h-3.5 w-3.5"/>}
                {generating ? "Generating…" : "AI Generate"}
              </button>
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col gap-3">
            {/* Subject */}
            <div>
              <label className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest block mb-1.5">Subject</label>
              <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Email subject line…"
                className="w-full rounded-lg px-3 py-2 text-[13px] text-[#e8edf5] outline-none"
                style={{background:"#151a22",border:"1px solid rgba(255,255,255,0.09)"}} />
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col">
              <label className="text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest block mb-1.5">Body</label>
              <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write or generate your email body…"
                className="flex-1 w-full rounded-lg px-3 py-2.5 text-[13px] text-[#e8edf5] outline-none resize-none"
                style={{background:"#151a22",border:"1px solid rgba(255,255,255,0.09)",minHeight:240,lineHeight:1.7}} />
              {body && <div className="text-[11px] text-[#5a6478] mt-1 text-right">{body.length} chars</div>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button style={btnPrimary} onClick={handleSend}><Send className="h-3.5 w-3.5"/>Approve & Send</button>
              <button style={btnGhost} onClick={()=>toast.success("Draft saved!")}>Save Draft</button>
              <button style={btnGhost} onClick={handleGenerate}><RefreshCw className="h-3.5 w-3.5"/>Regenerate</button>
              <button style={{...btnGhost,marginLeft:"auto",color:"#ef4444"}} onClick={()=>{setSubject("");setBody("");}}>Discard</button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={card} className="p-5">
        <div className="text-[11px] font-bold text-[#5a6478] uppercase tracking-widest mb-4">Email Activity — Last 7 Days</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{left:0,right:0,top:4,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{fill:"#8a95a8",fontSize:11}} axisLine={false} tickLine={false} />
            <YAxis tick={{fill:"#8a95a8",fontSize:11}} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{background:"#151a22",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#e8edf5",fontSize:12}} />
            <Line type="monotone" dataKey="sent"    stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="opened"  stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="replied" stroke="#8b5cf6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2">
          {[{label:"Sent",color:"#3b82f6"},{label:"Opened",color:"#10b981"},{label:"Replied",color:"#8b5cf6"}].map(l=>(
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{background:l.color}}/>
              <span className="text-[11px] text-[#8a95a8]">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
