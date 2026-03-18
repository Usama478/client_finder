import { Link, useNavigate } from "react-router";
import { Search, Target, ShieldCheck, Users, Mail, Activity, ArrowRight, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const S = {
  card: { background: "#0f1218", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 } as React.CSSProperties,
  cardHover: "transition-all duration-150 hover:border-white/12",
  label: "text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest mb-2" as const,
  value: "text-[#e8edf5]" as const,
  muted: "text-[#8a95a8]" as const,
  section: "text-[11px] font-bold text-[#5a6478] uppercase tracking-widest mb-3" as const,
};

const Badge = ({ children, color }: { children: React.ReactNode; color: "green" | "blue" | "amber" | "red" | "purple" | "gray" }) => {
  const map = {
    green:  { bg: "rgba(16,185,129,0.1)",  text: "#10b981" },
    blue:   { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa" },
    amber:  { bg: "rgba(245,158,11,0.1)",   text: "#f59e0b" },
    red:    { bg: "rgba(239,68,68,0.1)",    text: "#ef4444" },
    purple: { bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
    gray:   { bg: "rgba(255,255,255,0.05)", text: "#8a95a8" },
  };
  const c = map[color];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: c.bg, color: c.text }}>{children}</span>
  );
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const kpis = [
    { label: "Total Searches", value: "142",  delta: "↑ 12 this week", icon: Search,      color: "#3b82f6" },
    { label: "Leads Found",    value: "3.8k",  delta: "↑ 340 today",   icon: Activity,     color: "#8b5cf6" },
    { label: "Relevant Leads", value: "1.2k",  delta: "↑ 89 this week",icon: Target,       color: "#10b981" },
    { label: "Verified",       value: "847",   delta: "↑ 34 today",    icon: ShieldCheck,  color: "#f59e0b" },
    { label: "Saved Clients",  value: "47",    delta: "↑ 6 this week", icon: Users,        color: "#10b981" },
    { label: "Emails Sent",    value: "312",   delta: "28% open rate",  icon: Mail,         color: "#3b82f6" },
  ];

  const pipeline = [
    { stage: "Search",       count: "3.8k", icon: "🔍", path: "/app/search",  active: true  },
    { stage: "Relevancy",    count: "1.2k", icon: "🤖", path: "/app/search",  active: false },
    { stage: "Verification", count: "847",  icon: "🔒", path: "/app/clients", active: false },
    { stage: "Clients",      count: "47",   icon: "⭐", path: "/app/clients", active: false },
    { stage: "Outreach",     count: "312",  icon: "✉️", path: "/app/email",   active: false },
  ];

  const recentSearches = [
    { query: "Textile exporters Lahore Pakistan", context: "B2B Outreach", time: "2h ago",  results: 284, status: "done" },
    { query: "Wholesale distributors UAE",        context: "Export Context",time: "5h ago",  results: 156, status: "scoring" },
    { query: "Construction suppliers Germany",    context: "Default",       time: "1d ago",  results: 412, status: "done" },
  ];

  const funnel = [
    { stage: "Leads Found", count: 3800, fill: "#3b82f6" },
    { stage: "Relevant",    count: 1200, fill: "#8b5cf6" },
    { stage: "Verified",    count: 847,  fill: "#10b981" },
    { stage: "Clients",     count: 47,   fill: "#f59e0b" },
  ];

  const nextActions = [
    { icon: "🤖", text: "156 leads ready for AI relevance scoring",  badge: { label: "Pending", color: "amber" as const }, path: "/app/search"  },
    { icon: "🔒", text: "89 relevant leads ready for verification",   badge: { label: "Ready",   color: "blue"  as const }, path: "/app/clients" },
    { icon: "✉️", text: "14 verified clients ready for outreach",     badge: { label: "New",     color: "green" as const }, path: "/app/email"   },
  ];

  const activity = [
    { dot: "#10b981", text: <><strong className="text-[#e8edf5]">Email sent</strong> to Global Textiles Ltd — Partnership Proposal</>, time: "8m ago"  },
    { dot: "#3b82f6", text: <><strong className="text-[#e8edf5]">Verification complete</strong> — 34 leads verified from UAE Wholesale search</>,  time: "42m ago" },
    { dot: "#8b5cf6", text: <><strong className="text-[#e8edf5]">AI relevance scored</strong> 156 leads from Textile exporters Lahore search</>, time: "2h ago"  },
    { dot: "#f59e0b", text: <><strong className="text-[#e8edf5]">Client saved</strong> — Meridian Exports GmbH added to clients</>,             time: "3h ago"  },
    { dot: "#3b82f6", text: <><strong className="text-[#e8edf5]">Search started</strong> — "Construction suppliers Germany" · 412 results</>,  time: "1d ago"  },
  ];

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} style={S.card} className={`p-4 cursor-pointer ${S.cardHover}`} onClick={() => navigate("/app/search")}>
              <div className="flex items-start justify-between mb-2">
                <div className={S.label}>{k.label}</div>
                <div className="w-6 h-6 rounded flex items-center justify-center opacity-60" style={{ background: `${k.color}20` }}>
                  <Icon style={{ color: k.color }} className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif", color: "#e8edf5" }}>{k.value}</div>
              <div className="text-[11px] mt-1" style={{ color: "#10b981" }}>{k.delta}</div>
            </div>
          );
        })}
      </div>

      {/* Pipeline */}
      <div style={S.card} className="p-5">
        <div className={S.section}>Pipeline Overview</div>
        <div className="flex items-stretch gap-0">
          {pipeline.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <Link to={s.path} className="flex-1">
                <div className={`flex flex-col items-center p-4 rounded-lg cursor-pointer transition-all text-center
                  ${s.active ? "border border-blue-500/30 bg-blue-500/5" : "border border-white/5 bg-[#151a22] hover:bg-[#1c2230]"}`}>
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-[10px] font-semibold text-[#8a95a8] uppercase tracking-wider">{s.stage}</div>
                  <div className="text-xl font-bold mt-1 text-[#e8edf5]" style={{ fontFamily: "Syne, sans-serif" }}>{s.count}</div>
                </div>
              </Link>
              {i < pipeline.length - 1 && (
                <ArrowRight className="h-4 w-4 text-[#5a6478] flex-shrink-0 mx-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Two column */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Recent Searches */}
        <div style={S.card} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className={S.section} style={{ marginBottom: 0 }}>Recent Searches</div>
            <Link to="/app/search" className="text-[11px] text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <div className="space-y-2">
            {recentSearches.map((s, i) => (
              <div key={i} onClick={() => navigate("/app/search")}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-[#151a22]"
                style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: "rgba(59,130,246,0.1)" }}>🔍</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#e8edf5] truncate">{s.query}</div>
                  <div className="text-[11px] text-[#5a6478] mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {s.context} · {s.time}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-[#e8edf5]" style={{ fontFamily: "Syne, sans-serif" }}>{s.results}</div>
                  {s.status === "done"
                    ? <Badge color="green">Done</Badge>
                    : <Badge color="blue">Scoring</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Actions + Funnel */}
        <div className="space-y-4">
          <div style={S.card} className="p-5">
            <div className={S.section}>Next Actions</div>
            <div className="space-y-2">
              {nextActions.map((a, i) => (
                <div key={i} onClick={() => navigate(a.path)}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-[#151a22]"
                  style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-base">{a.icon}</span>
                  <div className="flex-1 text-[13px] text-[#e8edf5]">{a.text}</div>
                  <Badge color={a.badge.color}>{a.badge.label}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div style={S.card} className="p-5">
            <div className={S.section}>Funnel Conversion</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" width={72} tick={{ fill: "#8a95a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#151a22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e8edf5", fontSize: 12 }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "#8a95a8", fontSize: 11 }}>
                  {funnel.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div style={S.card} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className={S.section} style={{ marginBottom: 0 }}>Recent Activity</div>
          <Link to="/app/activity" className="text-[11px] text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        <div className="space-y-0 divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {activity.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-3">
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: a.dot }}></div>
              <div className="flex-1 text-[13px] text-[#8a95a8]">{a.text}</div>
              <div className="text-[11px] text-[#5a6478] whitespace-nowrap">{a.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
