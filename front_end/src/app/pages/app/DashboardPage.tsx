import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router";
import { Search, Target, ShieldCheck, Users, Mail, Activity, ArrowRight, Clock, Zap, Eye, Award, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area, Legend } from "recharts";
import { useAuth } from "../../../lib/auth-context"
import { api, DashboardStats, SearchSession, LeadQualityData, PipelineMomentumData } from "../../../lib/api"

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
  const [leadQuality, setLeadQuality] = useState<LeadQualityData | null>(null)
  const [momentum, setMomentum] = useState<PipelineMomentumData | null>(null)

  useEffect(() => {
    if (!user) return
    setIsLoading(true)
    Promise.all([
      api.dashboardStats().catch(() => null),
      api.sessions().catch(() => []),
      api.credits().catch(() => null),
      api.leadQuality().catch(() => null),
      api.pipelineMomentum(timeFilter).catch(() => null),
    ]).then(([s, sess, creds, lq, mom]) => {
      setStats(s)
      setSessions(sess || [])
      setCredits(creds)
      setLeadQuality(lq)
      setMomentum(mom)
      setIsLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    api.pipelineMomentum(timeFilter).catch(() => null).then(setMomentum)
  }, [timeFilter])

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

  // Formatting dates
  const today = new Date();
  const dateString = today.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Funnel Data
  const funnelStages = [
    { id: "discovered", label: "Discovered", count: stats?.leads_found ?? 0, icon: Eye, color: "blue" },
    { id: "scored", label: "Scored", count: stats?.relevancy_processed ?? 0, icon: Target, color: "purple" },
    { id: "verified", label: "Verified", count: stats?.verification_processed ?? 0, icon: ShieldCheck, color: "green" },
    { id: "clients", label: "Clients", count: stats?.total_clients ?? stats?.clients_count ?? 0, icon: Award, color: "amber" },
    { id: "outreach", label: "Outreach", count: stats?.emails_drafted ?? 0, icon: Send, color: "gray" }
  ];

  const getBorderColorClass = (color: string) => {
    switch (color) {
      case "blue": return "border-l-[3px] border-l-[#3b82f6]";
      case "purple": return "border-l-[3px] border-l-[#8b5cf6]";
      case "green": return "border-l-[3px] border-l-emerald-500";
      case "amber": return "border-l-[3px] border-l-amber-500";
      case "gray": return "border-l-[3px] border-l-slate-400";
      default: return "";
    }
  };

  const getIconColorClass = (color: string) => {
    switch (color) {
      case "blue": return "bg-blue-500/10 text-blue-500";
      case "purple": return "bg-purple-500/10 text-purple-500";
      case "green": return "bg-emerald-500/10 text-emerald-500";
      case "amber": return "bg-amber-500/10 text-amber-500";
      case "gray": return "bg-slate-500/10 text-slate-400";
      default: return "";
    }
  };

  // Next Actions
  const nextActions = [
    { icon: Target, text: `${stats?.pending_relevancy ?? 0} leads ready for AI relevance scoring`, badge: { label: "Pending", color: "amber" as const }, path: "/app/leads?filter=pending_relevancy" },
    { icon: ShieldCheck, text: `${stats?.pending_verification ?? 0} relevant leads ready for verification`, badge: { label: "Ready", color: "blue" as const }, path: "/app/leads?filter=pending_verification" },
    { icon: Users, text: `${stats?.verified_clients ?? 0} verified clients ready for outreach`, badge: { label: "New", color: "green" as const }, path: "/app/email?filter=verified" },
  ];

  // Top Searches
  const topSearches = [...sessions]
    .sort((a, b) => (b.results_count ?? 0) - (a.results_count ?? 0))
    .slice(0, 5);
  const maxResultsCount = Math.max(...topSearches.map(s => s.results_count ?? 0), 1);

  // Recent Searches
  const recentSearches = [...sessions].slice(0, 5);

  // Credits
  const creditsUsed = credits ? (credits.allocated_total - credits.credits_remaining) : 0;
  const creditsRemaining = credits?.credits_remaining ?? 0;
  const creditsTotal = credits?.allocated_total ?? 1;
  const creditsPct = Math.round((creditsRemaining / creditsTotal) * 100);

  const creditsData = [
    { name: "Used", value: creditsUsed, fill: "#f59e0b" },
    { name: "Remaining", value: creditsRemaining, fill: "#3b82f6" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 page-enter max-w-[1400px] mx-auto w-full">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold leading-tight uppercase tracking-tight text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
            Dashboard
          </h1>
          <p className="text-muted-foreground text-xs mt-1">{dateString}</p>
        </div>

        <div className="flex items-center space-x-4 flex-wrap gap-y-2">
          {/* Credits Badge */}
          <div className="bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] rounded-full px-4 py-1.5 flex items-center space-x-2">
            <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="text-xs font-bold text-amber-500">
              {new Intl.NumberFormat().format(creditsRemaining)} <span className="font-normal opacity-70 uppercase text-[10px]">credits</span>
            </span>
          </div>

          {/* Time Filter */}
          <div className="bg-[var(--card)] border border-border rounded-lg p-1 flex text-[10px] font-bold">
            {([
              { key: "7d", label: "7D" },
              { key: "30d", label: "30D" },
              { key: "all", label: "ALL" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setTimeFilter(f.key as any)}
                className={`px-3 py-1.5 rounded transition-all uppercase ${
                  timeFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ROW 1: PIPELINE FUNNEL CARDS */}
      <div className="flex flex-col lg:flex-row items-stretch justify-between gap-2">
        {funnelStages.map((stage, idx) => {
          const StageIcon = stage.icon;
          const isLast = idx === funnelStages.length - 1;
          const nextStageCount = isLast ? 0 : funnelStages[idx + 1].count;
          const convRate = stage.count > 0 ? Math.round((nextStageCount / stage.count) * 100) : 0;

          return (
            <div key={stage.id} className="flex-1 flex items-center">
              <div 
                style={S.card} 
                className={`p-4 w-full flex flex-col justify-center border-l-0 ${getBorderColorClass(stage.color)} hover:border-white/10 transition-colors`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`p-1.5 rounded-md ${getIconColorClass(stage.color)}`}>
                    <StageIcon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {stage.label}
                  </span>
                </div>
                <div className="text-3xl font-bold text-foreground mt-1" style={{ fontFamily: "Syne, sans-serif" }}>
                  {new Intl.NumberFormat().format(stage.count)}
                </div>
              </div>
              
              {!isLast && (
                <div className="hidden lg:flex flex-col items-center justify-center px-2 z-10 text-muted-foreground">
                  <span className="text-xs font-bold leading-none">→</span>
                  <span className="text-[10px] font-mono leading-none mt-1">{convRate}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ROW 2: CHARTS */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Lead Quality Distribution */}
        <div style={S.card} className="p-5 flex flex-col">
          <div className={S.section}>Lead Quality Distribution</div>
          {leadQuality ? (
            <>
              <p className="text-[11px] text-muted-foreground mb-3">
                Relevance scores across {leadQuality.total_scored} scored businesses
              </p>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leadQuality.buckets} barCategoryGap="20%">
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                      formatter={(val: number, _name: string, props: any) => [val, props.payload.range]}
                      labelFormatter={() => ""}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {leadQuality.buckets.map((bucket, i) => (
                        <Cell
                          key={i}
                          fill={bucket.tier === "low" ? "#ef4444" : bucket.tier === "mid" ? "#f59e0b" : "#22c55e"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold" style={{ color: "#ef4444", fontFamily: "Syne, sans-serif" }}>
                    {leadQuality.low_count}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Low quality</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold" style={{ color: "#f59e0b", fontFamily: "Syne, sans-serif" }}>
                    {leadQuality.mid_count}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Mid quality</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold" style={{ color: "#22c55e", fontFamily: "Syne, sans-serif" }}>
                    {leadQuality.high_count}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">High quality</div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center mt-2">
              <div className="h-[220px] w-full animate-pulse rounded-lg bg-white/5" />
            </div>
          )}
        </div>

        {/* Pipeline Momentum */}
        <div style={S.card} className="p-5 flex flex-col">
          <div className={S.section}>Pipeline Momentum</div>
          {momentum ? (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={momentum.points}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend
                    align="right"
                    verticalAlign="top"
                    wrapperStyle={{ fontSize: 10, paddingBottom: 8 }}
                    iconType="circle"
                    iconSize={6}
                  />
                  <Area type="monotone" dataKey="discovered" name="Discovered" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.08} dot={false} />
                  <Area type="monotone" dataKey="relevant"   name="Relevant"   stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.08} dot={false} />
                  <Area type="monotone" dataKey="verified"   name="Verified"   stroke="#22c55e" strokeWidth={2} fill="#22c55e" fillOpacity={0.1}  dot={false} />
                  <Area type="monotone" dataKey="clients"    name="Clients"    stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.1}  dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center mt-2">
              <div className="h-[280px] w-full animate-pulse rounded-lg bg-white/5" />
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: NEXT ACTIONS */}
      <div className="w-full">
        <div className={S.section}>Next Actions</div>
        <div className="space-y-2">
          {nextActions.map((action, i) => {
            const ActionIcon = action.icon;
            return (
              <div key={i} onClick={() => navigate(action.path)}
                className="flex items-center gap-3 p-3.5 rounded-lg cursor-pointer transition-colors hover:bg-muted"
                style={S.card}>
                <div className={`p-1.5 rounded-md ${
                  action.badge.color === 'amber' ? 'bg-[rgba(245,158,11,0.1)] text-amber-500' :
                  action.badge.color === 'blue' ? 'bg-[rgba(59,130,246,0.15)] text-blue-500' : 'bg-[rgba(16,185,129,0.1)] text-emerald-500'
                }`}>
                  <ActionIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 text-[13px] font-semibold text-foreground">{action.text}</div>
                <Badge color={action.badge.color}>{action.badge.label}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* ROW 4: TWO COLUMNS (60 / 40) */}
      <div className="grid lg:grid-cols-10 gap-5">
        
        {/* LEFT 60%: Top Performing Searches */}
        <div style={S.card} className="p-5 lg:col-span-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className={S.section} style={{ marginBottom: 0 }}>Top Performing Searches</div>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono border border-border">
              by leads found
            </span>
          </div>
          <div className="space-y-4 flex-1">
            {topSearches.length > 0 ? topSearches.map((session) => {
              const count = session.results_count ?? 0;
              const widthPct = maxResultsCount > 0 ? (count / maxResultsCount) * 100 : 0;
              const query = session.search_query || "Untitled Search";
              return (
                <div key={session.search_id} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium truncate max-w-[280px] text-foreground" title={query}>
                      {query}
                    </span>
                    <span className="font-bold text-foreground shrink-0 ml-2">
                      {new Intl.NumberFormat().format(count)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${Math.min(widthPct, 100)}%` }} 
                    />
                  </div>
                </div>
              );
            }) : (
              <div className="text-center text-sm text-muted-foreground py-8">No searches found.</div>
            )}
          </div>
        </div>

        {/* RIGHT 40%: Credit Usage */}
        <div style={S.card} className="p-5 lg:col-span-4 flex flex-col items-center">
          <div className={`${S.section} self-start w-full`}>Credit Usage</div>
          
          <div className="relative flex items-center justify-center my-2 h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={creditsData} 
                  dataKey="value" 
                  innerRadius={50} 
                  outerRadius={65} 
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {creditsData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
                {creditsPct}%
              </span>
              <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Left</div>
            </div>
          </div>

          <div className="text-center mb-5 mt-1">
            <div className="text-sm font-bold text-foreground">
              {new Intl.NumberFormat().format(creditsRemaining)} <span className="text-muted-foreground font-normal text-xs">of {new Intl.NumberFormat().format(creditsTotal)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">credits remaining</div>
          </div>

          <div className="w-full border-t border-border pt-4 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Per Operation</p>
            {[
              { name: 'Discovery', cost: '3 cr' },
              { name: 'Relevance', cost: '2 cr' },
              { name: 'Verification', cost: '5 cr' },
              { name: 'Email Lookup', cost: '3 cr' },
              { name: 'SERP Enrich', cost: '1 cr' },
            ].map(op => (
              <div key={op.name} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{op.name}</span>
                <span className="font-bold text-foreground">{op.cost}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 5: RECENT SEARCHES */}
      <div style={S.card} className="overflow-hidden w-full">
        <div className="flex justify-between items-center px-4 py-3 bg-[var(--card)] border-b border-border">
          <h3 className={S.section} style={{ marginBottom: 0 }}>Recent Searches</h3>
          <Link to="/app/search" className="text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Query</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Leads Found</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentSearches.length > 0 ? recentSearches.map((session) => {
                const query = session.search_query || "Untitled Search";
                const isRunning = session.status === "scoring";
                return (
                  <tr key={session.search_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground truncate max-w-[200px]" title={query}>
                      {query}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-foreground">
                      {session.results_count > 0 ? new Intl.NumberFormat().format(session.results_count) : '--'}
                    </td>
                    <td className="px-4 py-3">
                      {isRunning 
                        ? <Badge color="blue">Scoring</Badge>
                        : session.status === "failed" 
                          ? <Badge color="red">Failed</Badge>
                          : <Badge color="green">Done</Badge>
                      }
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {session.created_at ? getRelativeTime(session.created_at) : '--'}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No recent searches found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
