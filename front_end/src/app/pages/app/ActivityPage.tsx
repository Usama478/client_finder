import { useEffect, useState } from "react"
import { api } from "../../../lib/api"
import { Search, Target, ShieldCheck, Mail, Download, Clock } from "lucide-react"

const typeIcon: Record<string, any> = {
  search: Search,
  relevance: Target,
  verification: ShieldCheck,
  email: Mail,
  export: Download,
}
const typeColor: Record<string, string> = {
  search: "var(--primary)",
  relevance: "#8b5cf6",
  verification: "var(--chart-2)",
  email: "var(--chart-2)",
  export: "var(--chart-3)",
}

export default function ActivityPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.activityLog(50)
      .then(e => setEvents(e || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-foreground"
            style={{ fontFamily: "Syne, sans-serif" }}>Activity</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            Complete timeline of your workspace actions
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-3xl mb-3 opacity-30">📋</div>
            <div className="text-sm font-bold text-foreground">No activity yet</div>
            <div className="text-[12px] text-muted-foreground mt-1">
              Activity will appear here as you use the platform
            </div>
          </div>
        )}
        {!loading && events.length > 0 && (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {events.map((event, i) => {
              const Icon = typeIcon[event.type] || Clock
              const color = typeColor[event.type] || "var(--muted-foreground)"
              return (
                <div key={i} className="flex items-start gap-4 px-5 py-4
                  hover:bg-muted transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center
                    flex-shrink-0 mt-0.5"
                    style={{ background: `${color}15` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-foreground">{event.text}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.time
                        ? new Date(event.time).toLocaleString([], {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })
                        : ""}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full
                      text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: `${color}15`, color }}>
                      {event.type}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
