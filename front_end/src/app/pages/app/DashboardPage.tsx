import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router";
import { Search, Target, ShieldCheck, Users, Mail, Activity, ArrowRight, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { useAuth } from "../../../lib/auth-context"
import { api, DashboardStats, SearchSession } from "../../../lib/api"

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const S = {
  card: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 } as React.CSSProperties,
  cardHover: "transition-all duration-150 hover:border-white/12",
  label: "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2" as const,
  labelStrong: "text-[10px] font-semibold uppercase tracking-widest mb-2 text-foreground/60" as const,
  value: "text-foreground" as const,
  muted: "text-muted-foreground" as const,
  section: "text-[11px] font-bold uppercase tracking-widest mb-3 text-foreground/60" as const,
};

const Badge = ({ children, color }: { children: React.ReactNode; color: "green" | "blue" | "amber" | "red" | "purple" | "gray" }) => {
  const map = {
    green:  { bg: "rgba(16,185,129,0.1)",  text: "var(--chart-2)" },
    blue:   { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa" },
    amber:  { bg: "rgba(245,158,11,0.1)",   text: "var(--chart-3)" },
    red:    { bg: "rgba(239,68,68,0.1)",    text: "var(--destructive)" },
    purple: { bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
    gray:   { bg: "var(--border)", text: "var(--muted-foreground)" },
  };
  const c = map[color];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: c.bg, color: c.text }}>{children}</span>
  );
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [sessions, setSessions] = useState<SearchSession[]>([])
  const [credits, setCredits] = useState<{ credits_remaining: number; allocated_total: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<"7d" | "30d" | "all">("all")

  useEffect(() => {
    if (!user) return
    setIsLoading(true)
    Promise.all([
      api.dashboardStats().catch(() => null),
      api.sessions().catch(() => []),
      api.credits().catch(() => null),
    ]).then(([s, sess, creds]) => {
      setStats(s)
      setSessions(sess || [])
      setCredits(creds)
      setIsLoading(false)
    })
  }, [user])

  // KPI cards = OUTCOME metrics (what came out of each stage).
  const kpis = [
    { label: "Saved Clients",  value: stats ? String(stats.saved_clients   ?? stats.total_clients    ?? 0) : "—", delta: "", icon: Users,       color: "var(--chart-2)", path: "/app/clients" },
    { label: "Verified",       value: stats ? String(stats.verified_count  ?? stats.verified_clients ?? 0) : "—", delta: "", icon: ShieldCheck, color: "var(--chart-3)", path: "/app/leads?filter=verified" },
    { label: "Leads Found",    value: stats ? String(stats.leads_found     ?? 0) : "—",                            delta: "", icon: Activity,    color: "#8b5cf6",        path: "/app/leads?filter=all" },
    { label: "Relevant Leads", value: stats ? String(stats.relevant_leads  ?? 0) : "—",                            delta: "", icon: Target,      color: "var(--chart-2)", path: "/app/leads?filter=relevant" },
  ];

  // Pipeline Overview = VOLUME metrics (what was processed through each stage).
  // NOTE: Relevancy uses `relevancy_processed` (all classified leads), NOT
  // `relevant_leads` (only those that passed). These are intentionally different.
  const pipeline = [
    { stage: "Search",       count: stats?.total_searches         ?? "—", icon: Search,      path: "/app/search",  active: true  },
    { stage: "Relevancy",    count: stats?.relevancy_processed    ?? "—", icon: Target,      path: "/app/leads?filter=relevant",  active: false },
    { stage: "Verification", count: stats?.verification_processed ?? "—", icon: ShieldCheck, path: "/app/clients", active: false },
    { stage: "Clients",      count: stats?.clients_count          ?? stats?.total_clients ?? "—", icon: Users, path: "/app/clients", active: false },
    { stage: "Outreach",     count: stats?.emails_drafted         ?? "—", icon: Mail,        path: "/app/email",   active: false },
  ];

  const funnel = [
    { stage: "Leads Found", count: stats?.leads_found ?? 0, fill: "var(--primary)" },
    { stage: "Relevant",    count: stats?.relevant_leads ?? 0, fill: "#8b5cf6" },
    { stage: "Verified",    count: stats?.verified_passed ?? 0,  fill: "var(--chart-2)" },
    { stage: "Clients",     count: stats?.total_clients ?? 0,   fill: "var(--chart-3)" },
  ];

  const creditsUsed = credits ? (credits.allocated_total - credits.credits_remaining) : 0;
  const creditsData = [
    { name: "Used", value: creditsUsed, fill: "var(--chart-3)" },
    { name: "Remaining", value: credits?.credits_remaining ?? 0, fill: "var(--chart-2)" },
  ];

  const nextActions = [
    { icon: Target, text: `${stats?.pending_relevancy ?? 0} leads ready for AI relevance scoring`,  badge: { label: "Pending", color: "amber" as const }, path: "/app/leads?filter=pending_relevancy" },
    { icon: ShieldCheck, text: `${stats?.pending_verification ?? 0} relevant leads ready for verification`,   badge: { label: "Ready",   color: "blue"  as const }, path: "/app/leads?filter=pending_verification" },
    { icon: Users, text: `${stats?.verified_clients ?? 0} verified clients ready for outreach`,     badge: { label: "New",     color: "green" as const }, path: "/app/email?filter=verified" },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-5 page-enter">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={S.card} className="p-4 animate-pulse">
              <div className="h-3 w-20 rounded bg-white/5 mb-3" />
              <div className="h-7 w-12 rounded bg-white/8 mb-2" />
            </div>
          ))}
        </div>
        <div style={S.card} className="p-5 animate-pulse">
          <div className="h-3 w-32 rounded bg-white/5 mb-4" />
          <div className="h-40 rounded-lg bg-white/5" />
        </div>
        <div style={S.card} className="p-5 animate-pulse">
          <div className="h-3 w-32 rounded bg-white/5 mb-4" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 h-20 rounded-lg bg-white/5" />
            ))}
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={S.card} className="p-5 animate-pulse space-y-3">
              <div className="h-3 w-28 rounded bg-white/5" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 rounded-lg bg-white/5" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* Time Filter */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Overview</span>
        <div className="flex gap-2">
          {([
            { key: "7d", label: "7 days" },
            { key: "30d", label: "30 days" },
            { key: "all", label: "All time" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setTimeFilter(f.key)}
              style={timeFilter === f.key ? undefined : { borderColor: "var(--muted-foreground)" }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                timeFilter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} style={S.card} className={`p-4 cursor-pointer ${S.cardHover}`} onClick={() => navigate(k.path)}>
              <div className="flex items-start justify-between mb-2">
                <div className={S.labelStrong}>{k.label}</div>
                <div className="w-6 h-6 rounded flex items-center justify-center opacity-60" style={{ background: `${k.color}20` }}>
                  <Icon style={{ color: k.color }} className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif", color: "var(--foreground)" }}>{k.value}</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--chart-2)" }}>{k.delta}</div>
            </div>
          );
        })}
      </div>

      {/* Funnel Hero */}
      <div style={S.card} className="p-5">
        <div className={S.section}>Pipeline Funnel</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="stage" width={90} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 12 }}
              cursor={{ fill: "var(--border)" }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "var(--muted-foreground)", fontSize: 11 }}>
              {funnel.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pipeline */}
      <div style={S.card} className="p-5">
        <div className={S.section}>Pipeline Overview</div>
        <div className="flex items-stretch gap-0">
          {pipeline.map((s, i) => {
            const StageIcon = s.icon;
            return (
              <div key={i} className="flex items-center flex-1">
                <Link to={s.path} className="flex-1">
                  <div className={`flex flex-col items-center p-4 rounded-lg cursor-pointer transition-all text-center
                    ${s.active ? "border border-blue-500/30 bg-blue-500/5" : "border border-white/5 bg-muted hover:bg-accent"}`}>
                    <StageIcon className="h-5 w-5 mb-1 text-muted-foreground" />
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.stage}</div>
                    <div className="text-xl font-bold mt-1 text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>{s.count}</div>
                  </div>
                </Link>
                {i < pipeline.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mx-1" />
                )}
              </div>
            );
          })}
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
          {sessions.length > 0 ? (
            <div className="space-y-2">
              {sessions.slice(0, 3).map((s: SearchSession, i: number) => {
                const displayData = {
                  query: s.search_query || "Search",
                  context: s.context_name || "Default",
                  time: s.created_at ? getRelativeTime(s.created_at) : "",
                  results: s.results_count ?? 0,
                  status: s.status || "done"
                };
                
                return (
                  <div key={i} onClick={() => navigate("/app/search", { state: { sessionId: s.search_id } })}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted"
                    style={{ border: "1px solid var(--border)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: "rgba(59,130,246,0.1)" }}>🔍</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{displayData.query}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {displayData.context} · {displayData.time}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>{displayData.results}</div>
                      {displayData.status === "done"
                        ? <Badge color="green">Done</Badge>
                        : <Badge color="blue">Scoring</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">No recent searches.</div>
          )}
        </div>

        {/* Credits + Next Actions */}
        <div className="space-y-4">
          <div style={{ ...S.card, position: "relative" }} className="p-5">
            <div className={S.section}>Credits</div>
            {credits ? (
              <>
                <div style={{ position: "relative" }}>
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={creditsData} dataKey="value" innerRadius={35} outerRadius={55} paddingAngle={2}>
                        {creditsData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-lg font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
                      {credits.credits_remaining}
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">left</div>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                  <div>Used: {creditsUsed}</div>
                  <div>Total: {credits.allocated_total}</div>
                </div>
              </>
            ) : (
              <div className="h-[120px] rounded-lg bg-white/5 animate-pulse" />
            )}
          </div>

          <div style={S.card} className="p-5">
            <div className={S.section}>Next Actions</div>
            <div className="space-y-2">
              {nextActions.map((a, i) => {
                const ActionIcon = a.icon;
                return (
                  <div key={i} onClick={() => navigate(a.path)}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted"
                    style={{ border: "1px solid var(--border)" }}>
                    <ActionIcon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 text-[13px] text-foreground">{a.text}</div>
                    <Badge color={a.badge.color}>{a.badge.label}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
