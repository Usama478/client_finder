import { Search, Target, ShieldCheck, StopCircle } from "lucide-react"
import type { Campaign } from "../../../../lib/campaigns-api"
import { CampaignStatusBadge } from "./CampaignStatusBadge"

interface CampaignProgressCardProps {
  campaign: Campaign
  isRunning: boolean
  progressPct: number
  creditPct: number
  onBack: () => void
  onCancel: () => void
}

export function CampaignProgressCard({
  campaign,
  isRunning,
  progressPct,
  creditPct,
  onBack,
  onCancel,
}: CampaignProgressCardProps) {
  const stats = [
    { label: "Discovered", value: campaign.total_discovered, icon: Search, iconClass: "text-primary" },
    { label: "Passed Relevance", value: campaign.total_relevance_passed, icon: Target, iconClass: "text-violet-400" },
    { label: "Verified", value: campaign.total_verification_passed, icon: ShieldCheck, iconClass: "text-[var(--chart-2)]" },
  ]

  return (
    <div className="bg-card border border-border rounded-[10px] p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            ← Campaigns
          </button>
          <div className="font-semibold text-sm text-foreground font-[Syne,sans-serif]">
            Campaign Progress
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Pass {campaign.current_pass}</span>
          <CampaignStatusBadge status={campaign.status} pulse={isRunning} />
          {isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <StopCircle className="h-3.5 w-3.5" /> Stop
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>Verified clients</span>
          <span className="font-bold text-foreground">{campaign.verified_count} / {campaign.target_count}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-border">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>Credits used</span>
          <span className="font-bold text-foreground">{campaign.credits_used} / {campaign.credit_budget}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-border">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              creditPct > 85 ? "bg-red-500" : creditPct > 60 ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(100, creditPct)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="flex flex-col items-center p-3 rounded-lg bg-muted border border-border">
              <Icon className={`h-4 w-4 mb-1 ${s.iconClass}`} />
              <div className="text-xl font-bold text-foreground font-[Syne,sans-serif]">{s.value}</div>
              <div className="text-[10px] text-muted-foreground text-center">{s.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
