import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
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

type ActivityEvent = {
  type: string
  text: string
  time: string
  color?: string
  search_id?: number
  business_id?: number
  campaign_id?: number
  origin?: "search" | "campaign"
}

type NavTarget = { to: string; state?: { sessionId: number } }

function getTarget(event: ActivityEvent): NavTarget | null {
  if (
    (event.type === "verification" ||
      event.type === "relevance" ||
      event.type === "email") &&
    event.business_id
  ) {
    return { to: `/app/business/${event.business_id}` }
  }
  if (event.type === "search") {
    if (event.origin === "campaign" && event.campaign_id) {
      return { to: `/app/campaigns?campaign=${event.campaign_id}` }
    }
    if (event.search_id) {
      return { to: "/app/search", state: { sessionId: event.search_id } }
    }
  }
  return null
}

export default function ActivityPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.activityLog(50)
      .then(e => setEvents(e || []))
      .catch(() => {
        toast.error("Failed to load activity")
        setEvents([])
      })
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
              const target = getTarget(event)
              const rowClass = `flex items-start gap-4 px-5 py-4 w-full text-left transition-colors ${
                target ? "hover:bg-muted cursor-pointer" : ""
              }`
              const content = (
                <>
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
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {event.type === "search" && event.origin && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full
                        text-[10px] font-semibold uppercase tracking-wide"
                        style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                        from {event.origin === "campaign" ? "Campaign" : "Search"}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full
                      text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: `${color}15`, color }}>
                      {event.type}
                    </span>
                  </div>
                </>
              )
              if (target) {
                return (
                  <button
                    key={i}
                    type="button"
                    className={rowClass}
                    onClick={() =>
                      navigate(target.to, target.state ? { state: target.state } : undefined)
                    }
                  >
                    {content}
                  </button>
                )
              }
              return (
                <div key={i} className={rowClass}>
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
